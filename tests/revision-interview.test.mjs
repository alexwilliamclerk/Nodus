import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {validateInterview,confirmedInterview} from '../frontend/revision-interview.js';
import {interviewFixture,fixture} from './helpers/artifact-fixtures.mjs';
import {StorageService} from '../backend/storage.mjs';
import {ArtifactService} from '../backend/artifact-service.mjs';
test('long suggestion alone cannot replace an eight-question interview',()=>{
 assert.throws(()=>validateInterview({hypothesis:'初步判断',suggestion:'直接修改'}),/8–30/);
 const p=interviewFixture();assert.equal(validateInterview(p).questions.length,8);p.questions.pop();assert.throws(()=>validateInterview(p),/8–30/);
});
test('all questions require answers and execution sees only user-selected options',()=>{
 const p=interviewFixture();assert.throws(()=>confirmedInterview(p),/请回答/);
 p.answers=Object.fromEntries(p.questions.map(q=>[q.id,{selectedOptionIds:['a'],optionNotes:{a:'只改文字',b:'不要执行这条'},freeform:''}]));
 p.answers.q8={selectedOptionIds:[],freeform:'最后一项保持不变'};
 const result=confirmedInterview(p);assert.equal(result.decisions.length,8);assert.equal(result.decisions[0].selected.length,1);assert.equal(result.decisions[0].selected[0].note,'只改文字');assert(!JSON.stringify(result).includes('不要执行这条'));
});
test('incomplete interview blocks before any file modification',async()=>{
 const storage=new StorageService(await mkdtemp(path.join(os.tmpdir(),'nodus-interview-')));await storage.initialize();const dir=await storage.prepareVersion('t','v1');await fixture('website',dir);
 let executed=false;const service=new ArtifactService(storage,{executeArtifact:async()=>{executed=true;}});
 await assert.rejects(service.execute({task:{id:'t'},baseVersionId:'v1',versionId:'v2',proposal:interviewFixture()}),/请回答/);
 assert.equal(executed,false);assert.deepEqual(await readdir(storage.taskDir('t')),['v1']);
});
