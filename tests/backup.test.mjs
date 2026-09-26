import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,mkdir,symlink} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import JSZip from 'jszip';
import {StorageService} from '../backend/storage.mjs';
import {exportBackup} from '../backend/backup.mjs';
async function setup(){const root=await mkdtemp(path.join(os.tmpdir(),'nodus-backup-'));const storage=new StorageService(path.join(root,'data'));await storage.initialize();return {storage,target:path.join(root,'backup.zip')};}
test('backup preserves drafts, archived chats, ratings and real versions while excluding credentials',async()=>{
 const {storage,target}=await setup();const state={activeTaskId:'t',tasks:[{id:'t',archivedAt:'today',requirement:'需求',freeform:'未提交草稿',timeline:[{type:'user',text:'你好'}],attachments:[{name:'data.csv',status:'read',text:'x\n1'}],evaluations:[{versionId:'v1',scores:{清晰度:4}}],versions:[{id:'v1',previewUrl:'http://127.0.0.1:1/old'}]}],settings:{apiKey:'not-for-export'}};
 await storage.saveState(state);const dir=await storage.prepareVersion('t','v1');await writeFile(path.join(dir,'report.md'),'# 正文');await writeFile(storage.credentialPath,'private-credential');await writeFile(path.join(storage.piDir,'auth.json'),'private-auth');
 await mkdir(path.join(storage.taskDir('t'),'.pending-test'));await writeFile(path.join(storage.taskDir('t'),'.pending-test/draft.txt'),'未完成');
 const before=await readFile(storage.statePath);await exportBackup(storage,target,{version:'test'});const zip=await JSZip.loadAsync(await readFile(target));
 const saved=JSON.parse(await zip.file('state.json').async('string'));assert.equal(saved.tasks[0].freeform,'未提交草稿');assert.equal(saved.tasks[0].evaluations[0].scores.清晰度,4);assert.equal(saved.settings.apiKey,undefined);assert.equal(saved.tasks[0].versions[0].previewUrl,undefined);
 assert.equal(await zip.file('artifacts/t/v1/report.md').async('string'),'# 正文');assert(zip.file('artifacts/t/.pending-test/draft.txt'));assert(!Object.keys(zip.files).some(f=>/credentials|auth\.json/.test(f)));assert(before.equals(await readFile(storage.statePath)));
});
test('running tasks and unsafe destination are rejected without replacing existing backup',async()=>{
 const {storage,target}=await setup();await writeFile(target,'original');await storage.saveState({tasks:[{id:'t',operation:{status:'running'}}]});
 await assert.rejects(exportBackup(storage,target),/停止/);assert.equal(await readFile(target,'utf8'),'original');
 await assert.rejects(exportBackup(storage,path.join(storage.dataDir,'backup.zip')),/之外/);
});
test('missing files are reported and symlinked workspaces are rejected',async()=>{
 const {storage,target}=await setup();await storage.saveState({tasks:[{id:'t',versions:[{id:'v1'}]}]});
 const result=await exportBackup(storage,target);assert.equal(result.warnings.length,1);
 await symlink(path.dirname(target),storage.taskDir('t'),'dir');await assert.rejects(exportBackup(storage,target),/符号链接/);
});
test('backup preserves adopted advice and check evidence without credential fields',async()=>{
 const {storage,target}=await setup();await writeFile(path.join(storage.dataDir,'advice-watch.json'),JSON.stringify({schemaVersion:1,records:[{id:'watch',title:'My editor',reasons:['offline'],apiKey:'private',lastCheck:{status:'unknown'},snapshots:{}}]}));
 await exportBackup(storage,target);const zip=await JSZip.loadAsync(await readFile(target));const watches=JSON.parse(await zip.file('advice-watch.json').async('string'));assert.equal(watches.records[0].reasons[0],'offline');assert.equal(watches.records[0].apiKey,undefined);
});
