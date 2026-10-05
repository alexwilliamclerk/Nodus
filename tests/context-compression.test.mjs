import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import {StorageService} from '../backend/storage.mjs';
import {SafetyService,defaultPolicy,taskSources} from '../backend/safety-service.mjs';
import {PiService} from '../backend/pi-service.mjs';
import {ContextCompression,compressionSources} from '../backend/context-compression.mjs';
import {extractTaskRules} from '../frontend/requirements.js';
import {oneShotPrompt} from '../backend/prompts.mjs';
import {withVersionContext} from '../backend/artifact-service.mjs';
import {finalizeArtifact} from '../backend/artifacts.mjs';
import {exportBackup} from '../backend/backup.mjs';
import {installCompressionProvider} from './helpers/compression-provider.mjs';
import {guardedModelRuntime} from '../backend/model-safety.mjs';

const longText=marker=>'The earlier discussion considered a simple page layout. '.repeat(5)+(marker+' background detail. ').repeat(400)+'\nUNRESOLVED_CHECK: verify publication date.';
async function setup(options={}){
  const root=await mkdtemp(path.join(os.tmpdir(),'nodus-fold-')),storage=new StorageService(root);await storage.initialize();const safety=new SafetyService({file:path.join(root,'safety.json')});await safety.initialize();storage.safety=safety;
  const task={id:'fold-task',title:'Reviewed context',requirement:'Keep the user requirement EXACT_USER_REQUIREMENT.',artifactType:null,attachments:[{name:'reference.txt',status:'read',text:longText('ATTACHMENT_CANARY')}],webSearchResults:[{title:'Reference page',url:'https://reference.example/page',snippet:'A short search snippet.',content:longText('WEB_CONTENT_CANARY')}],temporaryConversations:[{id:'old',message:'EXACT_OLD_USER_MESSAGE',reply:longText('HISTORY_CANARY')},{id:'recent',message:'EXACT_RECENT_USER_MESSAGE',reply:'RECENT_REPLY_KEEP'},{id:'open',message:'EXACT_UNRESOLVED_USER_QUESTION?',reply:''}],versions:[]};task.taskRules=extractTaskRules(task);await storage.saveState({tasks:[task],settings:{language:'en-US'}});await safety.registerSources(task.id,taskSources(task));await safety.setPolicy(task.id,{...defaultPolicy(),destinations:['model|https://memory.example.test']},0);
  const requests=[],pi=new PiService({piDir:storage.piDir,safety,emit:()=>{}});await pi.initialize();await installCompressionProvider(pi,{...options,onRequest:b=>{requests.push(b);options.onRequest?.(b);}});const compression=new ContextCompression({storage,safety,pi});await compression.initialize();pi.compression=compression;return {root,storage,safety,pi,compression,task,requests};
}
async function draft(env,kinds=['conversation']){const description=await env.compression.describe(env.task.id),sources=description.sources.filter(s=>!s.pinnedReason&&kinds.includes(s.kind));return env.compression.create({taskId:env.task.id,sourceIds:sources.map(s=>s.id),summary:'SUMMARY_CONTROL_MARKER: Earlier material describes a simple release page.',citations:sources.map(s=>({sourceId:s.id,quote:s.text.slice(0,80)})),retained:[{sourceId:sources[0].id,quote:'UNRESOLVED_CHECK: verify publication date.',label:'open-question'}]});}
const approve=async(env,r)=>env.compression.action({taskId:env.task.id,id:r.id,revision:r.revision,storeRevision:(await env.compression.describe(env.task.id)).revision,action:'approve',confirmation:'approve-context-compression'});
const chat=env=>env.pi.oneShotChat(env.task,'EXACT_CURRENT_USER_QUESTION?');

