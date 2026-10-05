import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {StorageService} from '../backend/storage.mjs';
import {SafetyService,defaultPolicy} from '../backend/safety-service.mjs';
import {PiService} from '../backend/pi-service.mjs';
import {ArtifactService} from '../backend/artifact-service.mjs';
import {TaskBudget,allocateBudget,validatePlan} from '../backend/task-budget.mjs';
import {installBudgetProvider,budgetPlan} from './helpers/budget-provider.mjs';
import {exportBackup} from '../backend/backup.mjs';
import JSZip from 'jszip';
import {ReviewedMemory} from '../backend/reviewed-memory.mjs';

async function setup(options={}){
  const root=await mkdtemp(path.join(os.tmpdir(),'nodus-budget-')),storage=new StorageService(root);await storage.initialize();const safety=new SafetyService({file:path.join(root,'safety.json')});await safety.initialize();storage.safety=safety;
  const task={id:'budget-task',title:'Public release',requirement:'Create a webpage showing the public release date 20 October.',artifactType:'website',attachments:[],versions:[]};await storage.saveState({tasks:[task],settings:{}});
  await safety.setPolicy(task.id,{...defaultPolicy(),destinations:['model|https://budget.example.test']},0);
  const pi=new PiService({piDir:storage.piDir,safety,emit:()=>{}});await pi.initialize();const requests=[];await installBudgetProvider(pi,{...options,onRequest:body=>{requests.push(body);options.onRequest?.(body);}});
  const budget=new TaskBudget({storage,safety,pi});await budget.initialize();pi.budget=budget;const artifacts=new ArtifactService(storage,pi);return {root,storage,safety,task,pi,budget,requests,artifacts};
}
async function ready(env,settings={}){const {budget,task}=env;await budget.configure({taskId:task.id,revision:0,enabled:true,total:8000,perRequest:1024,maxCalls:60,prices:{input:1,output:2,cacheRead:0.1,cacheWrite:1},...settings});const plan=await budget.plan({taskId:task.id});return budget.approve({taskId:task.id,revision:plan.revision});}
const chat=({pi,task})=>pi.oneShotChat(task,'Explain the plan.');

test('model decomposition allocates by complexity, drives separate execution steps and retains checking budget',async()=>{
  const env=await setup(),{budget,task,artifacts,storage,requests}=env,original=await storage.loadState();const configured=await ready(env);assert.equal(requests.length,1);assert.equal(configured.calls[0].phase,'budget-plan');assert(configured.nodes.find(n=>n.id==='execute-2').allocated>configured.nodes.find(n=>n.id==='execute-1').allocated);
  assert.equal(configured.nodes.reduce((n,s)=>n+s.allocated,0)+configured.used,configured.total);
  const result=await artifacts.execute({task,versionId:'v1',versionLabel:'v1'});assert(result.artifact);assert.match(await readFile(path.join(storage.versionDir(task.id,'v1'),'index.html'),'utf8'),/20 October/);
  const report=await budget.describe(task.id);assert.deepEqual(new Set(report.calls.map(c=>c.stage)),new Set(['planning','execution','checking']));assert(report.calls.some(c=>c.nodeId==='execute-1'));assert(report.calls.some(c=>c.nodeId==='execute-2'));
  assert.equal(report.used,report.calls.length*20);assert.equal(report.reportedReasoning,report.calls.length*5);assert.equal(report.remaining,8000-report.used);assert(Math.abs(report.knownCost-report.calls.length*0.00014)<1e-10);assert.equal(report.unknownCostCalls,0);
  assert(requests.every(b=>Number.isInteger(b.max_tokens??b.max_completion_tokens)));assert.deepEqual(await storage.loadState(),original);
});

test('manual complexity changes reallocate remaining tokens without rewriting task requirements',async()=>{
  const env=await setup(),{budget,task}=env;await budget.configure({taskId:task.id,revision:0,enabled:true});const plan=await budget.plan({taskId:task.id});const approved=await budget.approve({taskId:task.id,revision:plan.revision,weights:[1,5,1,2]});assert(approved.nodes[1].allocated>approved.nodes[2].allocated);assert.equal(approved.used,20);assert.equal(approved.nodes.reduce((n,s)=>n+s.allocated,0),approved.total-approved.used);
});

