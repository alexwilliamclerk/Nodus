import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {SafetyService,defaultPolicy} from '../backend/safety-service.mjs';
import {WebSearchService} from '../backend/web-search.mjs';
import {fetchAdviceSource} from '../backend/advice-source.mjs';

async function setup(){const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-lifecycle-test-'));const safety=new SafetyService({file:path.join(dir,'safety.json')});await safety.initialize();return {dir,safety};}

test('development: revocation during authorization persistence stops search before transport',async()=>{
  const {dir,safety}=await setup();await safety.setPolicy('t',{...defaultPolicy(),destinations:['search|https://api.tavily.com']},0);
  let release,checked;const barrier=new Promise(r=>release=r),atCheck=new Promise(r=>checked=r);const record=safety.record.bind(safety);
  safety.record=async(id,event)=>{if(event.kind==='search'&&event.outcome==='allowed'){checked();await barrier;}return record(id,event);};
  let sent=0;const search=new WebSearchService({pi:{},safeStorage:{},file:path.join(dir,'search.json'),authorize:({taskId,...action})=>safety.authorize(taskId,action),request:async()=>{sent++;return {ok:true,text:async()=>'{"results":[]}'};}});
  await search.configure({mode:'separate',provider:'tavily',apiKey:'synthetic-test-key'});
  const run=search.search('SYNTHETIC_CANARY',{taskId:'t'});run.catch(()=>{});await atCheck;
  const p=safety.snapshot('t').policy;await safety.setPolicy('t',{...p,destinations:[]},p.revision);release();
  await assert.rejects(run,/NODUS_SAFETY/);assert.equal(sent,0);
});

test('development: revocation during DNS resolution stops the subsequent connection',async()=>{
  const {safety}=await setup();await safety.setPolicy('t',{...defaultPolicy(),destinations:['web|https://public.example']},0);let connections=0;
  await assert.rejects(fetchAdviceSource('https://public.example/page?request=synthetic',{
    authorize:url=>safety.authorize('t',{kind:'web',target:new URL(url).origin,payload:url}),
    resolve:async()=>{const p=safety.snapshot('t').policy;await safety.setPolicy('t',{...p,destinations:[]},p.revision);return [{address:'8.8.8.8'}];},
    request:()=>{connections++;throw Error('Transport must not run');},
  }),/NODUS_SAFETY/);assert.equal(connections,0);
});

test('dispatch grant is not valid for a different operation payload',async()=>{
  const {safety}=await setup();const grant=await safety.authorize('t',{kind:'write',target:'result.md',payload:{content:'approved'}});
  assert.equal(grant.assertCurrent({kind:'write',target:'result.md',payload:{content:'approved'}}),true);
  assert.throws(()=>grant.assertCurrent({payload:{content:'changed'}}),/changed operation/);
  assert.throws(()=>grant.assertCurrent({target:'another.md'}),/changed operation/);
});
