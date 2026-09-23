import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
import {fixture} from './helpers/artifact-fixtures.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-scroll-cadence-'));
const dir=path.join(data,'artifacts/t/v1');await mkdir(dir,{recursive:true});await fixture('website',dir);
await writeFile(path.join(data,'state.json'),JSON.stringify({activeTaskId:'t',settings:{},tasks:[{id:'t',requirement:'网站',artifactType:'website',stage:'rating',currentVersionId:'v1',previewVersionId:'v1',versions:[{id:'v1',label:'V1'}],timeline:Array.from({length:40},(_,i)=>({type:'agent',text:`消息${i}\n`+'历史内容\n'.repeat(8)}))}]}));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await (await import('./helpers/delivery-dialog.mjs')).configureDeliveryDialog(app);await page.locator('#submitRating').waitFor();
 const bottom=()=>page.waitForFunction(()=>{const p=document.querySelector('#recordPanel');return p.scrollHeight-p.clientHeight-p.scrollTop<3;});
 await bottom();
 await app.evaluate(({ipcMain,app})=>{
  const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');const {PiService}=require(app.getAppPath()+'/backend/pi-service.mjs');const {fixture}=require(app.getAppPath()+'/tests/helpers/artifact-fixtures.mjs');const {localNode}=require(app.getAppPath()+'/frontend/decision-flow.js');
  const boot=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await boot(...args);b.model.configured=true;return b;});
  globalThis.writes=0;PiService.prototype.requireModel=()=>{};PiService.prototype.runText=async args=>{
   if(args.phase==='decision')return JSON.stringify({...localNode('area','website'),kind:'question',question:'继续修改哪一项？'});
   if(args.phase==='requirement-audit')return '{"results":[]}';
   if(args.phase==='revision'){globalThis.writes++;await fixture('website',args.cwd,'CHECKPOINT');return '完成写入';}
   throw Error(args.phase);
  };
 });
 await page.reload();await page.locator('#submitRating').waitFor();await bottom();
 // Burst growth plus late composer layout must remain pinned.
 await page.locator('#timeline').evaluate(el=>el.insertAdjacentHTML('beforeend','<p>'+('流式内容<br>'.repeat(180))+'</p>'));await bottom();
 await page.locator('#dynamicAction').evaluate(el=>el.style.height='160px');await bottom();
 await page.locator('#recordPanel').hover();await page.mouse.wheel(0,-800);await page.locator('#jumpToLatest').waitFor();
 const top=await page.locator('#recordPanel').evaluate(el=>el.scrollTop);
 await page.locator('#timeline').evaluate(el=>el.insertAdjacentHTML('beforeend','<p>'+('继续输出<br>'.repeat(60))+'</p>'));await page.waitForTimeout(150);
 assert(Math.abs((await page.locator('#recordPanel').evaluate(el=>el.scrollTop))-top)<3);
 await page.locator('#jumpToLatest').click();await bottom();
 await page.locator('#modelButton').click();await page.locator('#manageConnections').click();await page.locator('#previewEveryInput').selectOption('3');await page.locator('#closeSettings').click();
 await page.locator('#adjustWithoutRating').click();
 for(let i=0;i<2;i++){await page.locator('[data-choice="visual"]').check();await page.locator('#submitFlowDecision').click();await page.getByText('继续修改哪一项？',{exact:true}).waitFor();}
 assert.equal(await app.evaluate(()=>globalThis.writes),0);
 // Reload keeps progress, but performs no automatic write on its own.
 await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();await page.reload();await page.locator('#submitFlowDecision').waitFor();assert.equal(await app.evaluate(()=>globalThis.writes),0);
 await page.locator('[data-choice="content"]').check();await page.locator('#submitFlowDecision').click();await page.locator('#submitRating').waitFor();
 assert.equal(await app.evaluate(()=>globalThis.writes),1);await page.locator('#previewColumn').waitFor();await page.locator('#sitePreview').waitFor();await page.waitForFunction(()=>document.querySelector('#sitePreview').src.includes('/v2/'));assert.match(await page.frameLocator('#sitePreview').locator('body').textContent(),/CHECKPOINT/);await bottom();
 await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();const task=JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).tasks[0];assert.equal(task.versions.length,2);assert(task.versions[1].checkpoint);assert.match(task.versions[1].changeSummary,/页面内容/);assert.equal(task.decisionFlow.history.length,3);
 assert(!String(await readFile(path.join(dir,'index.html'))).includes('CHECKPOINT'));
 await page.locator('#adjustWithoutRating').click();assert.equal(await app.evaluate(()=>globalThis.writes),1);
 await page.locator('#modelButton').click();await page.locator('#manageConnections').click();await page.locator('#previewEveryInput').selectOption('0');await page.locator('#closeSettings').click();
 for(let i=0;i<3;i++){await page.locator('[data-choice="visual"]').check();await page.locator('#submitFlowDecision').click();await page.getByText('继续修改哪一项？',{exact:true}).waitFor();}
 assert.equal(await app.evaluate(()=>globalThis.writes),1);
 console.log(JSON.stringify({passed:true,followLayout:true,historyNotInterrupted:true,jumpToLatest:true,thirdModificationCreatesRealPreview:true,reloadSafe:true,disabledDoesNotWrite:true,model:'mocked'}));
}finally{await app.close();}