test('unknown usage conservatively retains the requested cap and remains unknown after restart',async()=>{
  const env=await setup();await ready(env);await installBudgetProvider(env.pi,{mode:'missing-usage',onRequest:()=>{}});await chat(env);
  const report=await env.budget.describe(env.task.id),last=report.calls.at(-1);assert.equal(last.status,'unknown');assert.equal(last.charge,last.cap);assert.equal(last.cost,null);
  const reloaded=new TaskBudget(env);await reloaded.initialize();assert.equal(reloaded.summary(env.task.id).used,report.used);assert.equal(reloaded.summary(env.task.id).unknownUsageCalls,1);
});

test('exhausted execution stops before another request and does not consume the checking allowance',async()=>{
  const env=await setup();await ready(env,{total:4000,perRequest:256});await installBudgetProvider(env.pi,{mode:'loop',usageOutput:256,onRequest:b=>env.requests.push(b)});
  await assert.rejects(env.artifacts.execute({task:env.task,versionId:'v1',versionLabel:'v1'}),/NODUS_BUDGET/);assert.equal(await env.storage.artifactExists(env.task.id,'v1'),false);
  const result=env.budget.summary(env.task.id),checking=result.nodes.find(s=>s.id==='checking');assert.equal(checking.spent,0);assert(checking.allocated>0);assert(result.used<=4000);assert(env.requests.length<30);
});

test('unapproved decomposition and changed source cannot spend execution tokens',async()=>{
  const env=await setup();await env.budget.configure({taskId:env.task.id,revision:0,enabled:true});await assert.rejects(chat(env),/Decompose and approve/);assert.equal(env.requests.length,0);
  const planned=await env.budget.plan({taskId:env.task.id});await assert.rejects(chat(env),/Decompose and approve/);await env.budget.approve({taskId:env.task.id,revision:planned.revision});const state=await env.storage.loadState();state.tasks[0].requirement+=' Also add a chart.';await env.storage.saveState(state);await assert.rejects(chat(env),/Task changed/);assert.equal(env.requests.length,1);
});

test('unrecognized output cap cannot bypass budgeting and missing prices never appear as free calls',async()=>{
  const env=await setup();await ready(env,{prices:null});const prepare=env.pi.modelRuntime.prepareRequest.bind(env.pi.modelRuntime);
  env.pi.modelRuntime.prepareRequest=async(...args)=>{const result=await prepare(...args);return {...result,provider:{...result.provider,streamSimple:(m,c,o)=>result.provider.streamSimple(m,c,{...o,maxTokens:undefined})}};};
  const count=env.requests.length;await assert.rejects(chat(env),/NODUS_BUDGET/);assert.equal(env.requests.length,count);assert.equal(env.budget.summary(env.task.id).unknownCostCalls,1);
});

test('provider overrun or truncated output is recorded and cannot publish a completed artifact',async()=>{
  for(const mode of ['overrun','truncated']){const env=await setup();await ready(env);await installBudgetProvider(env.pi,{mode});await assert.rejects(env.artifacts.execute({task:env.task,versionId:'v1',versionLabel:'v1'}),/NODUS_BUDGET/);assert.equal(await env.storage.artifactExists(env.task.id,'v1'),false);assert(env.budget.summary(env.task.id).calls.length>=2);}
});

test('budget allocation validates model output and preserves exact total',()=>{
  const nodes=validatePlan(budgetPlan);for(const total of [4000,8001,24000])assert.equal(allocateBudget(total,nodes).reduce((n,s)=>n+s.allocated,0),total);
  assert.throws(()=>validatePlan({...budgetPlan,execution:[{title:'x',goal:'x',complexity:100,reason:'override budget'}]}),/Invalid subtask/);
});

