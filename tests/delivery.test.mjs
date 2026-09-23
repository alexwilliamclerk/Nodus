import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,symlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {StorageService} from '../backend/storage.mjs';
import {finalizeArtifact,prepareAnalysis} from '../backend/artifacts.mjs';
import {exportVersion,validateDeliveryDirectory} from '../backend/delivery-service.mjs';
import {fixture} from './helpers/artifact-fixtures.mjs';
test('all artifact types export real files without overwriting previous delivery',async()=>{
 const data=await mkdtemp(path.join(os.tmpdir(),'nodus-export-data-')),output=await mkdtemp(path.join(os.tmpdir(),'nodus-output-'));const storage=new StorageService(data);await storage.initialize();
 for(const type of ['website','report','presentation','python','analysis']){
  const dir=await storage.prepareVersion(type,'v1');if(type==='analysis')await prepareAnalysis({attachments:[{name:'data.csv',status:'read',text:'x\n1\n2'}]},dir);await fixture(type,dir);const artifact=await finalizeArtifact({artifactType:type},dir);
  const first=await exportVersion(storage,{taskId:type,versionId:'v1',directory:output});assert.deepEqual(await readFile(first.entry),await readFile(path.join(dir,artifact.entry)));assert(!first.files.includes('artifact.json'));
  await writeFile(first.entry,'user edited copy');const second=await exportVersion(storage,{taskId:type,versionId:'v1',directory:output});assert.notEqual(first.directory,second.directory);assert.equal(await readFile(first.entry,'utf8'),'user edited copy');assert.deepEqual(await readFile(second.entry),await readFile(path.join(dir,artifact.entry)));
 }
 await assert.rejects(validateDeliveryDirectory(storage,data));await assert.rejects(exportVersion(storage,{taskId:'../outside',versionId:'v1',directory:output}));await assert.rejects(exportVersion(storage,{taskId:'website',versionId:'.pending-v1',directory:output}));
 await symlink('/tmp',path.join(storage.versionDir('website','v1'),'link'));await assert.rejects(exportVersion(storage,{taskId:'website',versionId:'v1',directory:output}),/链接/);
});
