import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-evaluation-return-'));
await mkdir(path.join(data,'artifacts/t/v1'),{recursive:true});await writeFile(path.join(data,'artifacts/t/v1/index.html'),'<html><body>作品</body></html>');
await writeFile(path.join(data,'state.json'),JSON.stringify({activeTaskId:'t',settings:{},tasks:[{id:'t',title:'重复评价',requirement:'网站',artifactType:'website',stage:'accepted',currentVersionId:'v1',previewVersionId:'v1',versions:[{id:'v1',label:'V1'}],ratingDrafts:{v1:{scores:{需求符合度:3},comment:'保留文字'}},evaluations:[{id:'e1',versionId:'v1',scores:{需求符合度:3},comment:'保留文字'}],timeline:[]}]}));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#continueRevision').waitFor();
 await app.evaluate(({ipcMain})=>{globalThis.questions=0;globalThis.writes=0;const boot=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await boot(...args);b.model.configured=true;return b;});ipcMain.removeHandler('forma:next-decision');ipcMain.handle('forma:next-decision',()=>{globalThis.questions++;return {kind:'question',question:'哪种排版？',allowMultiple:false,options:['a','b','c','d'].map(id=>({id,title:id,description:'方式',effect:'效果',tradeoff:'代价',condition:'条件'}))};});ipcMain.removeHandler('forma:execute-artifact');ipcMain.handle('forma:execute-artifact',()=>{globalThis.writes++;throw Error('must not execute');});});
 await page.reload();
 for(let i=0;i<3;i++){await page.locator('#continueRevision').click();await page.locator('#submitRating').click();await page.locator('#submitRating').waitFor();await page.locator('#skipRating').click();await page.locator('#continueRevision').waitFor();}
 assert.equal(await app.evaluate(()=>globalThis.questions),0);assert.equal(await page.locator('#timeline .event').count(),0);
 await page.locator('#continueRevision').click();await page.locator('#ratingComment').fill('新的修改要求');await page.locator('#submitRating').click();await page.getByText('哪种排版？',{exact:true}).waitFor();assert.equal(await app.evaluate(()=>globalThis.questions),1);
 await page.locator('[data-choice="b"]').check();await page.locator('#returnToWork').click();await page.locator('#submitRating').waitFor();await page.locator('#previewColumn').waitFor();
 await page.locator('#adjustWithoutRating').click();await page.locator('[data-choice="b"]').waitFor();assert(await page.locator('[data-choice="b"]').isChecked());assert.equal(await app.evaluate(()=>globalThis.questions),1);
 await page.locator('#returnToWork').click();await page.locator('#acceptWork').click();await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
 const task=JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).tasks[0];assert.equal(task.evaluations.length,2);assert.equal(task.versions.length,1);assert.equal(task.stage,'accepted');assert.equal(task.decisionFlow.status,'abandoned');assert.equal(await app.evaluate(()=>globalThis.writes),0);
 const messages=await page.locator('#timeline .event').count();
 for(let i=0;i<3;i++){await page.locator('#continueRevision').click();await page.locator('#acceptWork').click();await page.locator('#continueRevision').waitFor();}
 assert.equal(await page.locator('#timeline .event').count(),messages);assert.equal(await app.evaluate(()=>globalThis.writes),0);
 console.log(JSON.stringify({passed:true,unchangedEvaluationNoCalls:true,changedEvaluationOnce:true,returnPreservesDraft:true,acceptEndsAdjustment:true,noUnexpectedExecution:true,model:'mocked'}));
}finally{await app.close();}
