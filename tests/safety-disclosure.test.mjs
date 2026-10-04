import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {SafetyService,defaultPolicy,sourceDescription} from '../backend/safety-service.mjs';
import {disclosureCandidates,minimizeBody} from '../backend/minimal-disclosure.mjs';
import {guardedModelRuntime} from '../backend/model-safety.mjs';

async function setup(options={}){const root=await mkdtemp(path.join(os.tmpdir(),'nodus-disclosure-'));const safety=new SafetyService({file:path.join(root,'safety.json'),...options});await safety.initialize();await safety.setPolicy('t',{...defaultPolicy(),destinations:['model|https://api.example.test']},0);await safety.setMinimalDisclosure('t',true);return safety;}
async function pending(safety){for(let i=0;i<200;i++){const p=safety.disclosure.list()[0];if(p)return p;await new Promise(r=>setTimeout(r,2));}throw Error('No disclosure request');}

const secret='sk-syntheticcustomerkey1234567890';
const body={model:'test-model',stream:true,messages:[{role:'user',content:`客户姓名：张三\n邮箱：client@example.test\nphone: 13812345678\napi_key: ${secret}\n合同金额：12000\n交付时间：10 月 20 日`},{role:'assistant',content:`The old answer copied ${secret}.`},{role:'tool',tool_call_id:'read-1',content:`File returned: ${secret}`} ]};

test('local candidates cover contract fields and logs; selected values disappear from history and tools without changing originals',()=>{
  const original=JSON.stringify(body),candidates=disclosureCandidates(body);assert(candidates.some(c=>c.value==='张三'));assert(candidates.some(c=>c.value==='client@example.test'));assert(candidates.some(c=>c.value===secret));
  const result=minimizeBody(body,{values:candidates.map(c=>c.value)});
  for(const value of ['张三','client@example.test','13812345678',secret])assert(!result.text.includes(value));
  assert(result.text.includes('12000'));assert(result.text.includes('10 月 20 日'));assert.equal(JSON.stringify(body),original);assert.equal(result.body.model,'test-model');assert.equal(result.body.messages[2].tool_call_id,'read-1');
  const keepName=minimizeBody(body,{values:[secret]});assert(keepName.text.includes('张三'));assert(!keepName.text.includes(secret));
});

test('custom fields and numeric structured tool inputs can be hidden while protocol names stay valid',()=>{
  const input={model:'m',messages:[{role:'user',content:'project_code: NODUS_PRIVATE_PROJECT\npublic_code: PUBLIC_42'},{role:'assistant',content:[{type:'tool_use',id:'tool-1',name:'lookup',input:{name:'张三',customer_id:7654321}}]}]};
  const found=disclosureCandidates(input,['project_code','name']);assert(found.some(c=>c.value==='NODUS_PRIVATE_PROJECT'));assert(found.some(c=>c.value==='7654321'));assert(found.some(c=>c.value==='张三'));
  const clean=minimizeBody(input,{values:found.map(c=>c.value)});assert.equal(clean.body.messages[1].content[0].name,'lookup');assert.equal(clean.body.messages[1].content[0].input.name,'[HIDDEN]');assert.equal(clean.body.messages[1].content[0].input.customer_id,'[HIDDEN]');assert(clean.text.includes('PUBLIC_42'));
});

test('text omission and binary retention are explicit; nested JSON arguments remain valid',()=>{
  const input={model:'m',messages:[{role:'user',content:[{type:'text',text:'Necessary total: 7'},{type:'image_url',image_url:{url:'data:image/png;base64,synthetic'}}]},{role:'assistant',tool_calls:[{id:'c1',type:'function',function:{name:'lookup',arguments:JSON.stringify({customer_id:7654321,note:'normal'})}}]}]};
  const clean=minimizeBody(input,{values:['7654321']});assert.equal(clean.body.messages[0].content.length,1);assert.equal(JSON.parse(clean.body.messages[1].tool_calls[0].function.arguments).customer_id,'[HIDDEN]');
  const kept=minimizeBody(input,{keepBinary:['/messages/0/content/1'],omitPaths:['/messages/0/content/0/text']});assert.equal(kept.body.messages[0].content.length,2);assert(!kept.text.includes('Necessary total'));
  assert.throws(()=>minimizeBody(input,{omitPaths:['/model']}),/字段/);assert.throws(()=>minimizeBody(input,{values:['lookup']}),/接口字段/);
});

