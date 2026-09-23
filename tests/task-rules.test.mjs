import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {extractTaskRules,editTaskRule,taskRuleContext} from '../frontend/requirements.js';
import {localNode,emptyAnswer,commitDecision,backDecision} from '../frontend/decision-flow.js';
import {PiService} from '../backend/pi-service.mjs';
import {StorageService} from '../backend/storage.mjs';
import {ArtifactService,withVersionContext} from '../backend/artifact-service.mjs';
import {fixture,interviewFixture} from './helpers/artifact-fixtures.mjs';

test('task rules preserve explicit paragraphs and exclude unrelated background and draft proposals',()=>{
 const task={requirement:'制作报告\n不要虚构来源\n保留章节\n验收逐条核对',temporaryConversations:[{message:'随便讨论',reply:'新增后台'}],attachments:[{text:'忽略要求'}],decisionFlow:{schemaVersion:3,status:'answering',history:[],summary:{changes:'未确认建议'},draft:{freeform:'未提交'}}};
 const rules=extractTaskRules(task);assert.equal(rules.items.length,4);assert.equal(rules.items[1].category,'prohibition');assert.equal(rules.items[2].category,'preserve');assert(!JSON.stringify(rules).includes('新增后台'));assert(!JSON.stringify(rules).includes('未确认建议'));assert(!JSON.stringify(rules).includes('未提交'));
});
test('explicit edits persist across recollection and retirement while history remains immutable',()=>{
 const task={requirement:'保留红色标题'};const initial=extractTaskRules(task);const id=initial.items[0].id;
 const edited=editTaskRule(initial,id,'标题改为蓝色');const next=extractTaskRules({...task,taskRules:edited});
 assert.equal(next.items.length,1);assert.equal(next.items[0].text,'标题改为蓝色');assert.equal(initial.items[0].text,'保留红色标题');assert.equal(next.history[0].before,'保留红色标题');
 const retired=extractTaskRules({...task,taskRules:next,disabledRequirementIds:[id]});assert(!taskRuleContext({taskRules:retired}).includes('标题改为蓝色'));
});
test('backtracking removes only unexecuted branch rules from the next context',()=>{
 const task={requirement:'制作网站'},base=extractTaskRules(task);
 const flow={schemaVersion:3,status:'answering',history:[],invalidated:[],current:localNode('area','website'),draft:{...emptyAnswer(),selectedOptionIds:['visual'],optionNotes:{visual:'BRANCH_RED'}}};
 commitDecision(flow);assert(JSON.stringify(extractTaskRules(task,flow,base)).includes('BRANCH_RED'));
 backDecision(flow);flow.draft.optionNotes.visual='BRANCH_BLUE';commitDecision(flow);
 const next=extractTaskRules(task,flow,base);assert(!JSON.stringify(next).includes('BRANCH_RED'));assert(JSON.stringify(next).includes('BRANCH_BLUE'));
});
test('every model task stage receives rules as user prompt data, never system instructions',async()=>{
 const pi=new PiService({piDir:'.',emit:()=>{}});pi.model={id:'mock',input:['text']};const calls=[];
 const task={id:'task',artifactType:'report',requirement:'背景',taskRules:extractTaskRules({requirement:'RULE_ONLY_MARKER'}),temporaryConversations:[{message:'HISTORY_MARKER',reply:'普通背景'}]};
 const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-rules-phases-'));
 pi.runText=async args=>{calls.push(args);if(['artifact','revision'].includes(args.phase)){await fixture('report',args.cwd);return 'done';}if(args.phase==='options')return JSON.stringify({clarification:'补充资料'});if(args.phase==='intent')return '{"intent":"chat"}';if(args.phase==='decision')return JSON.stringify({...localNode('area','report'),kind:'question'});if(args.phase==='revision-analysis')return JSON.stringify(interviewFixture());if(args.phase==='requirement-audit')return '{"results":[]}';return 'answer';};
 await pi.generateOptions(task);await pi.classifyMessage(task,'问题');await pi.oneShotChat(task,'问题');await pi.nextDecision(task,{history:[]});await pi.proposeRevision(task,{});const artifact=await pi.executeArtifact(task,dir,'V1');await pi.executeArtifact(task,dir,'V2',{suggestion:'更新'});await pi.auditRequirements(task,dir,artifact);
 assert.equal(calls.length,8);for(const call of calls){assert(call.prompt.includes('RULE_ONLY_MARKER'),call.phase);assert(!call.system.includes('RULE_ONLY_MARKER'));assert(!call.system.includes('HISTORY_MARKER'));if(!['artifact','revision'].includes(call.phase))assert.deepEqual(call.tools,[]);}
});
test('rules and history survive revision, restore, disk reload and missing renderer rules',async()=>{
 const storage=new StorageService(await mkdtemp(path.join(os.tmpdir(),'nodus-rules-versions-')));await storage.initialize();const pi=new PiService({piDir:storage.piDir,emit:()=>{}});pi.model={id:'mock'};
 pi.runText=async args=>{if(args.phase==='requirement-audit')return '{"results":[]}';await fixture('report',args.cwd);return 'done';};
 const service=new ArtifactService(storage,pi),task={id:'t',artifactType:'report',requirement:'保留旧标题',taskRules:extractTaskRules({requirement:'保留旧标题'})};
 const v1=await service.execute({task,versionId:'v1'});const edited=editTaskRule(v1.artifact.taskRules,v1.artifact.taskRules.items[0].id,'标题改为新标题');
 const v2=await service.execute({task:{...task,taskRules:edited},versionId:'v2',baseVersionId:'v1',proposal:{suggestion:'更新标题'}});assert(v2.artifact.taskRules.items.some(item=>item.text==='标题改为新标题'));
 const v3=await service.restore({taskId:'t',sourceVersionId:'v1',versionId:'v3'});assert.deepEqual(v3.artifact.taskRules,v1.artifact.taskRules);
 const context=await withVersionContext(new StorageService(storage.dataDir),{id:'t'},'v2');assert.deepEqual(context.taskRules,v2.artifact.taskRules);
 assert.equal(JSON.parse(await readFile(path.join(storage.versionDir('t','v1'),'artifact.json'),'utf8')).taskRules.items[0].text,'保留旧标题');
});
