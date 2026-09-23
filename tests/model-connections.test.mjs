import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ModelConnections} from '../backend/model-connections.mjs';
async function setup(){
  const pi={activeRuns:new Map(),status(){return {configured:Boolean(this.model),providerId:this.providerId,modelId:this.modelId};},async configure(c){if(c.apiKey==='bad')throw Error('401');this.providerId=c.providerId;this.modelId=c.modelId;this.model={id:c.modelId};this.modelRuntime={key:c.apiKey};return this.status();},async disconnect(){this.model=null;this.modelId=null;this.modelRuntime=null;this.providerId=null;}};
  const safe={isEncryptionAvailable:()=>true,encryptString:s=>Buffer.from(s).reverse(),decryptString:b=>Buffer.from(b).reverse().toString()};
  const file=path.join(await mkdtemp(path.join(os.tmpdir(),'nodus-connections-')),'credentials.json');
  return {pi,safe,file,manager:new ModelConnections(pi,safe,file)};
}
test('same-provider keys remain independent; switching uses correct runtime and exposes no keys',async()=>{
  const {pi,manager}=await setup();
  const a=await manager.add({providerId:'deepseek',modelId:'flash',apiKey:'key-a'});
  await manager.add({providerId:'deepseek',modelId:'pro',apiKey:'key-b'});
  assert.equal(manager.status().connections.length,2);
  await manager.activate(a.activeConnectionId);assert.equal(pi.modelRuntime.key,'key-a');
  assert(!JSON.stringify(manager.status()).includes('key-a'));
  await assert.rejects(manager.add({providerId:'qwen',modelId:'q',apiKey:'bad'}));assert.equal(manager.status().connections.length,2);
  pi.activeRuns.set('t',{});await assert.rejects(manager.activate(a.activeConnectionId),/停止任务/);
});
test('multiple encrypted profiles restore explicitly; session profiles do not persist',async()=>{
  const {pi,safe,file,manager}=await setup();
  const a=await manager.add({providerId:'minimax',modelId:'a',apiKey:'secret-a',remember:true});
  await manager.add({providerId:'qwen',modelId:'b',apiKey:'secret-b',remember:true});
  await manager.add({providerId:'deepseek',modelId:'c',apiKey:'session-secret'});
  const bytes=await readFile(file,'utf8');assert(!bytes.includes('secret'));assert.equal(JSON.parse(bytes).connections.length,2);
  const restarted=new ModelConnections(pi,safe,file);assert.equal(restarted.status().connections.length,0);
  await restarted.restore();assert.equal(restarted.status().connections.length,2);
  await restarted.remove(a.activeConnectionId);assert.equal(JSON.parse(await readFile(file)).connections.length,1);
});
test('legacy ciphertext migrates without deleting old entry; failed restore is atomic',async()=>{
  const {manager,file,safe}=await setup();
  await writeFile(file,JSON.stringify({providerId:'deepseek',modelId:'old',encryptedKey:safe.encryptString('legacy').toString('base64')}));
  await manager.add({providerId:'qwen',modelId:'new',apiKey:'new',remember:true});
  assert.equal(JSON.parse(await readFile(file)).connections.length,2);
  const before=manager.status();safe.decryptString=()=>{throw Error('denied');};
  await assert.rejects(manager.restore(),/原连接保持/);assert.deepEqual(manager.status(),before);
});
