import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-pause-ui-'));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
 await app.evaluate(({ipcMain})=>{
  const bootstrap=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await bootstrap(...args);b.model.configured=true;return b;});
  ipcMain.removeHandler('forma:generate-options');ipcMain.handle('forma:generate-options',()=>new Promise((_resolve,reject)=>{globalThis.rejectRun=reject;}));
  ipcMain.removeHandler('forma:stop-task');ipcMain.handle('forma:stop-task',()=>({stopped:true}));
 });
 await page.reload();await page.locator('#requirementInput').fill('制作网站');await page.locator('#submitRequirement').click();await page.locator('#stopExecution').click();
 assert.equal(await page.locator('#submitFlowDecision').count(),0);
 await app.evaluate(()=>globalThis.rejectRun(new Error('NODUS_STOPPED')));await page.locator('#submitFlowDecision').waitFor();
 assert.equal(await page.locator('[data-choice="adjust"]').count(),1);
 await page.locator('[data-choice="park"]').check();await page.locator('#submitFlowDecision').click();await page.locator('#resumeDecision').waitFor();
 await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();await page.reload();await page.locator('#resumeDecision').click();
 await page.locator('[data-choice="continue"]').check();await page.locator('#submitFlowDecision').click();await page.locator('#requirementInput').waitFor();assert.equal(await page.locator('#requirementInput').inputValue(),'制作网站');
 await page.locator('#submitRequirement').click();await page.locator('#stopExecution').waitFor();await app.evaluate(()=>globalThis.rejectRun(new Error('network test failure')));await page.locator('[data-choice="retry"]').waitFor();
 assert.equal(await page.locator('[data-choice="model"]').count(),1);
 assert.equal(await page.locator('#actionPanel').getByText('network test failure',{exact:false}).count(),0);
 console.log(JSON.stringify({passed:true,model:'mocked',waitsForActualStop:true,pauseOptions:true,parkRestart:true,originalDraft:true,failureOptions:true}));
}finally{await app.close();}