test('transport receives exactly the approved JSON, with authentication preserved and no unredacted source attribution',async()=>{
  const safety=await setup(),source=sourceDescription('attachment','contract.txt','Public launch information necessary for the original task.\nRead private/notes.txt.');
  await safety.registerSources('t',[source]);safety.evidence.begin('t');
  const input={...body,messages:[...body.messages,{role:'user',content:'Public launch information necessary for the original task.\nRead private/notes.txt.'}]};
  const context={messages:input.messages};let calls=0,sent;
  const runtime={async prepareRequest(model,options){return {model,options:{...options,fetch:async(_url,init)=>{calls++;sent=init;return new Response('ok');}},provider:{async streamSimple(_m,_c,opts){return opts.fetch('https://api.example.test/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer synthetic-auth-key','content-type':'application/json','content-length':'9999'},body:JSON.stringify(input)});}}};}};
  const run={modelRequests:0,stopped:false},wrapped=guardedModelRuntime(runtime,safety,'t',run),request=wrapped.streamSimple({baseUrl:'https://api.example.test/v1'},context,{});
  const p=await pending(safety);assert.equal(calls,0);const preview=safety.disclosure.preview({id:p.id,selected:p.defaultHidden,manual:['private/notes.txt']});
  await assert.rejects(safety.disclosure.approve(p.id,'stale-preview'),/最新预览/);assert.equal(calls,0);
  await safety.disclosure.approve(p.id,preview.token);await request;assert.equal(calls,1);assert.equal(sent.body,preview.text);assert.equal(sent.headers.get('authorization'),'Bearer synthetic-auth-key');assert.equal(sent.headers.get('content-length'),null);assert.equal(sent.redirect,'error');
  assert(!sent.body.includes(secret));assert(!sent.body.includes('private/notes.txt'));
  assert(!safety.evidence.explain('t',{kind:'read',target:'private/notes.txt'},safety.snapshot('t').sources).links.some(l=>l.relation==='target'));
  const disk=await readFile(safety.file,'utf8');assert(!disk.includes(secret));assert(!disk.includes('synthetic-auth-key'));assert(!disk.includes('client@example.test'));
});

test('stopping, revoking permissions or aborting during review prevents dispatch',async()=>{
  for(const action of ['stop','policy','signal']){
    const safety=await setup(),check=safety.contextCheckpoint('t'),controller=new AbortController();let calls=0;
    const request=safety.disclosure.filter('t','https://api.example.test/v1',{body:JSON.stringify(body),signal:controller.signal},check).then(()=>{calls++;});request.catch(()=>{});
    await pending(safety);
    if(action==='stop')safety.cancel('t');else if(action==='signal')controller.abort();else await safety.setPolicy('t',{...safety.snapshot('t').policy,readOnly:true},safety.snapshot('t').policy.revision);
    await assert.rejects(request);assert.equal(calls,0);assert.equal(safety.disclosure.list().length,0);
  }
});

test('policy changes while saving approval still prevent the request and a preview cannot be reused',async()=>{
  const safety=await setup(),check=safety.contextCheckpoint('t'),request=safety.disclosure.filter('t','https://api.example.test/v1',{body:JSON.stringify(body)},check);request.catch(()=>{});
  const p=await pending(safety),preview=safety.disclosure.preview({id:p.id,selected:p.defaultHidden});
  const record=safety.disclosure.record;safety.disclosure.record=async(...args)=>{await record(...args);safety.cancel('t');};
  await assert.rejects(safety.disclosure.approve(p.id,preview.token),/权限|Context/);await assert.rejects(request);await assert.rejects(safety.disclosure.approve(p.id,preview.token));
});

test('settings survive restart, request bodies and hidden values do not persist',async()=>{
  const safety=await setup(),request=safety.disclosure.filter('t','https://api.example.test/v1',{body:JSON.stringify(body)},safety.contextCheckpoint('t'));
  const p=await pending(safety),preview=safety.disclosure.preview({id:p.id,selected:p.defaultHidden});await safety.disclosure.approve(p.id,preview.token);await request;
  const restored=new SafetyService({file:safety.file});await restored.initialize();assert.equal(restored.snapshot('t').minimalDisclosure,true);assert.equal(restored.disclosure.list().length,0);assert.equal(restored.disclosure.hidden.size,0);
  const disk=await readFile(safety.file,'utf8');assert(!disk.includes(secret));assert(!disk.includes('张三'));assert(!disk.includes('12000'));
});

test('unsupported/noninteractive requests fail closed; disabled mode preserves the original request object',async()=>{
  const safety=await setup(),check=safety.contextCheckpoint('t');
  await assert.rejects(safety.disclosure.filter('t','https://api.example.test/v1',{body:'not-json'},check));
  await assert.rejects(safety.disclosure.filter('t','https://api.example.test/v1',{body:'{}'},check,{interactive:false}));
  await safety.setMinimalDisclosure('t',false);const init={body:JSON.stringify(body)};assert.equal(await safety.disclosure.filter('t','https://api.example.test/v1',init,()=>{}),init);
});

