import {_electron as electron} from 'playwright';
import {mkdtemp,readFile,realpath} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-delivery-ui-')),output=await realpath(await mkdtemp(path.join(os.tmpdir(),'nodus-delivery-files-')));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
 await app.evaluate(({ipcMain,app,dialog,shell},output)=>{
  globalThis.cancelDirectory=true;globalThis.writes=0;globalThis.opened=[];dialog.showOpenDialog=async()=>({canceled:globalThis.cancelDirectory,filePaths:globalThis.cancelDirectory?[]:[output]});shell.openPath=async dir=>{globalThis.opened.push(dir);return '';};
  const boot=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await boot(...args);b.model.configured=true;return b;});
  const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');const {PiService}=require(app.getAppPath()+'/backend/pi-service.mjs');const {fixture}=require(app.getAppPath()+'/tests/helpers/artifact-fixtures.mjs');
  PiService.prototype.requireModel=()=>{};PiService.prototype.runText=async args=>{if(args.phase==='options')return JSON.stringify({artifactType:'report',options:[1,2,3,4].map(id=>({id:String(id),title:'方向'+id,description:'方式',effect:'效果',tradeoff:'代价',condition:'条件'}))});if(args.phase==='requirement-audit')return '{"results":[]}';globalThis.writes++;await fixture('report',args.cwd);return '已写入';};
 },output);
 await page.reload();await page.locator('#taskProjectSelect').selectOption('__new__');await page.locator('#manageInput').fill('我的项目');await page.locator('#confirmManage').click();
 await page.locator('#requirementInput').fill('制作报告');await page.locator('#submitRequirement').click();await page.locator('[data-choice="1"]').check();await page.locator('#submitDecision').click();assert.equal(await app.evaluate(()=>globalThis.writes),0);await page.locator('#submitDecision').waitFor();
 await app.evaluate(()=>{globalThis.cancelDirectory=false;});await page.locator('#submitDecision').click();await page.locator('#acceptWork').waitFor();await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
 let task=JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).tasks[0];assert(task.projectId);assert.equal(task.deliveryDirectory,output);assert(task.versions[0].delivery.directory.startsWith(output));assert.match(await readFile(task.versions[0].delivery.entry,'utf8'),/摘要/);
 await page.locator('#acceptWork').click();await page.locator('#openWorkDirectory').click();assert.equal((await app.evaluate(()=>globalThis.opened)).at(-1),task.versions[0].delivery.directory);
 await page.locator('#exportWork').click();await page.getByText(/V1 已导出到/).waitFor();await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();const second=JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).tasks[0];assert.notEqual(second.versions[0].delivery.directory,task.versions[0].delivery.directory);
 await page.reload();await page.locator('#openWorkDirectory').click();assert.equal((await app.evaluate(()=>globalThis.opened)).at(-1),second.versions[0].delivery.directory);assert.equal(await app.evaluate(()=>globalThis.writes),1);
 console.log(JSON.stringify({passed:true,directoryPromptBeforeWrite:true,cancelDoesNotExecute:true,projectSaved:true,realExport:true,acceptedDirectoryAccessible:true,reload:true,model:'mocked',dialogs:'mocked'}));
}finally{await app.close();}