test('reviewed compression replaces actual encoded history while preserving requirements, user messages and unresolved quotes',async()=>{
  const env=await setup(),original=await env.storage.loadState(),r=await draft(env);await chat(env);assert(JSON.stringify(env.requests.at(-1)).includes('HISTORY_CANARY'));assert(!JSON.stringify(env.requests.at(-1)).includes('SUMMARY_CONTROL_MARKER'));
  await approve(env,r);assert.equal(await chat(env),'APPROVED_SUMMARY_USED');const body=JSON.stringify(env.requests.at(-1));assert(!body.includes('HISTORY_CANARY'));for(const value of ['EXACT_USER_REQUIREMENT','EXACT_OLD_USER_MESSAGE','EXACT_RECENT_USER_MESSAGE','EXACT_UNRESOLVED_USER_QUESTION?','EXACT_CURRENT_USER_QUESTION?','RECENT_REPLY_KEEP','UNRESOLVED_CHECK: verify publication date.'])assert(body.includes(value),value);
  assert(!JSON.stringify(env.requests.at(-1).messages.filter(m=>m.role==='system')).includes('SUMMARY_CONTROL_MARKER'));assert.deepEqual(await env.storage.loadState(),original);const view=await env.compression.describe(env.task.id);assert(view.uses.at(-1).beforeCharacters>view.uses.at(-1).afterCharacters);assert.equal(view.uses.at(-1).httpStatus,200);assert(view.uses.at(-1).attempted);
});

test('attachments and both web snippet/content are folded together without mutating original files or permission labels',async()=>{
  const env=await setup(),r=await draft(env,['attachment','web']);await approve(env,r);await chat(env);const raw=JSON.stringify(env.requests.at(-1));assert(!raw.includes('ATTACHMENT_CANARY'));assert(!raw.includes('WEB_CONTENT_CANARY'));assert(raw.includes('https://reference.example/page'));assert.equal(env.task.webSearchResults[0].content,longText('WEB_CONTENT_CANARY'));assert(env.safety.snapshot(env.task.id).sources.some(s=>s.kind==='attachment'&&s.name==='reference.txt'));
});

test('latest turns and direct questions cannot be selected; unsupported citations and expanded summaries cannot activate',async()=>{
  const env=await setup(),view=await env.compression.describe(env.task.id),recent=view.sources.find(s=>s.pinnedReason==='recent');await assert.rejects(env.compression.create({taskId:env.task.id,sourceIds:[recent.id],summary:'x',citations:[]}),/protected selection/);
  const source=view.sources.find(s=>!s.pinnedReason);await assert.rejects(env.compression.create({taskId:env.task.id,sourceIds:[source.id],summary:'x',citations:[{sourceId:source.id,quote:'invented quote'}]}),/Quote must match/);
  const state=await env.storage.loadState();state.tasks[0].attachments.push({name:'tiny.txt',status:'read',text:'A short reference.'});await env.storage.saveState(state);const tiny=(await env.compression.describe(env.task.id)).sources.find(s=>s.name==='tiny.txt'),r=await env.compression.create({taskId:env.task.id,sourceIds:[tiny.id],summary:'A summary that is longer than the short original source.',citations:[{sourceId:tiny.id,quote:tiny.text}]});await assert.rejects(approve(env,r),/No reduction/);
});

test('model summaries remain drafts, retain user-pinned quotes and reject fabricated evidence',async()=>{
  const env=await setup(),source=(await env.compression.describe(env.task.id)).sources.find(s=>s.kind==='attachment');const r=await env.compression.generate({taskId:env.task.id,sourceIds:[source.id],retained:[{sourceId:source.id,quote:'UNRESOLVED_CHECK: verify publication date.',label:'open-question'}]});assert.equal(r.status,'draft');assert.equal(r.permissions,undefined);assert.equal(r.retained.length,1);assert(env.requests[0].max_tokens<=4096||env.requests[0].max_completion_tokens<=4096);await chat(env);assert(JSON.stringify(env.requests.at(-1)).includes('ATTACHMENT_CANARY'));
  await installCompressionProvider(env.pi,{invalidQuote:true});await assert.rejects(env.compression.generate({taskId:env.task.id,sourceIds:[source.id]}),/Quote must match/);assert.equal((await env.compression.describe(env.task.id)).records.length,1);
});