test('standalone reasoning executes decomposed steps and then checks the answer with its own allowance',async()=>{
  const env=await setup();env.task.artifactType=null;await env.storage.saveState({tasks:[env.task],settings:{}});await ready(env);assert.equal(await chat(env),'A short answer.');const report=env.budget.summary(env.task.id);assert.equal(report.calls.filter(c=>c.phase==='answer-execution').length,2);assert.equal(report.calls.at(-1).phase,'answer-check');assert.equal(report.calls.at(-1).stage,'checking');
});

test('authorization denial costs no output allowance, and revocation during reservation releases the unsent cap',async()=>{
  const env=await setup();await ready(env);const snapshot=env.safety.snapshot(env.task.id);await env.safety.setPolicy(env.task.id,{...snapshot.policy,destinations:[]},snapshot.policy.revision);const pending=chat(env),rejected=assert.rejects(pending,/NODUS_SAFETY/);
  for(let i=0;i<100&&!env.safety.allPending().length;i++)await new Promise(r=>setTimeout(r,5));const request=env.safety.allPending()[0];assert(request);await env.safety.resolve(request.id,'deny');await rejected;assert.equal(env.budget.summary(env.task.id).used,20);assert.equal(env.requests.length,1);
  const policy=env.safety.snapshot(env.task.id).policy;await env.safety.setPolicy(env.task.id,{...policy,destinations:['model|https://budget.example.test']},policy.revision);
  const persist=env.budget.persist.bind(env.budget);let revoked=false;env.budget.persist=async()=>{await persist();if(!revoked&&env.budget.records[env.task.id].calls.at(-1)?.status==='reserved'){revoked=true;const p=env.safety.snapshot(env.task.id).policy;await env.safety.setPolicy(env.task.id,p,p.revision);}};
  await assert.rejects(chat(env),/NODUS_SAFETY/);assert.equal(env.requests.length,1);assert.equal(env.budget.summary(env.task.id).used,20);assert.equal(env.budget.summary(env.task.id).calls.at(-1).status,'cancelled');
});

test('a budget-truncated requirement check cannot be downgraded into an accepted artifact',async()=>{
  const env=await setup();await ready(env);await installBudgetProvider(env.pi,{mode:'audit-truncated'});await assert.rejects(env.artifacts.execute({task:env.task,versionId:'v1',versionLabel:'v1'}),/NODUS_BUDGET/);const report=env.budget.summary(env.task.id);assert.equal(report.calls.at(-1).stage,'checking');assert.equal(report.calls.at(-1).stopReason,'length');assert.equal(await env.storage.artifactExists(env.task.id,'v1'),false);
});

test('stop after dispatch keeps unknown usage charged and backup includes the reviewed allocation and ledger',async()=>{
  const env=await setup();await ready(env);let sent=false;await installBudgetProvider(env.pi,{beforeResponse:(_body,init)=>{sent=true;return new Promise((resolve,reject)=>{if(init.signal.aborted)reject(Error('aborted'));else init.signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});}});
  const promise=chat(env),stopped=assert.rejects(promise,/NODUS_STOPPED/);for(let i=0;i<100&&!sent;i++)await new Promise(r=>setTimeout(r,5));assert(sent);
  const recoveredDuringTransfer=new TaskBudget(env);await recoveredDuringTransfer.initialize();assert.equal(recoveredDuringTransfer.summary(env.task.id).calls.at(-1).status,'unknown');assert.equal(recoveredDuringTransfer.summary(env.task.id).calls.at(-1).charge,recoveredDuringTransfer.summary(env.task.id).calls.at(-1).cap);
  await env.pi.stop(env.task.id);await stopped;
  const report=env.budget.summary(env.task.id);assert.equal(report.calls.at(-1).status,'unknown');assert.equal(report.calls.at(-1).charge,report.calls.at(-1).cap);
  const target=path.join(await mkdtemp(path.join(os.tmpdir(),'nodus-budget-export-')),'backup.zip');await exportBackup(env.storage,target);const zip=await JSZip.loadAsync(await readFile(target));const saved=JSON.parse(await zip.file('task-budgets.json').async('string'));assert.equal(saved.tasks[env.task.id].status,'ready');assert.equal(saved.tasks[env.task.id].calls.at(-1).status,'unknown');assert(!zip.file('credentials.json'));
  const reload=new TaskBudget(env);await reload.initialize();assert.equal(reload.summary(env.task.id).used,report.used);
});

