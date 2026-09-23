import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {parseModeCommand,autonomousPlan} from '../frontend/agent-modes.js';
import {executeGoat} from '../backend/goat-service.mjs';
import {ArtifactService} from '../backend/artifact-service.mjs';
import {StorageService} from '../backend/storage.mjs';
import {finalizeArtifact} from '../backend/artifacts.mjs';
test('commands only match explicit prefixes and autonomous plans never mutate user selections',()=>{
 assert.deepEqual(parseModeCommand('/goat 制作报告'),{mode:'goat',message:'制作报告'});
 assert.deepEqual(parseModeCommand('/PLAN'),{mode:'plan',message:''});
 for(const text of ['解释 /goat','/goatish','https://x/plan'])assert.equal(parseModeCommand(text),null);
 const task={options:[{id:'a',title:'推荐'}],selectedOptionIds:[],recommendation:{optionIds:['a']}};
 assert.equal(autonomousPlan(task).source,'agent');assert.deepEqual(task.selectedOptionIds,[]);
 assert.throws(()=>autonomousPlan({...task,recommendation:{optionIds:['wrong']}}));
});
async function setup(alwaysFail=false){
 const storage=new StorageService(await mkdtemp(path.join(os.tmpdir(),'nodus-goat-')));await storage.initialize();let calls=0;
 const pi={emit:()=>{},executeArtifact:async(task,dir)=>{calls++;await writeFile(path.join(dir,'index.html'),'<html><body>result</body></html>');await writeFile(path.join(dir,'sequence.txt'),calls===1||alwaysFail?'0 ... 2':'0 1 2');return finalizeArtifact(task,dir);}};
 const service=new ArtifactService(storage,pi);
 const payload={authorization:'goat-submit',task:{id:'t',agentMode:'goat',artifactType:'website',requirement:'完整列出数字',completionContract:{conditions:[{kind:'sequence',text:'完整序列',file:'sequence.txt',start:0,end:2}]}},versionId:'v1'};
 return {storage,service,payload,calls:()=>calls};
}
test('goat repairs real incomplete files without weakening completion criteria',async()=>{
 const {storage,service,payload,calls}=await setup();const result=await executeGoat(service,payload);
 assert.equal(calls(),2);assert.equal(result.autonomy.attempts.length,2);assert.equal(result.completion.status,'passed');
 assert.equal(await readFile(path.join(storage.versionDir('t','v1'),'sequence.txt'),'utf8'),'0 1 2');
});
test('goat authorization and attempt limit are enforced and failures never publish',async()=>{
 const {storage,service,payload,calls}=await setup(true);
 await assert.rejects(executeGoat(service,{...payload,authorization:null}),/授权/);assert.equal(calls(),0);
 await assert.rejects(executeGoat(service,payload),/3\/3/);assert.equal(calls(),3);assert.equal(await storage.artifactExists('t','v1'),false);
});
test('goat stops immediately for missing materials or cancellation',async()=>{
 for(const message of ['需要数据材料：CSV','NODUS_STOPPED']){
  let calls=0;const service={cancelled:new Set(),execute:async()=>{calls++;throw Error(message);}};
  await assert.rejects(executeGoat(service,{authorization:'goat-submit',task:{id:'t',agentMode:'goat'}}));assert.equal(calls,1);
 }
});