test('edits require another review, revocation restores originals and source deletion never resurrects a saved summary',async()=>{
  const env=await setup();let r=await approve(env,await draft(env));r=await env.compression.action({taskId:env.task.id,id:r.id,revision:r.revision,action:'edit',summary:'EDITED_SUMMARY',citations:r.citations,retained:r.retained});assert.equal(r.status,'draft');await chat(env);assert(!JSON.stringify(env.requests.at(-1)).includes('EDITED_SUMMARY'));r=await approve(env,r);await chat(env);assert(JSON.stringify(env.requests.at(-1)).includes('EDITED_SUMMARY'));
  r=await env.compression.action({taskId:env.task.id,id:r.id,revision:r.revision,action:'revoke'});await chat(env);assert(JSON.stringify(env.requests.at(-1)).includes('HISTORY_CANARY'));
  const fresh=await approve(env,await draft(env));const state=await env.storage.loadState();state.tasks[0].temporaryConversations.shift();await env.storage.saveState(state);const before=env.requests.length;await assert.rejects(chat(env),/Source changed/);assert.equal(env.requests.length,before);assert.equal((await env.compression.describe(env.task.id)).records.find(r=>r.id===fresh.id).availability,'stale');
});

test('stale review and revocation before dispatch cannot send a prepared summary',async()=>{
  const env=await setup(),r=await draft(env),view=await env.compression.describe(env.task.id);await draft(env,['attachment']);await assert.rejects(env.compression.action({taskId:env.task.id,id:r.id,revision:r.revision,storeRevision:view.revision,action:'approve',confirmation:'approve-context-compression'}),/Preview changed/);const active=await approve(env,r),prepare=env.pi.modelRuntime.prepareRequest.bind(env.pi.modelRuntime);let revoked=false;
  env.pi.modelRuntime.prepareRequest=async(...args)=>{const ready=await prepare(...args);if(!revoked){revoked=true;await env.compression.action({taskId:env.task.id,id:active.id,revision:active.revision,action:'revoke'});}return ready;};await assert.rejects(chat(env),/NODUS_STOPPED|Summary changed/);assert.equal(env.requests.length,0);
});

test('restricted source classification still blocks model transmission after summary approval',async()=>{
  const env=await setup(),r=await approve(env,await draft(env,['attachment'])),source=env.safety.snapshot(env.task.id).sources.find(s=>s.kind==='attachment');await env.safety.setSourceClass(env.task.id,source.id,'blocked');await assert.rejects(chat(env),/NODUS_SAFETY/);assert.equal(env.requests.length,0);assert.equal(r.status,'approved');
});

test('overlapping approval replaces earlier folds and private backup retains immutable originals and revoked states',async()=>{
  const env=await setup(),a=await approve(env,await draft(env)),b=await draft(env,['conversation','attachment']);assert(b.preview.supersedes.includes(a.id));const active=await approve(env,b);let view=await env.compression.describe(env.task.id);assert.equal(view.records.find(r=>r.id===a.id).status,'superseded');await env.compression.action({taskId:env.task.id,id:active.id,revision:active.revision,action:'revoke'});
  const target=path.join(await mkdtemp(path.join(os.tmpdir(),'nodus-fold-export-')),'backup.zip');await exportBackup(env.storage,target);const zip=await JSZip.loadAsync(await readFile(target)),saved=JSON.parse(await zip.file('context-compression.json').async('string'));assert(saved.records.some(r=>r.status==='revoked'));assert(saved.records[0].sources[0].text.includes('HISTORY_CANARY'));assert(!zip.file('credentials.json'));
  const reload=new ContextCompression(env);await reload.initialize();view=await reload.describe(env.task.id);assert(view.records.some(r=>r.status==='revoked'));
});

test('workspace context folding preserves the underlying version and skips phases that do not carry those sources',async()=>{
  const env=await setup();env.task.artifactType='website';const dir=await env.storage.prepareVersion(env.task.id,'v1');await writeFile(path.join(dir,'index.html'),'<!doctype html><html><body>'+longText('WORKSPACE_CANARY')+'</body></html>');await finalizeArtifact(env.task,dir);env.task.currentVersionId='v1';env.task.versions=[{id:'v1'}];await env.storage.saveState({tasks:[env.task],settings:{}});await approve(env,await draft(env,['workspace']));
  const expanded=await withVersionContext(env.storage,env.task);await env.pi.oneShotChat(expanded,'Current question');assert(!JSON.stringify(env.requests.at(-1)).includes('WORKSPACE_CANARY'));assert((await readFile(path.join(dir,'index.html'),'utf8')).includes('WORKSPACE_CANARY'));
  assert.equal(await env.compression.prepare(env.task,'requirement-audit',t=>oneShotPrompt(t,'')),null);assert.equal(await env.compression.prepare(env.task,'chat',t=>oneShotPrompt(t,'')),null);
});

