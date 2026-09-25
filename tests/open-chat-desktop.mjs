import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from './helpers/electron-path.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-open-chat-'));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
  const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
  await page.locator('#requirementInput').fill('你好');
  await page.locator('#sendChat').click();
  await page.locator('#settingsModal').waitFor();
  assert.equal(await page.locator('#requirementInput').inputValue(),'你好','missing model preserves the draft');
  await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
  await page.locator('#closeSettings').click();
  await app.evaluate(({ipcMain})=>{
    const boot=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');
    ipcMain.handle('forma:bootstrap',async(...args)=>{const result=await boot(...args);result.model.configured=true;result.model.modelId='Test Model';return result;});
    ipcMain.removeHandler('forma:one-shot-chat');
    ipcMain.handle('forma:one-shot-chat',(_event,{task,message})=>`答复：${message}；之前聊过 ${task.temporaryConversations?.length||0} 次`);
    ipcMain.removeHandler('forma:generate-options');
    ipcMain.handle('forma:generate-options',(_event,{task})=>{
      if(task.requirement!=='制作一个网站')throw Error('Manual type detection did not use the confirmed request');
      return {artifactType:'website',question:'选一个方向',options:[1,2,3,4].map(id=>({id:String(id),title:`方案${id}`,description:'具体做法',effect:'预期效果',tradeoff:'取舍',condition:'适用'}))};
    });
  });
  await page.reload();await page.locator('#requirementInput').waitFor();
  assert.equal(await page.locator('#requirementInput').inputValue(),'你好');
  await page.locator('#sendChat').click();
  await page.getByText('答复：你好；之前聊过 0 次').waitFor();
  await page.locator('#requirementInput').fill('你刚才说了什么？');
  await page.locator('#sendChat').click();
  await page.getByText('答复：你刚才说了什么？；之前聊过 1 次').waitFor();
  await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
  let task=JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).tasks[0];
  assert.equal(task.stage,'input');assert.equal(task.artifactType,null);
  assert.equal(task.taskRules,undefined,'chat does not create task requirements');
  assert.equal(task.temporaryConversations.length,2);
  await page.locator('#detectTypeButton').click();
  await page.locator('#manageInput').fill('制作一个网站');
  await page.locator('#confirmManage').click();
  await page.locator('#submitDecision').waitFor();
  task=JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).tasks[0];
  assert.equal(task.artifactType,'website');
  assert.equal(task.options.length,4);
  console.log(JSON.stringify({passed:true,chatWithoutType:true,draftPreserved:true,history:true,manualDetection:true}));
}finally{await app.close();}
