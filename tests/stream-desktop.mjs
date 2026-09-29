import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-stream-'));
const evidence=path.join(process.cwd(),'test-results','thinking');await mkdir(evidence,{recursive:true});
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
 await app.evaluate(({ipcMain,BrowserWindow})=>{
  const bootstrap=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await bootstrap(...args);b.model.configured=true;return b;});
  ipcMain.removeHandler('forma:generate-options');ipcMain.handle('forma:generate-options',async(_e,{task})=>{
   globalThis.streamTask=task.id;
   await new Promise(resolve=>{globalThis.beginStream=resolve;});
   BrowserWindow.getAllWindows()[0].webContents.send('forma:execution-event',{taskId:task.id,event:{type:'text_snapshot',phase:'options',text:'正在整理需求'}});
   await new Promise(resolve=>{globalThis.finishStream=resolve;});
   return {artifactType:'report',clarification:'请补充报告资料',options:[]};
  });
 });
 await page.reload();await page.locator('#requirementInput').fill('写报告');await page.locator('#submitRequirement').click();
 await page.locator('#liveResponse .thinking-indicator').waitFor();
 assert.equal(await page.locator('#liveResponse .thinking-indicator').innerText(),'正在思考');
 assert.equal(await page.locator('#liveResponse .thinking-activity').innerText(),'正在生成方案');
 assert((await page.locator('#liveResponse').boundingBox()).width<300,'waiting status should fit its content');
 await app.evaluate(async()=>{while(!globalThis.beginStream)await new Promise(resolve=>setTimeout(resolve,5));globalThis.beginStream();});
 await page.getByText('正在整理需求',{exact:true}).waitFor();assert.equal(await page.locator('#actionPanel').getByText('正在整理需求').count(),0);
 assert.equal(await page.locator('#liveResponse .thinking-indicator').isHidden(),true);
 assert.equal(await page.locator('#liveResponse .thinking-activity').isHidden(),true);
 assert((await page.locator('#liveResponse').boundingBox()).width>300,'streaming output should have room to grow');
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('forma:execution-event',{taskId:globalThis.streamTask,event:{type:'text_snapshot',phase:'options',text:'正在整理需求，已收到目标'}}));
 await page.getByText('正在整理需求，已收到目标',{exact:true}).waitFor();
 await app.evaluate(()=>globalThis.finishStream());await page.locator('#requirementInput').waitFor();assert.equal(await page.locator('#liveResponse').count(),0);
 assert.equal(await page.locator('#timeline').getByText('请补充报告资料',{exact:true}).count(),1);
 await app.evaluate(({ipcMain})=>{
   ipcMain.removeHandler('forma:one-shot-chat');
   ipcMain.handle('forma:one-shot-chat',()=>new Promise((resolve,reject)=>{globalThis.pendingChat={resolve,reject};}));
 });
 await page.locator('#newTaskButton').click();await page.locator('#requirementInput').fill('你好');await page.locator('#sendChat').click();
 await page.locator('#liveResponse .thinking-indicator').waitFor();
 assert.equal(await page.locator('#liveResponse .thinking-indicator').innerText(),'正在思考');
 assert.equal(await page.locator('#liveResponse .thinking-activity').innerText(),'正在答复');
 await page.screenshot({path:path.join(evidence,'thinking-zh-CN.png')});
 await app.evaluate(async()=>{while(!globalThis.pendingChat)await new Promise(resolve=>setTimeout(resolve,5));globalThis.pendingChat.resolve('你好，已经收到。');globalThis.pendingChat=null;});
 await page.getByText('你好，已经收到。',{exact:true}).waitFor();assert.equal(await page.locator('#liveResponse').count(),0);
 await page.locator('#modelButton').click();await page.locator('#manageConnections').click();await page.locator('#languageSetting').selectOption('en-US');await page.locator('#closeSettings').click();
 await page.locator('#requirementInput').fill('Retry this');await page.locator('#sendChat').click();
 await page.locator('#liveResponse .thinking-indicator').waitFor();
 assert.equal(await page.locator('#liveResponse .thinking-indicator').innerText(),'Thinking…');
 assert.equal(await page.locator('#liveResponse .thinking-activity').innerText(),'Replying');
 await page.screenshot({path:path.join(evidence,'thinking-en-US.png')});
 await app.evaluate(async()=>{while(!globalThis.pendingChat)await new Promise(resolve=>setTimeout(resolve,5));globalThis.pendingChat.reject(Error('Connection closed'));globalThis.pendingChat=null;});
 await page.locator('#liveResponse').waitFor({state:'detached'});
 await page.locator('#timeline .error-panel').filter({hasText:'Connection closed'}).waitFor();
 console.log(JSON.stringify({passed:true,thinkingBeforeOutput:true,partialVisibleBeforeCompletion:true,chatThinking:true,bilingual:true,errorClearsThinking:true,composerClean:true,noDuplicateFinal:true,model:'mocked'}));
}finally{await app.close();}