test('identical text inside user requirements is preserved rather than globally replaced',async()=>{
  const env=await setup();env.task.requirement+=' HISTORY_CANARY is a required literal.';env.task.taskRules=extractTaskRules(env.task);await env.storage.saveState({tasks:[env.task],settings:{}});await approve(env,await draft(env));await chat(env);const body=JSON.stringify(env.requests.at(-1));assert(body.includes('HISTORY_CANARY is a required literal.'));assert(!body.includes('HISTORY_CANARY background detail. HISTORY_CANARY'));
});

test('revocation during asynchronous source preparation cannot reactivate a captured summary',async()=>{
  const env=await setup(),active=await approve(env,await draft(env)),load=env.compression.task.bind(env.compression);let held,release;const waiting=new Promise(r=>held=r),resume=new Promise(r=>release=r);let first=true;env.compression.task=async id=>{const t=await load(id);if(first){first=false;held();await resume;}return t;};
  const call=chat(env),rejected=assert.rejects(call,/Summary changed during preparation|NODUS_STOPPED/);await waiting;await env.compression.action({taskId:env.task.id,id:active.id,revision:active.revision,action:'revoke'});release();await rejected;assert.equal(env.requests.length,0);
});

test('deleting a turn or changing its user question cannot borrow the provenance of an identical answer',async()=>{
  const env=await setup(),r=await approve(env,await draft(env));const state=await env.storage.loadState();state.tasks[0].temporaryConversations[0].id='replacement-turn';state.tasks[0].temporaryConversations[0].message='A different question';await env.storage.saveState(state);assert.equal((await env.compression.describe(env.task.id)).records.find(x=>x.id===r.id).availability,'stale');await assert.rejects(chat(env),/Source changed/);assert.equal(env.requests.length,0);
});

test('actual request review receives the compressed body and dispatches exactly the approved JSON',async()=>{
  const env=await setup();await approve(env,await draft(env));await env.safety.setMinimalDisclosure(env.task.id,true);const promise=chat(env);for(let i=0;i<100&&!env.safety.disclosure.list().length;i++)await new Promise(r=>setTimeout(r,5));const request=env.safety.disclosure.list()[0];assert(request);const preview=env.safety.disclosure.preview({id:request.id});assert(!preview.text.includes('HISTORY_CANARY'));assert(preview.text.includes('SUMMARY_CONTROL_MARKER'));await env.safety.disclosure.approve(request.id,preview.token);await promise;assert.deepEqual(env.requests[0],JSON.parse(preview.text));
});

test('compression receipts support Request objects without consuming or rewriting their body',async()=>{
  const env=await setup();await approve(env,await draft(env));const prepared=await env.compression.prepare(env.task,'chat',t=>oneShotPrompt(t,'请求必须保持原样'));
  const context={messages:[{role:'user',content:prepared.prompt}]},body=JSON.stringify(context),input=new Request('https://memory.example.test/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer synthetic-request-test','content-type':'application/json'},body});let received;
  const model={provider:'fixture',id:'fixture',baseUrl:'https://memory.example.test/v1'},grant=await env.safety.authorize(env.task.id,{kind:'model',target:'https://memory.example.test',payload:context});
  const runtime={prepareRequest:async()=>({model,options:{fetch:async(request,init)=>{received=await request.text();assert.equal(request.headers.get('authorization'),'Bearer synthetic-request-test');assert.equal(init.redirect,'error');return new Response('ok');}},provider:{streamSimple:async(_model,_context,options)=>options.fetch(input)}})};
  const run={modelGrant:grant,approvedModelOrigin:'https://memory.example.test',approvedPolicyRevision:env.safety.snapshot(env.task.id).policy.revision,modelRequests:0,contextGuard:prepared.check,recordCompression:bytes=>env.compression.recordUse(env.task.id,'chat',prepared,bytes),finishCompression:(id,status)=>env.compression.finishUse(id,status)};
  await guardedModelRuntime(runtime,env.safety,env.task.id,run).streamSimple(model,context,{});assert.equal(received,body);const receipt=(await env.compression.describe(env.task.id)).uses.at(-1);assert.equal(receipt.requestBytes,Buffer.byteLength(body));assert.equal(receipt.httpStatus,200);
});