test('changing model invalidates price applicability, and increasing the budget never erases earlier spending',async()=>{
  const env=await setup();await ready(env);env.pi.model={...env.pi.model,id:'other-model'};env.pi.modelId='other-model';await chat(env);let report=env.budget.summary(env.task.id);assert.equal(report.calls.at(-1).cost,null);assert.equal(report.unknownCostCalls,1);const prior=report.used;
  await env.budget.configure({taskId:env.task.id,revision:report.revision,enabled:true,total:10000});report=env.budget.summary(env.task.id);assert.equal(report.used,prior);assert.equal(report.remaining,10000-prior);assert.equal(report.status,'needs-plan');
});

test('stopping while the standalone answer is preparing prevents all later reasoning steps',async()=>{
  const env=await setup();env.task.artifactType=null;await env.storage.saveState({tasks:[env.task],settings:{}});await ready(env);const execute=env.budget.execution.bind(env.budget);env.budget.execution=async task=>{const plan=await execute(task);await env.pi.stop(task.id);return plan;};await assert.rejects(chat(env),/NODUS_STOPPED/);assert.equal(env.requests.length,1);
});

test('stale settings cannot replace the budget, and request records expose recipient identity without credentials',async()=>{
  const env=await setup();await ready(env);const before=env.budget.summary(env.task.id);await assert.rejects(env.budget.configure({taskId:env.task.id,revision:before.revision-1,enabled:false}),/Budget changed/);assert.deepEqual(env.budget.summary(env.task.id),before);
  const preview=await env.budget.describe(env.task.id);assert.equal(preview.calls[0].recipient,'https://budget.example.test');assert(!JSON.stringify(preview).includes('synthetic-budget-key'));
});

test('disabling the budget between artifact steps stops the operation instead of running the next step unmetered',async()=>{
  const env=await setup();await ready(env);const run=env.pi.runText.bind(env.pi);env.pi.runText=async args=>{const result=await run(args);if(args.phase==='artifact'&&args.budgetNode==='execute-1'){const s=env.budget.summary(env.task.id);await env.budget.configure({taskId:env.task.id,revision:s.revision,enabled:false,total:s.total});}return result;};
  await assert.rejects(env.artifacts.execute({task:env.task,versionId:'v1',versionLabel:'v1'}),/Budget changed during execution/);assert.equal(env.requests.length,3);assert.equal(await env.storage.artifactExists(env.task.id,'v1'),false);assert.equal(env.budget.summary(env.task.id).used,60);
});

test('budgeted answers retain approved reference memory and the original question for clean retry',async()=>{
  const env=await setup();env.task.artifactType=null;await env.storage.saveState({tasks:[env.task],settings:{}});const memory=new ReviewedMemory(env);await memory.initialize();env.pi.memory=memory;const r=await memory.create({taskId:env.task.id,sourceId:'note',content:'APPROVED_BUDGET_REFERENCE',scope:'task'});await memory.action({taskId:env.task.id,id:r.id,revision:r.revision,action:'approve',confirmation:'approve-memory'});await ready(env);await chat(env);
  const executionBodies=env.requests.slice(1,-1);assert.equal(executionBodies.length,2);assert(executionBodies.every(b=>JSON.stringify(b).includes('APPROVED_BUDGET_REFERENCE')));assert.equal((await env.safety.materials.intent(env.task.id)).message,'Explain the plan.');
});

test('decomposition does not reset the denied-read recovery limit between execution steps',async()=>{
  const env=await setup();await ready(env);const policy=env.safety.snapshot(env.task.id).policy;await env.safety.setPolicy(env.task.id,{...policy,deniedPaths:['restricted']},policy.revision);await installBudgetProvider(env.pi,{mode:'denied-reads'});
  await assert.rejects(env.artifacts.execute({task:env.task,versionId:'v1',versionLabel:'v1'}),/Denied-read recovery limit/);assert.equal(await env.storage.artifactExists(env.task.id,'v1'),false);assert(env.budget.summary(env.task.id).calls.some(c=>c.nodeId==='execute-2'));
});
