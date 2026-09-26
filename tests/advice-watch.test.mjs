import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {AdviceWatchService,validateFindings} from '../backend/advice-watch.mjs';
import {sourceUrl,publicIPv4,pageText,fetchAdviceSource} from '../backend/advice-source.mjs';
const original='The desktop app supports offline editing for all users.';
const changed='Starting October, offline editing is no longer available.';
const input={title:'Editor A',advice:'Use Editor A for offline editing.',reasons:['Must work offline'],urls:['https://vendor.example/docs'],automatic:false};
const findings=(outcome,quote=original,previousQuote='')=>({findings:[{reasonIndex:0,outcome,sourceIndex:0,quote,previousQuote,explanation:'Offline access affects the planned trip.',nextStep:'Confirm the installed version.'}]});
async function setup(options={}){const dir=await mkdtemp(path.join(os.tmpdir(),'advice-test-'));const s=new AdviceWatchService({file:path.join(dir,'advice-watch.json'),fetchSource:async url=>({url,text:original}),review:async()=>findings('supported'),...options});await s.initialize();await s.save(input);return s;}
test('adoption persists independently of chats, validates input and keeps evidence grounded',async()=>{
 const s=await setup();const [r]=s.list();assert.equal(r.originalAdvice,input.advice);assert.equal(r.lastCheck,null);
 await assert.rejects(s.save({...input,urls:['http://vendor.example']}),/WATCH_URL/);
 await assert.rejects(s.save({...input,reasons:[]}),/WATCH_INPUT/);
 await s.check(r.id);assert.equal(s.list()[0].lastCheck.status,'no_issue_found');assert.equal(s.list()[0].unread,false);assert.equal(s.list()[0].snapshots,undefined);
 const restored=new AdviceWatchService({file:s.file});await restored.initialize();assert.equal(restored.list()[0].lastCheck.findings[0].quote,original);
 const raw=JSON.parse(await readFile(s.file,'utf8'));assert.equal(raw.records[0].snapshots[input.urls[0]].text,original);
 assert.throws(()=>validateFindings(findings('changed',changed,original),r,[{url:input.urls[0],text:changed}]),/WATCH_EVIDENCE/);
 assert.throws(()=>validateFindings(findings('supported','invented exact quote'),r,[{text:original}]),/WATCH_EVIDENCE/);
});
test('relevant changes alert once, source failures retain previous alerts, edits reset comparison',async()=>{
 const s=await setup();const id=s.list()[0].id;await s.check(id);
 s.fetchSource=async url=>({url,text:changed});s.review=async()=>findings('changed',changed,original);
 await s.check(id);let r=s.list()[0];assert.equal(r.unread,true);assert.equal(r.lastCheck.status,'attention');assert.equal(r.lastCheck.findings[0].previousQuote,original);
 await s.action(id,'acknowledge');await s.check(id);assert.equal(s.list()[0].unread,false);
 s.fetchSource=async()=>{throw Error('offline');};await s.check(id);r=s.list()[0];assert.equal(r.lastCheck.status,'unknown');assert.ok(r.lastAlert);
 await s.save({...input,id,reasons:['Must export files']});r=s.list()[0];assert.equal(r.lastCheck,null);assert.equal(r.history[0].reasons[0],'Must work offline');
 await s.action(id,'delete');assert.equal(s.list().length,0);
});
test('first-check contradiction is a possible original error; incomplete evidence never verifies all sources',async()=>{
 const s=await setup({review:async()=>findings('possible_error',original)});const id=s.list()[0].id;await s.check(id);assert.equal(s.list()[0].lastCheck.findings[0].outcome,'possible_error');
 s.review=async()=>findings('supported');s.fetchSource=async url=>({url,text:original,truncated:true});await s.check(id);assert.equal(s.list()[0].lastCheck.status,'unknown');
 s.review=async()=>{throw Error('no key');};await s.check(id);assert.equal(s.list()[0].lastCheck.status,'unknown');assert.equal(s.list()[0].lastCheck.error,'WATCH_REVIEW_UNAVAILABLE');
});
test('daily automatic checks respect opt-in, pause, restart and concurrent actions',async()=>{
 let now=1000,calls=0;const s=await setup({now:()=>now,fetchSource:async url=>{calls++;return {url,text:original};}});const id=s.list()[0].id;
 await s.tick();assert.equal(calls,0);await s.save({...input,id,automatic:true});await s.tick();assert.equal(calls,1);await s.tick();assert.equal(calls,1);
 now+=86400001;await s.action(id,'pause');await s.tick();assert.equal(calls,1);await s.action(id,'resume');await s.tick();assert.equal(calls,2);
 let resolve;s.fetchSource=()=>new Promise(r=>resolve=r);const checking=s.check(id);
 await assert.rejects(s.action(id,'delete'),/WATCH_BUSY/);await assert.rejects(s.check(id),/WATCH_BUSY/);resolve({url:input.urls[0],text:original});await checking;
 const restored=new AdviceWatchService({file:s.file,now:()=>now,fetchSource:async()=>{throw Error('should not run');}});await restored.initialize();await restored.tick();assert.equal(restored.list()[0].lastCheck.status,'no_issue_found');
});
test('public source boundary blocks private addresses and strips executable content',async()=>{
 for(const url of ['file:///etc/passwd','https://user:pass@site.example','https://127.0.0.1/a','https://[::1]','https://site.example:8443','https://machine.local'])assert.throws(()=>sourceUrl(url));
 for(const ip of ['127.0.0.1','10.2.3.4','169.254.169.254','172.16.1.1','192.168.1.1','100.64.9.27','::1','::ffff:127.0.0.1'])assert.equal(publicIPv4(ip),false);
 assert.equal(publicIPv4('8.8.8.8'),true);
 assert.equal(pageText('<h1>Public &amp; clear</h1><script>steal()</script><style>x{}</style>'),'Public & clear');
 await assert.rejects(fetchAdviceSource('https://vendor.example',{resolve:async()=>[{address:'127.0.0.1'}],request:()=>{throw Error('must not connect');}}),/WATCH_PRIVATE_SOURCE/);
});

