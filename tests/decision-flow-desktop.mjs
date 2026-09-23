import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
import {fixture} from './helpers/artifact-fixtures.mjs';
import {localNode} from '../frontend/decision-flow.js';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-decision-ui-'));
const dir=path.join(data,'artifacts/t/v1');await mkdir(dir,{recursive:true});await fixture('website',dir);
const original=await readFile(path.join(dir,'index.html'),'utf8');
await writeFile(path.join(data,'state.json'),JSON.stringify({activeTaskId:'t',settings:{},tasks:[{id:'t',title:'动态选择',requirement:'修改页面',artifactType:'website',stage:'rating',currentVersionId:'v1',previewVersionId:'v1',versions:[{id:'v1',label:'V1'}]}]}));
const installed=process.env.NODUS_TEST_INSTALLED;
const app=await electron.launch({executablePath:installed||electronExecutable(),args:[...(installed?[]:['.']),`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await (await import('./helpers/delivery-dialog.mjs')).configureDeliveryDialog(app);await page.locator('#submitRating').waitFor();
 await app.evaluate(({ipcMain},node)=>{
  const bootstrap=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await bootstrap(...args);b.model.configured=true;return b;});
  globalThis.decisionRequests=[];globalThis.executions=[];
  ipcMain.removeHandler('forma:next-decision');ipcMain.handle('forma:next-decision',(_event,payload)=>{
    globalThis.decisionRequests.push(payload);
    if(payload.flow.history.length<=2||payload.flow.refine)return {...node,kind:'question',question:'页面视觉希望如何调整？',explanation:'依据已经选择的范围继续细化'};
    return {kind:'ready',summary:{changes:'调整用户选择的范围',preserve:'保留其余内容',verification:'预览及文件检查'}};
  });
  ipcMain.removeHandler('forma:execute-artifact');ipcMain.handle('forma:execute-artifact',(_event,payload)=>{globalThis.executions.push(payload);return {artifact:{type:'website'},verification:{status:'passed'},previewUrl:null};});
 },localNode('area','website'));
 await page.reload();await page.locator('#interruptTask').click();await page.locator('#submitFlowDecision').waitFor();
 assert.equal(await page.locator('[data-choice]').count(),4);assert.equal(await page.locator('[data-choice="continue"]').count(),1);
 await page.locator('[data-choice="adjust"]').check();assert.equal((await app.evaluate(()=>globalThis.decisionRequests)).length,0);
 await page.locator('#submitFlowDecision').click();await page.locator('[data-choice="visual"]').check();await page.locator('#submitFlowDecision').click();
 await page.waitForFunction(()=>document.querySelector('#actionTitle').textContent==='页面视觉希望如何调整？');
 const req=await app.evaluate(()=>globalThis.decisionRequests[0]);assert.equal(req.flow.history.at(-1).decision.selected[0].id,'visual');
 await page.locator('[data-choice="content"]').check();await page.locator('#submitFlowDecision').click();await page.locator('[data-choice="execute"]').waitFor();assert.equal((await app.evaluate(()=>globalThis.executions)).length,0);
 await page.locator('#previousFlowDecision').click();assert.equal(await page.locator('[data-choice="execute"]').count(),0);
 await page.locator('[data-choice="visual"]').check();await page.locator('#submitFlowDecision').click();await page.locator('[data-choice="execute"]').waitFor();
 await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();await page.reload();await page.locator('[data-choice="execute"]').waitFor();
 await page.locator('[data-choice="park"]').check();await page.locator('#submitFlowDecision').click();await page.locator('#resumeDecision').click();
 await page.locator('[data-choice="execute"]').check();await page.locator('#submitFlowDecision').click();await page.locator('#submitRating').waitFor();
 const execution=await app.evaluate(()=>globalThis.executions[0]);assert.equal(execution.proposal.status,'confirmed');assert.equal(execution.baseVersionId,'v1');assert(execution.proposal.invalidated.length);
 await page.locator('[data-rating]').first().locator('[data-score="2"]').click();await page.locator('#submitRating').click();await page.waitForFunction(()=>document.querySelector('#actionTitle').textContent==='页面视觉希望如何调整？');await page.locator('#submitFlowDecision').waitFor();assert.equal((await app.evaluate(()=>globalThis.decisionRequests.at(-1))).flow.trigger,'rating');
 await mkdir('test-results/decision-flow',{recursive:true});await page.screenshot({path:'test-results/decision-flow/question.png'});
 assert.equal(await readFile(path.join(dir,'index.html'),'utf8'),original);
 console.log(JSON.stringify({passed:true,model:'mocked',pauseMenu:true,adaptiveRequests:true,backInvalidates:true,reload:true,parkResume:true,explicitExecution:true,ratingFlow:true}));
}finally{await app.close();}
