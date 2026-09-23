import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {StorageService} from '../backend/storage.mjs';
import {ArtifactService} from '../backend/artifact-service.mjs';
import {finalizeArtifact} from '../backend/artifacts.mjs';
import {completionContract,assessCompletion,loadCompletion} from '../backend/completion.mjs';
import {checkToolBoundary} from '../backend/execution-boundary.mjs';
const sequence={kind:'sequence',text:'完整列出 0 到 10000',start:0,end:10000,file:'sequence.txt'};
async function setup(outputs){
  const storage=new StorageService(await mkdtemp(path.join(os.tmpdir(),'nodus-completion-')));await storage.initialize();let calls=0;
  const pi={executeArtifact:async(task,dir)=>{
    await writeFile(path.join(dir,'index.html'),'<html><body>交付</body></html>');
    await writeFile(path.join(dir,'sequence.txt'),outputs[Math.min(calls++,outputs.length-1)]);
    return finalizeArtifact(task,dir);
  }};
  return {storage,service:new ArtifactService(storage,pi),calls:()=>calls,task:{id:'t',artifactType:'website',requirement:'完整列出所有数字',completionContract:{conditions:[sequence]}}};
}
const complete=Array.from({length:10001},(_,i)=>i).join('\n');
test('execution cannot overwrite external evidence or application-owned verification files',async()=>{
  const {storage}=await setup([]);const dir=await storage.prepareVersion('t','v1');
  for(const file of ['../.completion/v1.json','artifact.json','inputs/1.csv','results.json'])assert.equal((await checkToolBoundary(dir,{toolName:'write',input:{path:file}})).block,true);
  assert.equal(await checkToolBoundary(dir,{toolName:'write',input:{path:'sequence.txt'}}),undefined);
  assert.equal((await checkToolBoundary(dir,{toolName:'bash',input:{command:'echo done'}})).block,true);
});
test('ellipsis output is rejected and never committed without repair permission',async()=>{
  const {service,storage,task,calls}=await setup(['0 1 2 ... 10000']);
  await assert.rejects(service.execute({task,versionId:'v1'}),/尚未满足/);
  assert.equal(calls(),1);assert.equal(await storage.artifactExists('t','v1'),false);
  assert((await readdir(storage.taskDir('t'))).some(f=>f.startsWith('.pending-')));
});
test('one authorized repair preserves failed evidence and verifies every integer',async()=>{
  const {service,storage,task,calls}=await setup(['0 1 ... 10000',complete]);
  const result=await service.execute({task:{...task,allowCompletionRepair:true},versionId:'v1'});
  assert.equal(calls(),2);assert.equal(result.completion.status,'passed');
  assert.equal(result.completion.attempts[0].status,'gaps');assert.equal(result.completion.attempts.length,2);
  assert.equal((await loadCompletion(storage,'t','v1')).status,'passed');
  await writeFile(path.join(storage.versionDir('t','v1'),'sequence.txt'),'0 1');
  assert.equal((await loadCompletion(storage,'t','v1')).status,'stale');
  await assert.rejects(service.restore({taskId:'t',sourceVersionId:'v1',versionId:'v2'}),/原完成条件/);
});
test('repair stops after one attempt even when model claims success',async()=>{
  const {service,task,calls}=await setup(['0 1 10000']);
  await assert.rejects(service.execute({task:{...task,allowCompletionRepair:true},versionId:'v1'}),/尚未满足/);assert.equal(calls(),2);
});
test('manual goals never pass automatically; revision and restore preserve original contract',async()=>{
  const {service,storage,task}=await setup([complete]);
  task.completionContract={conditions:[{kind:'manual',text:'视觉符合要求'}]};
  const v1=await service.execute({task,versionId:'v1'});assert.equal(v1.completion.status,'needs_review');
  const v2=await service.execute({task:{...task,completionContract:{conditions:[sequence]}},baseVersionId:'v1',versionId:'v2',proposal:{suggestion:'修改'}});
  assert.equal(v2.completion.contract.conditions[0].text,'视觉符合要求');
  const restored=await service.restore({taskId:'t',sourceVersionId:'v1',versionId:'v3'});assert.equal(restored.completion.versionId,'v3');assert.equal(restored.completion.status,'needs_review');
  assert.equal(JSON.parse(await readFile(path.join(storage.taskDir('t'),'.completion/v1.json'))).versionId,'v1');
});
test('duplicates, missing numbers and invalid paths fail independent checks',async()=>{
  const {storage}=await setup([]);const dir=await storage.prepareVersion('t','v1');const contract=completionContract({completionContract:{conditions:[{...sequence,end:2}]}});
  for(const text of ['0 1 1','0 2','0 1 2 3','0 1 ...']){await writeFile(path.join(dir,'sequence.txt'),text);assert.equal((await assessCompletion(dir,contract,'v1')).status,'gaps');}
  assert.throws(()=>completionContract({completionContract:{conditions:[{...sequence,file:'../test'}]}}),/越界/);
});
