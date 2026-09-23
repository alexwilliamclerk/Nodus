import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {localNode,emptyAnswer,commitDecision,backDecision,confirmedFlow,decisionAreas} from '../frontend/decision-flow.js';
import {PiService} from '../backend/pi-service.mjs';
import {ArtifactService} from '../backend/artifact-service.mjs';
import {StorageService} from '../backend/storage.mjs';
import {pendingWorkspace} from '../backend/task-workspace.mjs';
import {fixture} from './helpers/artifact-fixtures.mjs';
import {finalizeArtifact} from '../backend/artifacts.mjs';
const makeFlow=()=>({schemaVersion:3,trigger:'adjust',baseVersionId:null,pendingId:null,status:'answering',history:[],current:localNode('area','website'),draft:emptyAnswer(),invalidated:[]});
test('actual types have relevant areas and static website never offers backend execution',()=>{
 for(const type of Object.keys(decisionAreas))assert.equal(localNode('area',type).options.length,4);
 assert(!JSON.stringify(localNode('area','website')).includes('后端'));
 assert.notDeepEqual(localNode('area','report').options,localNode('area','python').options);
});
test('backtracking invalidates downstream confirmation and only submits selected branches',()=>{
 const f=makeFlow();f.draft.selectedOptionIds=['visual'];f.draft.optionNotes.visual='保留底色';commitDecision(f);
 f.current={...localNode('area','website'),question:'视觉如何修改？'};f.draft.freeform='只改配色';commitDecision(f);
 f.current=localNode('confirm');f.summary={changes:'配色',preserve:'文字',verification:'预览'};f.status='confirmed';f.draft.selectedOptionIds=['execute'];
 assert.equal(confirmedFlow(f).decisions.length,2);
 backDecision(f);assert.equal(f.history.length,1);assert.equal(f.summary,null);assert.equal(f.invalidated.length,1);assert.throws(()=>confirmedFlow(f),/最终确认/);
 f.draft.freeform='只改字体';commitDecision(f);assert(!JSON.stringify(f.history).includes('只改配色'));
 backDecision(f);backDecision(f);assert.deepEqual(f.draft.selectedOptionIds,['visual']);assert.equal(f.draft.optionNotes.visual,'保留底色');assert.equal(f.history.length,0);
});
test('next node generation is read-only and includes only submitted choices',async()=>{
 const pi=new PiService({piDir:'.',emit:()=>{}});pi.model={input:['text']};let request;
 pi.runText=async args=>{request=args;return JSON.stringify({...localNode('area','website'),kind:'question',explanation:'先定位范围'});};
 const flow=makeFlow();flow.draft.selectedOptionIds=['visual'];commitDecision(flow);
 await pi.nextDecision({id:'t',artifactType:'website',requirement:'修改'},flow);assert.deepEqual(request.tools,[]);assert.match(request.prompt,/页面视觉/);
 const confirmed=request.prompt.split('已确认路径：')[1].split('\n')[0];assert(!confirmed.includes('交互与动效'));
 pi.runText=async()=>JSON.stringify({kind:'ready',summary:{changes:'改',preserve:'保留',verification:'检查'}});
 await assert.rejects(pi.nextDecision({id:'t'},makeFlow()),/下一道/);
});
test('paused first version resumes a pending copy with preserved inputs and no successful fake version',async()=>{
 const storage=new StorageService(await mkdtemp(path.join(os.tmpdir(),'nodus-pending-flow-')));await storage.initialize();let calls=0;
 const pi={executeArtifact:async(task,dir,label)=>{
  if(calls++===0){await writeFile(path.join(dir,'draft.txt'),'先前工作');throw Error('NODUS_STOPPED');}
  assert.equal(await readFile(path.join(dir,'draft.txt'),'utf8'),'先前工作');await fixture('website',dir,label);return finalizeArtifact(task,dir);
 }};
 const service=new ArtifactService(storage,pi),task={id:'t',artifactType:'website',requirement:'保留先前工作'};
 await assert.rejects(service.execute({task,versionId:'v1'}),/NODUS_STOPPED/);assert.equal(await storage.artifactExists('t','v1'),false);
 const pending=await pendingWorkspace(storage,'t');assert(pending);
 const flow=makeFlow();flow.pendingId=pending.pendingId;flow.current=localNode('confirm');flow.summary={changes:'继续原任务',preserve:'已有文件',verification:'文件协议'};flow.status='confirmed';flow.draft.selectedOptionIds=['execute'];
 await assert.rejects(service.execute({task,versionId:'v1',proposal:flow,resumePending:true,pendingId:'wrong'}),/已变化/);
 const result=await service.execute({task,versionId:'v1',versionLabel:'V1',proposal:flow,resumePending:true,pendingId:pending.pendingId});assert.equal(result.artifact.type,'website');
 assert.equal(await readFile(path.join(pending.dir,'draft.txt'),'utf8'),'先前工作');assert.equal(await pendingWorkspace(storage,'t'),null);
});
