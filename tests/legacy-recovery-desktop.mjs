import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
import {localNode,emptyAnswer,commitDecision} from '../frontend/decision-flow.js';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-legacy-loop-'));
const original={schemaVersion:3,baseVersionId:'v2',status:'confirmed',history:[],invalidated:[],current:localNode('area','website'),draft:emptyAnswer(),artifactType:'website'};
for(let i=0;i<24;i++){original.draft={...emptyAnswer(),freeform:`保留要求${i}`};commitDecision(original);}
original.current=localNode('confirm');original.summary={changes:'执行完整选择'};
await mkdir(path.join(data,'artifacts/t/v2'),{recursive:true});await writeFile(path.join(data,'artifacts/t/v2/index.html'),'<html><body>existing</body></html>');
await writeFile(path.join(data,'state.json'),JSON.stringify({activeTaskId:'t',tasks:[{id:'t',title:'旧任务',requirement:'网站',artifactType:'website',stage:'decision',currentVersionId:'v2',previewVersionId:'v2',versions:[{id:'v2',label:'V2'}],timeline:[{type:'agent',text:'这条决策路径已较长，已暂存'}],operation:{status:'error',phase:'artifact'},decisionFlowHistory:[original],decisionFlow:{schemaVersion:3,baseVersionId:'v2',history:[],current:localNode('failure'),draft:emptyAnswer(),status:'answering'}}],settings:{}}));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await (await import('./helpers/delivery-dialog.mjs')).configureDeliveryDialog(app);await page.locator('[data-choice="execute"]').waitFor();
 await app.evaluate(({ipcMain})=>{globalThis.executions=[];ipcMain.removeHandler('forma:execute-artifact');ipcMain.handle('forma:execute-artifact',(_event,payload)=>{globalThis.executions.push(payload);return {artifact:{type:'website'},previewUrl:null};});});
 await page.locator('[data-choice="execute"]').check();await page.locator('#submitFlowDecision').click();await page.locator('#settingsModal').waitFor();assert.equal((await app.evaluate(()=>globalThis.executions)).length,0);
 await page.locator('#closeSettings').click();await page.locator('[data-choice="execute"]').waitFor();
 await app.evaluate(({ipcMain})=>{const boot=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await boot(...args);b.model.configured=true;return b;});});
 await page.reload();await page.locator('[data-choice="execute"]').check();await page.locator('#submitFlowDecision').click();await page.locator('#submitRating').waitFor();const calls=await app.evaluate(()=>globalThis.executions);assert.equal(calls.length,1);assert.equal(calls[0].proposal.history.length,24);assert.equal(calls[0].baseVersionId,'v2');
 console.log(JSON.stringify({passed:true,legacy24Recovered:true,missingModelOpensSettings:true,noRetryLoop:true,executionReceives24Choices:true,model:'mocked'}));
}finally{await app.close();}
