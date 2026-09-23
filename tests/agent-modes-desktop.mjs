import {_electron as electron} from 'playwright';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-modes-'));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await (await import('./helpers/delivery-dialog.mjs')).configureDeliveryDialog(app);await page.locator('#requirementInput').waitFor();assert.equal(await page.locator('#agentModeSelect').inputValue(),'plan');
 await app.evaluate(({app,ipcMain})=>{
  const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');const {PiService}=require(app.getAppPath()+'/backend/pi-service.mjs');const {fixture}=require(app.getAppPath()+'/tests/helpers/artifact-fixtures.mjs');
  const boot=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await boot(...args);b.model.configured=true;return b;});
  globalThis.writes=0;globalThis.planning=[];
  PiService.prototype.requireModel=()=>{};
  PiService.prototype.runText=async function(args){
   if(args.phase==='options'){globalThis.planning.push(args.prompt);if(args.prompt.includes('缺少分析数据'))return JSON.stringify({artifactType:'analysis',clarification:'需要 CSV 数据材料',options:[]});return JSON.stringify({artifactType:'report',options:[1,2,3,4].map(id=>({id:String(id),title:`方向${id}`,description:'实现方式',effect:'结果',tradeoff:'代价',condition:'条件'})),recommendation:{optionIds:['2'],reason:'满足目标'}});}
   if(args.phase==='requirement-audit')return JSON.stringify({results:[]});
   assertPhase(args.phase);globalThis.writes++;await fixture('report',args.cwd);return 'files written';
  };
  function assertPhase(phase){if(!['artifact','revision'].includes(phase))throw Error('unexpected phase '+phase);}
 });
 await page.reload();await page.locator('#requirementInput').fill('/plan AI 行业报告');await page.locator('#submitRequirement').click();await page.locator('#submitDecision').waitFor();
 assert.equal(await app.evaluate(()=>globalThis.writes),0);assert.equal(await page.locator('[data-choice]').count(),4);
 await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill('/goat');await page.locator('#sendDialog').click();await page.locator('#submitRating').waitFor();
 assert.equal(await app.evaluate(()=>globalThis.writes),1);assert.equal(await page.locator('#agentModeSelect').inputValue(),'goat');
 await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();let state=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));const task=state.tasks[0];assert.deepEqual(task.selectedOptionIds,[]);assert.equal(task.autonomousPlan.source,'agent');assert.equal(task.versions[0].autonomy.status,'needs_review');assert.match(await readFile(path.join(data,'artifacts',task.id,'v1/report.md'),'utf8'),/摘要/);
 await page.reload();await page.locator('#submitRating').waitFor();assert.equal(await app.evaluate(()=>globalThis.writes),1);
 await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill('/goat 精简摘要，保留其他内容');await page.locator('#sendDialog').click();await page.locator('#submitRating').waitFor();assert.equal(await app.evaluate(()=>globalThis.writes),2);
 await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();state=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));assert.equal(state.tasks[0].versions.length,2);assert.equal(state.tasks[0].versions[1].sourceVersionId,'v1');assert.equal(state.tasks[0].versions[1].artifact.type,'report');
 await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill('/plan');await page.locator('#sendDialog').click();await page.locator('#submitRating').waitFor();assert.equal(await page.locator('#agentModeSelect').inputValue(),'plan');assert.equal(await app.evaluate(()=>globalThis.writes),2);
 await page.locator('#newTaskButton').click();assert.equal(await page.locator('#agentModeSelect').inputValue(),'plan');await page.locator('#requirementInput').fill('/goat 季度调研报告');await page.locator('#submitRequirement').click();await page.locator('#submitRating').waitFor();assert.equal(await app.evaluate(()=>globalThis.writes),3);
 await page.locator('#newTaskButton').click();await page.locator('#requirementInput').fill('/goat 缺少分析数据');await page.locator('#submitRequirement').click();await page.getByText('需要 CSV 数据材料',{exact:true}).waitFor();assert.equal(await app.evaluate(()=>globalThis.writes),3);
 assert((await app.evaluate(()=>globalThis.planning)).every(text=>!text.includes('任务目标：/')));
 console.log(JSON.stringify({passed:true,defaultPlan:true,planNeverWrites:true,goatWritesRealReport:true,modeSwitch:true,restartNoAutoRun:true,missingDataStops:true,model:'mocked'}));
}finally{await app.close();}
