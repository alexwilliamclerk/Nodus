import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,symlink,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {StorageService} from '../backend/storage.mjs';
import {PiService} from '../backend/pi-service.mjs';
import {ArtifactService,withVersionContext} from '../backend/artifact-service.mjs';
import {pendingWorkspace} from '../backend/task-workspace.mjs';
import {previewPath} from '../backend/preview-path.mjs';
import {localNode,emptyAnswer,backDecision,commitDecision} from '../frontend/decision-flow.js';
import {fixture} from './helpers/artifact-fixtures.mjs';

async function setup(type){
 const storage=new StorageService(await mkdtemp(path.join(os.tmpdir(),'nodus-recovery-')));await storage.initialize();
 const pi=new PiService({piDir:storage.piDir,emit:()=>{}});pi.model={id:'mock'};
 pi.runText=async args=>{await fixture(type,args.cwd);return 'fixture';};
 return {storage,pi,service:new ArtifactService(storage,pi)};
}
const flow=(changes,baseVersionId='v1')=>({schemaVersion:3,status:'confirmed',baseVersionId,current:localNode('confirm','website'),draft:{...emptyAnswer(),selectedOptionIds:['execute']},history:[],invalidated:[],summary:{changes,preserve:'Other content',verification:'Inspect files'}});

test('preview confines decoded identifiers, files and symlinks to artifact files',async()=>{
 const {storage}=await setup('website');const dir=await storage.prepareVersion('task','v1');await fixture('website',dir);
 await writeFile(path.join(storage.dataDir,'canary.txt'),'not public');
 assert.equal(await previewPath(storage,'/task/v1/index.html'),path.join(dir,'index.html'));
 await writeFile(path.join(dir,'中文 文件.txt'),'content');
 assert.equal(await previewPath(storage,'/task/v1/'+encodeURIComponent('中文 文件.txt')),path.join(dir,'中文 文件.txt'));
 for(const url of ['/..%2F../task/canary.txt','/task/..%2F../canary.txt','/task/v1/..%2F..%2Fcanary.txt','/task/v1/%5c..%5ccanary.txt','/task/v1/%00','/task/v1/%ZZ','/task/.completion/v1.json'])await assert.rejects(previewPath(storage,url));
 await symlink(path.join(storage.dataDir,'canary.txt'),path.join(dir,'link.txt'));
 await assert.rejects(previewPath(storage,'/task/v1/link.txt'),/links/);
});

test('analysis replacement uses new CSV and removes obsolete copied inputs, preserving old versions',async()=>{
 const {storage,service}=await setup('analysis');
 const task={id:'data',artifactType:'analysis',requirement:'Analyze data',attachments:[{name:'old.json',status:'read',text:'[{"value":1}]'},{name:'extra.csv',status:'read',text:'value\n2\n'}]};
 await service.execute({task,versionId:'v1'});
 const original=await readFile(path.join(storage.versionDir('data','v1'),'results.json'),'utf8');
 const newer={...task,attachments:[{name:'new.csv',status:'read',text:'value\n100\n'}]};
 await service.execute({task:newer,versionId:'v2',baseVersionId:'v1',proposal:{suggestion:'Replace input'}});
 const result=JSON.parse(await readFile(path.join(storage.versionDir('data','v2'),'results.json'),'utf8'));
 assert.equal(result.inputs[0].numeric.value.mean,100);assert.equal(result.inputs.length,1);
 assert.deepEqual(await readdir(path.join(storage.versionDir('data','v2'),'inputs')),['1.csv']);
 assert.equal(await readFile(path.join(storage.versionDir('data','v1'),'results.json'),'utf8'),original);
 await service.execute({task:{...newer,attachments:[]},versionId:'v3',baseVersionId:'v2',proposal:{suggestion:'Explain'}});
 assert.equal(JSON.parse(await readFile(path.join(storage.versionDir('data','v3'),'results.json'),'utf8')).inputs[0].numeric.value.mean,100);
 await assert.rejects(service.execute({task:{...task,attachments:[{name:'bad.json',status:'read',text:'invalid'}]},versionId:'v4',baseVersionId:'v3',proposal:{suggestion:'Replace'}}));
 assert.equal(await storage.artifactExists('data','v4'),false);
});

test('resume after restart retains original confirmed instructions and repeated pauses',async()=>{
 const {storage,pi,service}=await setup('website');const task={id:'web',artifactType:'website',requirement:'Create website'};
 await service.execute({task,versionId:'v1'});
 const original=flow('UNIQUE_TITLE_RED');let prompt;
 pi.runText=async args=>{prompt=args.prompt;throw Error('NODUS_STOPPED');};
 await assert.rejects(service.execute({task:{...task,decisionFlow:original},versionId:'v2',baseVersionId:'v1',proposal:original}));
 for(let attempt=0;attempt<2;attempt++){
  const pending=await pendingWorkspace(storage,'web');
  const resumed={...flow('Continue original task'),pendingId:pending.pendingId,resumeOriginal:true};
  const restarted=new ArtifactService(new StorageService(storage.dataDir),pi);
  await assert.rejects(restarted.execute({task,versionId:'v2',baseVersionId:'v1',proposal:resumed,resumePending:true,pendingId:pending.pendingId}));
  assert.match(prompt,/UNIQUE_TITLE_RED/);
 }
 const pending=await pendingWorkspace(storage,'web');
 const changed={...flow('UNIQUE_NEW_BLUE'),pendingId:pending.pendingId};
 await assert.rejects(service.execute({task,versionId:'v2',baseVersionId:'v1',proposal:changed,resumePending:true,pendingId:pending.pendingId}));
 assert.match(prompt,/UNIQUE_NEW_BLUE/);assert.match(prompt,/UNIQUE_TITLE_RED/);
});

test('backtracking clears original-resume intent',()=>{
 const f={...flow('continue'),current:localNode('pause'),draft:{...emptyAnswer(),selectedOptionIds:['continue']},resumeOriginal:true};
 commitDecision(f);f.current=localNode('confirm');backDecision(f);assert.equal(f.resumeOriginal,false);
});

test('website read-only context includes stylesheet and interaction source',async()=>{
 const {storage,service}=await setup('website');const task={id:'web',artifactType:'website'};
 await service.execute({task,versionId:'v1'});const context=await withVersionContext(storage,task,'v1');
 assert.match(context.versionContext,/body \{color: black\}/);assert.match(context.versionContext,/document.body.dataset.ready/);
 const old=await storage.prepareVersion('legacy','v1');await fixture('website',old);
 const legacy=await withVersionContext(storage,{id:'legacy'},'v1');assert.match(legacy.versionContext,/body \{color: black\}/);assert.match(legacy.versionContext,/document.body.dataset.ready/);
});
