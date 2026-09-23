import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-blank-chat-'));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
 await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill('你好');await page.locator('#sendDialog').click();await page.locator('#settingsModal').waitFor();await page.locator('#closeSettings').click();assert.equal(await page.locator('#dialogInput').inputValue(),'你好');
 await app.evaluate(({ipcMain})=>{
  const boot=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await boot(...args);b.model.configured=true;return b;});
  ipcMain.removeHandler('forma:classify-message');ipcMain.handle('forma:classify-message',(_event,{message})=>({intent:message==='你好'?'chat':'execute'}));
  ipcMain.removeHandler('forma:one-shot-chat');ipcMain.handle('forma:one-shot-chat',()=> '可以直接聊天');
  ipcMain.removeHandler('forma:generate-options');ipcMain.handle('forma:generate-options',()=>({artifactType:'presentation',clarification:'请提供演示主题',options:[]}));
 });
 await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();await page.reload();await page.locator('#sendDialog').click();await page.getByText('可以直接聊天',{exact:true}).waitFor();await page.locator('#requirementInput').waitFor();assert.equal(await page.locator('#requirementInput').inputValue(),'');
 assert.match(await page.locator('#artifactTypeSelect option[value="presentation"]').textContent(),/PPT/);
 await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill('制作PPT');await page.locator('#sendDialog').click();await page.getByText('请提供演示主题',{exact:true}).waitFor();assert.equal(await page.locator('#artifactTypeSelect').inputValue(),'presentation');
 console.log(JSON.stringify({passed:true,blankChat:true,missingModelKeepsDraft:true,executionRoutesToPlanning:true,pptLabel:true,model:'mocked'}));
}finally{await app.close();}