test('one failed source does not become an all-clear and model invented evidence stays unknown',async()=>{
 const s=await setup();const id=s.list()[0].id;await s.save({...input,id,urls:[...input.urls,'https://other.example/docs']});
 s.fetchSource=async url=>{if(url.includes('other'))throw Error('unavailable');return {url,text:original};};
 await s.check(id);assert.equal(s.list()[0].lastCheck.status,'unknown');assert.equal(s.list()[0].lastCheck.sources[1].error,'WATCH_SOURCE_UNAVAILABLE');
 s.review=async()=>findings('supported','This quote was invented by a model');await s.check(id);assert.equal(s.list()[0].lastCheck.findings.length,0);assert.equal(s.list()[0].lastCheck.status,'unknown');
});

test('network requests pin DNS and validate redirects before connecting again',async()=>{
 const {EventEmitter}=await import('node:events');const {Readable}=await import('node:stream');let calls=0;
 const request=(url,options,callback)=>{
  calls++;options.lookup(url.hostname,{},(error,address,family)=>{assert.equal(error,null);assert.equal(address,'8.8.8.8');assert.equal(family,4);});
  const req=new EventEmitter();req.destroy=()=>{};
  queueMicrotask(()=>{const res=Readable.from([]);res.statusCode=302;res.headers={location:'https://internal.example/docs'};callback(res);});return req;
 };
 await assert.rejects(fetchAdviceSource(input.urls[0],{resolve:async host=>[{address:host==='internal.example'?'10.0.0.1':'8.8.8.8'}],request}),/WATCH_PRIVATE_SOURCE/);assert.equal(calls,1);
 for(const url of ['https://vendor.example/docs?api_key=private','https://vendor.example/docs?access_token=private'])assert.throws(()=>sourceUrl(url),/WATCH_URL/);
});
