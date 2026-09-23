import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-stream-'));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
 await app.evaluate(({ipcMain,BrowserWindow})=>{
  const bootstrap=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await bootstrap(...args);b.model.configured=true;return b;});
  ipcMain.removeHandler('forma:generate-options');ipcMain.handle('forma:generate-options',async(_e,{task})=>{
   globalThis.streamTask=task.id;
   BrowserWindow.getAllWindows()[0].webContents.send('forma:execution-event',{taskId:task.id,event:{type:'text_snapshot',phase:'options',text:'正在整理需求'}});
   await new Promise(resolve=>{globalThis.finishStream=resolve;});
   return {artifactType:'report',clarification:'请补充报告资料',options:[]};
  });
 });
 await page.reload();await page.locator('#requirementInput').fill('写报告');await page.locator('#submitRequirement').click();
 await page.getByText('正在整理需求',{exact:true}).waitFor();assert.equal(await page.locator('#actionPanel').getByText('正在整理需求').count(),0);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('forma:execution-event',{taskId:globalThis.streamTask,event:{type:'text_snapshot',phase:'options',text:'正在整理需求，已收到目标'}}));
 await page.getByText('正在整理需求，已收到目标',{exact:true}).waitFor();
 await app.evaluate(()=>globalThis.finishStream());await page.locator('#requirementInput').waitFor();assert.equal(await page.locator('#liveResponse').count(),0);
 assert.equal(await page.locator('#timeline').getByText('请补充报告资料',{exact:true}).count(),1);
 console.log(JSON.stringify({passed:true,partialVisibleBeforeCompletion:true,composerClean:true,noDuplicateFinal:true,model:'mocked'}));
}finally{await app.close();}