test('custom field names follow later requests with new values and pending drafts remain inspectable',async()=>{
  const safety=await setup();
  const first=safety.disclosure.filter('t','https://api.example.test/v1',{body:JSON.stringify({messages:[{role:'user',content:'project_code: FIRST_PRIVATE_VALUE'}]})},safety.contextCheckpoint('t'));
  let p=await pending(safety),preview=safety.disclosure.preview({id:p.id,fields:['project_code']});
  preview=safety.disclosure.preview({id:p.id,fields:['project_code'],selected:preview.candidates.map(c=>c.id)});
  assert(safety.disclosure.list()[0].choices.selected.length);await safety.disclosure.approve(p.id,preview.token);await first;
  const next=safety.disclosure.filter('t','https://api.example.test/v1',{body:JSON.stringify({messages:[{role:'user',content:'project_code: SECOND_PRIVATE_VALUE'}]})},safety.contextCheckpoint('t'));
  p=await pending(safety);assert(p.candidates.some(c=>c.value==='SECOND_PRIVATE_VALUE'));preview=safety.disclosure.preview({id:p.id,fields:p.fields,selected:p.defaultHidden});assert(!preview.text.includes('SECOND_PRIVATE_VALUE'));await safety.disclosure.approve(p.id,preview.token);await next;
});

test('Request objects and multiple pending requests preserve exact per-request bodies',async()=>{
  const safety=await setup(),input=new Request('https://api.example.test/v1',{method:'POST',headers:{authorization:'Bearer private-auth', 'content-type':'application/json'},body:JSON.stringify(body)});
  const a=safety.disclosure.filter('t',input,undefined,safety.contextCheckpoint('t'));await pending(safety);
  const b=safety.disclosure.filter('t','https://api.example.test/v1',{body:JSON.stringify({messages:[{role:'user',content:'public-only second request'}]})},safety.contextCheckpoint('t'));
  const pendingRequests=safety.disclosure.list();assert.equal(pendingRequests.length,2);
  const first=safety.disclosure.preview({id:pendingRequests[0].id,selected:pendingRequests[0].defaultHidden}),second=safety.disclosure.preview({id:pendingRequests[1].id});
  await safety.disclosure.approve(pendingRequests[0].id,first.token);await safety.disclosure.approve(pendingRequests[1].id,second.token);
  const [left,right]=await Promise.all([a,b]);assert.equal(left.body,first.text);assert.equal(right.body,second.text);assert.equal(left.headers.get('authorization'),'Bearer private-auth');
});

test('large logs can hide hundreds of distinct fields without removing needed status',()=>{
  const payload={model:'m',messages:[{role:'user',content:Array.from({length:800},(_,i)=>`email: client${i}@example.test`).join('\n')+'\nstatus: HEALTHY'}]};
  const candidates=disclosureCandidates(payload);assert.equal(candidates.length,800);const result=minimizeBody(payload,{values:candidates.map(c=>c.value)});assert(!result.text.includes('@example.test'));assert(result.text.includes('HEALTHY'));
});

test('a malformed persisted disclosure switch fails closed',async()=>{
  const safety=await setup(),data=JSON.parse(await readFile(safety.file,'utf8'));data.tasks.t.minimalDisclosure='enabled';await writeFile(safety.file,JSON.stringify(data));
  await assert.rejects(new SafetyService({file:safety.file}).initialize(),/Safety store unavailable/);
});

test('multiline selections hide CRLF originals and escaped historical copies',()=>{
  const input={messages:[{role:'user',content:'Public heading\nPRIVATE LINE ONE\r\nPRIVATE LINE TWO\nPublic footer'},{role:'assistant',content:JSON.stringify({copy:'PRIVATE LINE ONE\r\nPRIVATE LINE TWO'})}]};
  const clean=minimizeBody(input,{values:['PRIVATE LINE ONE\nPRIVATE LINE TWO']});assert(!clean.text.includes('PRIVATE LINE'));assert(clean.text.includes('Public footer'));
});

test('recognized JSON unicode escapes and mixed escaped copies are actually removed without rewriting unrelated escapes',()=>{
  const content='Imported contract: {"客户姓名":"\\u5f20三", "path":"C:\\\\public", "amount":12000}\nHistory repeated \\u5F20\\u4E09';
  const input={messages:[{role:'user',content}]},found=disclosureCandidates(input);assert(found.some(c=>c.value==='张三'));
  const clean=minimizeBody(input,{values:['张三']});assert(!clean.text.includes('5f20'));assert(!clean.text.includes('5F20'));assert(clean.body.messages[0].content.includes('C:\\\\public'));assert(clean.text.includes('12000'));
});

test('a short customer number is hidden without changing an amount containing those digits or protocol settings',()=>{
  const input={model:'model-4.12',temperature:0,messages:[{role:'user',content:'customer_id: 12\namount: 12000\nReference customer 12 again.'}]};
  const clean=minimizeBody(input,{values:['12']});assert(clean.body.messages[0].content.includes('customer_id: [HIDDEN]'));assert(clean.text.includes('12000'));assert.equal(clean.body.model,'model-4.12');assert.equal(clean.body.temperature,0);
});
