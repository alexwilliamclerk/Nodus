import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PiService,loadGuardianSkill,guardedSystemPrompt} from '../backend/pi-service.mjs';
import {StorageService} from '../backend/storage.mjs';
import {ArtifactService} from '../backend/artifact-service.mjs';
import {finalizeArtifact} from '../backend/artifacts.mjs';
import {buildRequirementLedger,activeRequirements} from '../frontend/requirements.js';
import {validateRequirementAudit} from '../backend/requirement-audit.mjs';

test('bundled guardian skill is valid, mandatory and composed above every role',async()=>{
 const skill=await loadGuardianSkill();assert.match(skill,/version: "1.0.0"/);assert.match(skill,/Silence or omission never cancels/);assert.match(skill,/Never describe partial work as complete/);assert.match(skill,/repetitive safety boilerplate/);
 const system=guardedSystemPrompt(skill,'ROLE_MARKER');assert(system.indexOf('# Nodus Requirement Guardian')<system.indexOf('ROLE_MARKER'));
  assert.throws(()=>guardedSystemPrompt(null,'role'),/拒绝启动/);
 const pi=new PiService({piDir:'.',emit:()=>{}});assert.equal(pi.status().guardianSkillVersion,null);pi.guardianPrompt=skill;assert.equal(pi.status().guardianSkillVersion,'1.0.0');
 const packageJson=JSON.parse(await readFile(new URL('../package.json',import.meta.url)));assert(packageJson.build.files.includes('skills/**/*'));
});

test('ledger persists confirmed requirements and only explicit retirement changes active state',()=>{
 const task={requirement:'完成完整页面',options:[{id:'a',title:'动效克制',description:'避免持续运动'},{id:'b',title:'高强度动画',description:'持续运动'}],selectedOptionIds:['a'],optionNotes:{a:'保留文字'},freeform:'不要外链'};
 const v1=buildRequirementLedger(task);assert.equal(activeRequirements(v1).length,3);assert(!JSON.stringify(v1).includes('高强度动画'));
 const v2=buildRequirementLedger({...task,selectedOptionIds:[],freeform:'',requirementLedger:v1},null,v1);assert.equal(activeRequirements(v2).length,3);
 const disabled=v1.items.find(item=>item.text.includes('不要外链')).id;
  const v3=buildRequirementLedger({...task,disabledRequirementIds:[disabled]},null,v2);assert.equal(activeRequirements(v3).length,2);assert.equal(v3.items.find(item=>item.id===disabled).status,'retired');
  const flow={schemaVersion:3,status:'answering',history:[],summary:{changes:'模型提出但用户尚未确认'}};
  assert(!JSON.stringify(buildRequirementLedger({requirement:'原要求'},flow)).includes('模型提出但用户尚未确认'));
  flow.status='confirmed';assert(JSON.stringify(buildRequirementLedger({requirement:'原要求'},flow)).includes('模型提出但用户尚未确认'));
});

test('grounded audit rejects invented evidence and requires one result per active requirement',()=>{
 const ledger=buildRequirementLedger({requirement:'标题必须是 Nodus'}),snapshot={files:[{file:'index.html',content:'<h1>Wrong title</h1>'}],truncated:false};
 const id=ledger.items[0].id;
 const invented=validateRequirementAudit({results:[{id,status:'conflict',reason:'wrong',evidence:[{file:'index.html',quote:'not in file'}]}]},ledger,snapshot);
 assert.equal(invented.results[0].status,'unverified');
 const grounded=validateRequirementAudit({results:[{id,status:'conflict',reason:'标题明确不同',evidence:[{file:'index.html',quote:'Wrong title'}]}]},ledger,snapshot);
 assert.equal(grounded.status,'conflict');assert.equal(grounded.results[0].evidence[0].file,'index.html');
});

async function serviceWithAudit(status){
 const storage=new StorageService(await mkdtemp(path.join(os.tmpdir(),'nodus-guardian-')));await storage.initialize();
 const pi={executeArtifact:async(task,dir)=>{await writeFile(path.join(dir,'index.html'),'<html><body><h1>Wrong title</h1></body></html>');return finalizeArtifact(task,dir);},auditRequirements:async task=>({schemaVersion:1,status,results:activeRequirements(task.requirementLedger).map(item=>({...item,status:status==='conflict'?'conflict':'unverified',reason:'fixture',evidence:status==='conflict'?[{file:'index.html',quote:'Wrong title'}]:[]}))})};
 return {storage,service:new ArtifactService(storage,pi)};
}

test('explicit requirement conflict keeps files unfinished and never publishes a version',async()=>{
 const {storage,service}=await serviceWithAudit('conflict');
 await assert.rejects(service.execute({task:{id:'task',artifactType:'website',requirement:'标题必须是 Nodus'},versionId:'v1'}),/明确冲突/);
 assert.equal(await storage.artifactExists('task','v1'),false);assert((await readdir(storage.taskDir('task'))).some(name=>name.startsWith('.pending-')));
 const evidence=JSON.parse(await readFile(path.join(storage.taskDir('task'),'.completion/v1.json'),'utf8'));assert.equal(evidence.status,'gaps');assert.equal(evidence.requirementAudit.status,'conflict');
});

test('unverified semantic requirements remain visible without pretending to pass',async()=>{
 const {storage,service}=await serviceWithAudit('needs_review');
 const result=await service.execute({task:{id:'task',artifactType:'website',requirement:'整体观感高级'},versionId:'v1'});
 assert.equal(result.completion.status,'needs_review');assert.equal(result.requirementAudit.status,'needs_review');assert.equal(await storage.artifactExists('task','v1'),true);
 const descriptor=JSON.parse(await readFile(path.join(storage.versionDir('task','v1'),'artifact.json'),'utf8'));assert.equal(descriptor.requirementLedger.items[0].text,'整体观感高级');
});

test('stopping during requirement review never publishes the artifact',async()=>{
 const storage=new StorageService(await mkdtemp(path.join(os.tmpdir(),'nodus-guardian-stop-')));await storage.initialize();
 const pi={executeArtifact:async(task,dir)=>{await writeFile(path.join(dir,'index.html'),'<html><body>partial</body></html>');return finalizeArtifact(task,dir);},auditRequirements:async()=>{throw Error('NODUS_STOPPED: review stopped');}};
 const service=new ArtifactService(storage,pi);
 await assert.rejects(service.execute({task:{id:'task',artifactType:'website',requirement:'完整交付'},versionId:'v1'}),/NODUS_STOPPED/);
 assert.equal(await storage.artifactExists('task','v1'),false);assert((await readdir(storage.taskDir('task'))).some(name=>name.startsWith('.pending-')));
});
