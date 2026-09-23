import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from './helpers/electron-path.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-guardian-ui-'));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await (await import('./helpers/delivery-dialog.mjs')).configureDeliveryDialog(app);await page.locator('#requirementInput').waitFor();
 await app.evaluate(({ipcMain,app,BrowserWindow})=>{
  const bootstrap=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const result=await bootstrap(...args);result.model.configured=true;return result;});
  const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');
  const {PiService}=require(app.getAppPath()+'/backend/pi-service.mjs');const {fixture}=require(app.getAppPath()+'/tests/helpers/artifact-fixtures.mjs');
  PiService.prototype.requireModel=()=>{};
  PiService.prototype.runText=async function(args){
   if(args.phase==='options')return JSON.stringify({artifactType:'website',question:'选择方向',options:[1,2,3,4].map(id=>({id:String(id),title:`方向 ${id}`,description:'明确实现范围',effect:'可见结果',tradeoff:'需要检查',condition:'适合当前任务'}))});
   if(args.phase==='artifact'){await fixture('website',args.cwd);return 'files written';}
   if(args.phase==='requirement-audit'){
    BrowserWindow.getAllWindows()[0].webContents.send('forma:execution-event',{taskId:args.taskId,event:{type:'text_snapshot',phase:'requirement-audit',text:'{"results":[{"id":"INTERNAL_AUDIT_MARKER","quote":"<h1>代码证据</h1>"}]}'}});
    const ids=[...args.prompt.matchAll(/\[(req-[a-f0-9]+)\]/g)].map(match=>match[1]);
    return JSON.stringify({results:ids.map(id=>({id,status:'unverified',reason:'需要用户判断视觉与语义是否符合',evidence:[]}))});
   }
   throw Error(`unexpected phase ${args.phase}`);
  };
 });
 await page.reload();await page.locator('#requirementInput').fill('制作 Nodus 页面并持续保留要求');await page.locator('#submitRequirement').click();
 await page.locator('[data-choice="1"]').check();await page.locator('#submitDecision').click();await page.locator('#submitRating').waitFor();
 await page.getByText(/有效要求 · 2 项/).waitFor();
 await page.locator('#previewColumn').waitFor();await page.locator('#sitePreview').waitFor();assert.equal(await page.locator('#timeline').getByText(/INTERNAL_AUDIT_MARKER/).count(),0);
 await page.locator('#understandingButton').click();await page.getByText(/初始需求 · 持续生效/).waitFor();await page.getByText(/方案选择 · 持续生效/).waitFor();
 await page.locator('[data-toggle-requirement]').last().click();await page.getByText(/方案选择 · 已停用/).waitFor();await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
 await page.locator('#completionEvidence').click();await page.getByText('要求守护',{exact:true}).waitFor();await page.getByText(/待用户确认/).first().waitFor();
 const state=JSON.parse(await readFile(path.join(data,'state.json'),'utf8')),task=state.tasks[0];
 assert.equal(task.requirementLedger.items.length,2);assert.equal(task.disabledRequirementIds.length,1);assert.equal(task.versions.length,1);assert.equal(task.versions[0].completion.requirementAudit.status,'needs_review');
 console.log(JSON.stringify({passed:true,model:'mocked',realFiles:true,requirementsPersist:true,explicitRetirement:true,groundedReviewVisible:true}));
}finally{await app.close();}
