import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
import {localNode,emptyAnswer,commitDecision} from '../frontend/decision-flow.js';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-convergence-'));
const flow={schemaVersion:3,artifactType:'website',history:[],invalidated:[],current:localNode('area','website'),draft:emptyAnswer(),status:'parked',awaitingNext:true,baseVersionId:null,pendingId:null};
for(let i=0;i<49;i++){flow.draft={...emptyAnswer(),selectedOptionIds:['visual'],optionNotes:{visual:`selected-${i}`}};commitDecision(flow);}
await writeFile(path.join(data,'state.json'),JSON.stringify({activeTaskId:'task',settings:{},tasks:[{id:'task',title:'Convergence',requirement:'Create a website',artifactType:'website',stage:'paused',decisionFlow:flow,versions:[]}]}));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await (await import('./helpers/delivery-dialog.mjs')).configureDeliveryDialog(app);await page.locator('#resumeDecision').waitFor();
 await app.evaluate(({ipcMain,app})=>{
  const bootstrap=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await bootstrap(...args);b.model.configured=true;return b;});
  globalThis.questionCalls=0;ipcMain.removeHandler('forma:next-decision');ipcMain.handle('forma:next-decision',()=>{globalThis.questionCalls++;return {kind:'question',question:'第50题',allowMultiple:true,options:['visual','interaction','content','responsive'].map(id=>({id,title:id,description:'Description',effect:'Effect',tradeoff:'Tradeoff',condition:'Condition'}))};});
  ipcMain.removeHandler('forma:one-shot-chat');ipcMain.handle('forma:one-shot-chat',(_event,{message})=>{if(message.startsWith('先不要'))return '仅解释，不修改文件';if(message==='这个方案有什么区别？')return '这是只读方案解释';throw Error('Coding instruction must not reach chat');});
  globalThis.intentMessages=[];ipcMain.removeHandler('forma:classify-message');ipcMain.handle('forma:classify-message',(_event,{message})=>{globalThis.intentMessages.push(message);if(message==='模拟网络失败')throw Error('test network failure');if(message==='第二个')return {intent:'answer',selectedOptionIds:['interaction']};return {intent:message.startsWith('先不要')||message.endsWith('？')?'chat':'execute'};});
  const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');const {PiService}=require(app.getAppPath()+'/backend/pi-service.mjs');const {fixture}=require(app.getAppPath()+'/tests/helpers/artifact-fixtures.mjs');
  PiService.prototype.requireModel=()=>{};PiService.prototype.runText=async function(args){if(args.phase==='requirement-audit'){const ids=[...args.prompt.matchAll(/\[(req-[a-f0-9]+)\]/g)].map(match=>match[1]);return JSON.stringify({results:ids.map(id=>({id,status:'unverified',reason:'fixture review',evidence:[]}))});}globalThis.executionPrompt=args.prompt;await fixture('website',args.cwd);return 'Created real fixture files';};
 });
 await page.reload();await page.locator('#resumeDecision').click();await page.locator('#requestNextDecision').click();await page.getByText('第50题',{exact:true}).waitFor();
 assert.equal(await page.locator('[data-choice="execute"]').count(),0);assert.equal(await app.evaluate(()=>globalThis.questionCalls),1);
 await page.locator('#finishQuestions').click();await page.locator('[data-choice="execute"]').waitFor();
 await page.locator('#previousFlowDecision').click();await page.locator('#submitFlowDecision').click();await page.getByText('第50题',{exact:true}).waitFor();
 await page.locator('[data-choice="visual"]').check();await page.locator('#submitFlowDecision').click();await page.locator('[data-choice="execute"]').waitFor();assert.equal(await app.evaluate(()=>globalThis.questionCalls),2);
 await page.locator('#previousFlowDecision').click();assert.equal(await page.locator('[data-choice="visual"]').isChecked(),true);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,720));
 await page.waitForFunction(()=>innerWidth===1280);
 assert(await page.locator('.action-footer').evaluate(el=>el.scrollWidth<=el.clientWidth));
 await page.locator('#freeformInput').fill('这个方案有什么区别？');await page.locator('#submitFlowDecision').click();await page.getByText('这是只读方案解释',{exact:true}).waitFor();
 assert.equal(await page.locator('#freeformInput').inputValue(),'这个方案有什么区别？');assert.equal(await page.locator('[data-choice="visual"]').isChecked(),true);
 await page.locator('#freeformInput').fill('模拟网络失败');await page.locator('#submitFlowDecision').click();await page.getByText('请求识别失败，输入已保留，请重试或使用选项按钮继续。',{exact:true}).waitFor();assert.equal(await page.locator('#freeformInput').inputValue(),'模拟网络失败');
 await page.locator('#freeformInput').fill('');
 await page.locator('#freeformInput').fill('第二个');await page.locator('#submitFlowDecision').click();await page.locator('[data-choice="execute"]').waitFor();await page.locator('#previousFlowDecision').click();assert.equal(await page.locator('[data-choice="interaction"]').isChecked(),true);assert.equal(await page.locator('#freeformInput').inputValue(),'第二个');
 await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill('先不要编码，解释一下选择');await page.locator('#sendDialog').click();await page.getByText('仅解释，不修改文件',{exact:true}).waitFor();
 assert.equal(await app.evaluate(()=>Boolean(globalThis.executionPrompt)),false);
 await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill('就按照这个编码吧');await page.locator('#sendDialog').click();await page.locator('[data-choice="execute"]').waitFor();
 for(const message of ['开始做吧','把标题改成红色','不用再问了，按刚才的方案实现','implement it now']){
  await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill(message);await page.locator('#sendDialog').click();await page.locator('[data-choice="execute"]').waitFor();
 }
 assert((await app.evaluate(()=>globalThis.intentMessages)).includes('把标题改成红色'));
 await page.locator('#freeformInput').fill('不要执行，先暂存');await page.locator('[data-choice="park"]').check();const beforePark=await app.evaluate(()=>globalThis.intentMessages.length);await page.locator('#submitFlowDecision').click();await page.locator('#resumeDecision').click();assert.equal(await app.evaluate(()=>globalThis.intentMessages.length),beforePark);
 assert.equal(await app.evaluate(()=>Boolean(globalThis.executionPrompt)),false);
 await page.locator('[data-choice="execute"]').check();await page.locator('#submitFlowDecision').click();await page.locator('#submitRating').waitFor();
 const prompt=await app.evaluate(()=>globalThis.executionPrompt);assert.match(prompt,/selected-48/);assert.match(prompt,/把标题改成红色/);
 assert.match(await readFile(path.join(data,'artifacts/task/v1/index.html'),'utf8'),/<html>/);
 console.log(JSON.stringify({passed:true,model:'mocked',longPathRecovery:true,directCodingSkipsChat:true,explicitConfirmation:true,realFiles:true,backtracking:true,questionsReadOnly:true,intentFailurePreservesDraft:true,naturalChoiceMapping:true,parkOverridesText:true}));
}finally{await app.close();}
