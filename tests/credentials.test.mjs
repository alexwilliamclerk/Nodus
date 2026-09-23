import test from 'node:test';
import assert from 'node:assert/strict';
import {connectCredential} from '../backend/credential-service.mjs';
function setup(){
  let writes=0,calls=0,checks=0;
  const pi={model:'old',modelId:'old',providerId:'old',modelRuntime:{},configure:async()=>{calls++;pi.model='new';return {configured:true,modelId:'new'};}};
  const safeStorage={isEncryptionAvailable:()=>{checks++;return false;},encryptString:()=>{throw Error('unexpected');}};
  return {pi,safeStorage,save:async()=>{writes++;},stats:()=>({writes,calls,checks}),config:{providerId:'moonshotai-cn',apiKey:'test-only',remember:true}};
}
test('session-only connection never accesses keychain or writes credentials',async()=>{
  const s=setup();const result=await connectCredential({...s,config:{...s.config,remember:false}});
  assert.equal(result.remembered,false);assert.deepEqual(s.stats(),{writes:0,calls:1,checks:0});
});
test('omitting remember defaults to session-only even when keychain is denied',async()=>{
  const s=setup();delete s.config.remember;
  const result=await connectCredential(s);assert.equal(result.remembered,false);
  assert.deepEqual(s.stats(),{writes:0,calls:1,checks:0});
});
test('unavailable encryption leaves original connection unchanged and offers session-only route',async()=>{
  const s=setup();await assert.rejects(connectCredential(s),/取消.*在本机记住连接/);
  assert.equal(s.pi.model,'old');assert.equal(s.stats().calls,0);
});
test('saved credentials contain ciphertext only and preserve existing format',async()=>{
  const s=setup();let saved;
  s.safeStorage={isEncryptionAvailable:()=>true,encryptString:()=>Buffer.from('ciphertext')};
  await connectCredential({...s,save:async value=>{saved=value;}});
  assert.deepEqual(saved,{providerId:'moonshotai-cn',modelId:'new',encryptedKey:Buffer.from('ciphertext').toString('base64')});
  assert(!JSON.stringify(saved).includes('test-only'));
});
test('failed disk save rolls back the active model',async()=>{
  const s=setup();s.safeStorage={isEncryptionAvailable:()=>true,encryptString:()=>Buffer.from('ciphertext')};
  await assert.rejects(connectCredential({...s,save:async()=>{throw Error('disk error');}}),/已保留原连接/);
  assert.equal(s.pi.model,'old');
});
