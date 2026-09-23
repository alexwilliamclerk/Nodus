import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-recovery-ui-'));
const launch=()=>electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
let app=await launch();
try{
 let page=await app.firstWindow();await (await import('./helpers/delivery-dialog.mjs')).configureDeliveryDialog(app);await page.locator('#requirementInput').waitFor();
 await app.evaluate(({ipcMain,app})=>{
  const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');
  const {PiService}=require(app.getAppPath()+'/backend/pi-service.mjs');
  const {fixture}=require(app.getAppPath()+'/tests/helpers/artifact-fixtures.mjs');
  const bootstrap=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');
  ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await bootstrap(...args);b.model.configured=true;return b;});
  PiService.prototype.requireModel=()=>{};
  PiService.prototype.runText=async function(args){
   if(args.phase==='options')return JSON.stringify({artifactType:'website',options:[1,2,3,4].map(id=>({id:String(id),title:'Choice '+id,description:'Description',effect:'Effect',tradeoff:'Tradeoff',condition:'Condition'}))});
   if(args.phase==='requirement-audit'){const ids=[...args.prompt.matchAll(/\[(req-[a-f0-9]+)\]/g)].map(match=>match[1]);return JSON.stringify({results:ids.map(id=>({id,status:'unverified',reason:'fixture review',evidence:[]}))});}
   await new Promise(resolve=>{globalThis.finishRecovery=resolve;});
   await fixture('website',args.cwd);return 'Fixture complete';
  };
 });
 await page.reload();await page.locator('#requirementInput').fill('Build a website');await page.locator('#submitRequirement').click();
 await page.locator('[data-choice="1"]').check();await page.locator('#submitDecision').click();
 await page.waitForFunction(()=>Boolean(document.querySelector('#liveResponse')));
 if(process.platform==='darwin'){
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
  assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()),false);
 }
 // Wait until the mock has actually entered execution before completing it.
 for(let i=0;i<100;i++){if(await app.evaluate(()=>Boolean(globalThis.finishRecovery)))break;await page.waitForTimeout(20);}
 await app.evaluate(()=>globalThis.finishRecovery());
 await page.locator('#submitRating').waitFor({state:'attached'});
 if(process.platform==='darwin')await app.evaluate(({app})=>app.emit('activate'));
 await page.locator('#submitRating').waitFor();await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
 let state=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));const task=state.tasks[0];
 assert.equal(task.operation.status,'success');assert.equal(task.versions.length,1);
 assert.match(await readFile(path.join(data,'artifacts',task.id,'v1/index.html'),'utf8'),/<html>/);
 const boot=await app.evaluate(({ipcMain})=>ipcMain._invokeHandlers.get('forma:bootstrap')({}));
 await writeFile(path.join(data,'canary.txt'),'PRIVATE_FIXTURE');
 const response=await fetch(`${boot.previewOrigin}/..%2F../${encodeURIComponent(path.basename(data))}/canary.txt`);assert.equal(response.status,404);
 assert.equal((await fetch(task.versions[0].previewUrl)).status,200);
 await app.close();
 const completionPath=path.join(data,'artifacts',task.id,'.completion/v1.json');await writeFile(completionPath,'{');
 app=await launch();page=await app.firstWindow();await page.locator('#submitRating').waitFor();
 const restarted=await app.evaluate(({ipcMain})=>ipcMain._invokeHandlers.get('forma:bootstrap')({}));
 assert.equal(restarted.state.tasks[0].versions[0].completion.status,'unreadable');
 assert.equal(restarted.state.tasks[0].versions[0].artifact.type,'website');
 assert.equal(await readFile(completionPath,'utf8'),'{');
 assert.equal((await fetch(restarted.state.tasks[0].versions[0].previewUrl)).status,200);
 console.log(JSON.stringify({passed:true,model:'mocked',artifactFiles:'real',macCloseRetainsExecution:process.platform==='darwin',traversalBlocked:true,corruptEvidenceDoesNotBlockStartup:true,restartPreview:true}));
}finally{await app.close();}
