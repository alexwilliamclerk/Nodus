import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-task-rules-ui-'));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
 await app.evaluate(({ipcMain})=>{
  const boot=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await boot(...args);b.model.configured=true;return b;});
  globalThis.calls=[];ipcMain.removeHandler('forma:generate-options');ipcMain.handle('forma:generate-options',(_event,{task})=>{globalThis.calls.push(task);return {artifactType:'report',question:'选择方向',options:[1,2,3,4].map(id=>({id:String(id),title:`选择${id}`,description:'具体方式',effect:'效果',tradeoff:'代价',condition:'条件'}))};});
  ipcMain.removeHandler('forma:classify-message');ipcMain.handle('forma:classify-message',(_event,{task})=>{globalThis.calls.push(task);return {intent:'chat'};});
  ipcMain.removeHandler('forma:one-shot-chat');ipcMain.handle('forma:one-shot-chat',(_event,{task})=>{globalThis.calls.push(task);return '答疑内容不作为规则';});
 });
 await page.reload();await page.locator('#requirementInput').fill('制作报告\n禁止虚构数据');await page.locator('#submitRequirement').click();await page.locator('#submitDecision').waitFor();
 const initial=await app.evaluate(()=>globalThis.calls[0]);assert.equal(initial.taskRules.items.length,2);assert.equal(initial.taskRules.items[1].category,'prohibition');
 await page.locator('[data-choice="1"]').check();await page.locator('#freeformInput').fill('DRAFT_NOT_SUBMITTED');
 await page.locator('#understandingButton').click();assert.equal(await page.locator('[data-edit-rule]').count(),2);assert.equal(await page.locator('#explanationView').getByText('DRAFT_NOT_SUBMITTED').count(),0);
 await page.locator('[data-edit-rule]').first().click();await page.locator('#manageInput').fill('制作中文行业报告');await page.locator('#confirmManage').click();await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
 await page.reload();await page.locator('#submitDecision').waitFor();await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill('解释一下');await page.locator('#sendDialog').click();await page.getByText('答疑内容不作为规则',{exact:true}).waitFor();
 const last=await app.evaluate(()=>globalThis.calls.at(-1));assert.equal(last.taskRules.items[0].text,'制作中文行业报告');assert.equal(last.taskRules.history[0].before,'制作报告');assert(!JSON.stringify(last.taskRules).includes('DRAFT_NOT_SUBMITTED'));
 await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();const state=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));assert.equal(state.tasks[0].versions.length,0);assert.equal(state.tasks[0].originalRequirement,'制作报告\n禁止虚构数据');
 console.log(JSON.stringify({passed:true,model:'mocked',firstSubmissionExtracted:true,draftsExcluded:true,editsSurviveReload:true,chatKeepsRules:true,noExecution:true}));
}finally{await app.close();}
