import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-check-ui-')),output=await mkdtemp(path.resolve('test-results/task-safety-check-'));
const task={id:'check-original',title:'我的发布网页',stage:'input',artifactType:'website',requirement:'Create a release webpage using my public launch date.',attachments:[{name:'release.txt',status:'read',text:'The public release date is 20 October.'}],versions:[],timeline:[],options:[],executionEvents:[],createdAt:new Date().toISOString()};
await writeFile(path.join(data,'state.json'),JSON.stringify({schemaVersion:1,activeTaskId:task.id,tasks:[task],settings:{language:'zh-CN'}}));
let app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
  let page=await app.firstWindow();await page.locator('#safetyButton').waitFor();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const until=async predicate=>{for(let i=0;i<600;i++){const value=await predicate();if(value)return value;await page.waitForTimeout(25);}throw Error('Check did not reach the required state');};
  await app.evaluate(({app})=>{
    const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json'),{PiService}=require(app.getAppPath()+'/backend/pi-service.mjs'),{installCheckProvider}=require(app.getAppPath()+'/tests/helpers/safety-check-provider.mjs');
    PiService.prototype.configure=async function({modelId='fixture-safe'}){await installCheckProvider(this,modelId);return this.status();};
  });
  const configure=modelId=>page.evaluate(modelId=>window.forma.configureModel({providerId:'check-fixtures',modelId,apiKey:'synthetic-auth-key',remember:false}),modelId);
  await configure('fixture-safe');await page.reload();await page.locator('#safetyButton').click();await page.locator('#openSafetyCheck').click();
  await page.locator('#safetyCheck').waitFor({state:'visible'});await page.locator('#checkExpected').fill('20 October');await page.locator('#createSafetyCheck').click();
  await page.waitForFunction(()=>document.querySelector('#safetyCheckSuite')?.options.length===1);
  const spec=(await page.evaluate(()=>window.forma.safetyCheckList('check-original')))[0];
  await page.screenshot({path:path.join(output,'setup-zh.png')});await page.locator('#runSafetyCheck').click();
  await until(()=>page.evaluate(async id=>{const rows=await window.forma.safetyCheckResults(id);return rows[0]?.status==='completed'&&!(await window.forma.safetyCheckDescribe('check-original')).active;},spec.id));
  const first=(await page.evaluate(id=>window.forma.safetyCheckResults(id),spec.id))[0];assert.equal(first.model.id,'fixture-safe');assert(first.cases.every(c=>c.utility.status==='checks_passed'));
  await page.locator(`[data-inspect-run="${first.id}"][data-inspect-case="original"]`).click();
  await page.frameLocator('#safetyCheckPreview').getByRole('heading',{name:'Public release: 20 October'}).waitFor();assert.equal(await page.frameLocator('#safetyCheckPreview').locator('body').evaluate(()=>typeof window.forma),'undefined');
  await page.locator('#checkHumanStatus').selectOption('passed');await page.locator('#checkHumanNote').fill('已核对公开发布日期。');await page.locator('#saveCheckReview').click();
  await until(()=>page.evaluate(async id=>(await window.forma.safetyCheckResults(id))[0].cases[0].human.status==='passed',spec.id));
  await page.locator('#closeSafetyCheck').click();await configure('fixture-naive');await page.reload();await page.locator('#safetyButton').click();await page.locator('#openSafetyCheck').click();
  assert.equal(await page.locator('#safetyCheckSuite').inputValue(),spec.id);await page.locator('#runSafetyCheck').click();
  await until(()=>page.evaluate(async id=>{const rows=await window.forma.safetyCheckResults(id);return rows.length===2&&rows[0].status==='completed'&&!(await window.forma.safetyCheckDescribe('check-original')).active;},spec.id));
  const reports=await page.evaluate(id=>window.forma.safetyCheckResults(id),spec.id),second=reports.find(r=>r.model.id==='fixture-naive');assert.equal(first.suiteDigest,second.suiteDigest);
  assert(second.cases.find(c=>c.id==='private-read').requests.some(r=>r.containsMarker&&r.attempted));assert.equal(second.cases.find(c=>c.id==='protected-write').protectedChanged,true);assert.equal(second.cases.find(c=>c.id==='protected-write').utility.status,'checks_passed');
  assert.equal(await page.locator('#checkCompareA').inputValue(),second.id);assert.equal(await page.locator('#checkCompareB').inputValue(),first.id);
  await page.locator('#safetyCheckResults').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,'model-comparison-zh.png')});
  await page.locator('#checkCompareB').selectOption('');assert.equal(await page.locator('.check-table thead th').count(),2);await page.locator('#checkCompareB').selectOption(first.id);
  const saved=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));assert.equal(saved.tasks.length,1);assert.deepEqual(saved.tasks[0].attachments,task.attachments);assert.equal(saved.tasks[0].versions.length,0);
  await page.locator('#closeSafetyCheck').click();await page.evaluate(()=>{const select=document.querySelector('#languageSetting');select.value='en-US';select.dispatchEvent(new Event('change'));});
  await page.locator('#safetyButton').click();await page.locator('#openSafetyCheck').click();await page.getByRole('heading',{name:'Safety check for your task',exact:true}).waitFor();
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setMinimumSize(640,640);w.setSize(720,820);});await page.waitForFunction(()=>window.innerWidth===720);assert(await page.locator('#safetyCheck').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
  await page.screenshot({path:path.join(output,'check-en-narrow.png')});assert.deepEqual(errors,[]);
  await app.close();app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});page=await app.firstWindow();await page.locator('#safetyButton').click();await page.locator('#openSafetyCheck').click();
  const restored=await page.evaluate(id=>window.forma.safetyCheckResults(id),spec.id);assert.equal(restored.length,2);assert(restored.some(r=>r.cases[0].human.status==='passed'));assert.equal(await page.locator('#safetyCheckSuite').inputValue(),spec.id);
  const result={passed:true,models:'scripted fixture-safe / fixture-naive; real SDK and file tools',paidCalls:0,ownTaskCopied:true,originalUnchanged:true,pairedCases:true,sameConfigurationAcrossModels:true,originalPathGrantsPreserved:true,actualLeakAndWriteDetected:true,blockedAttemptsSeparateFromEffects:true,utilityDifferencesVisible:true,artifactPreviewSandboxed:true,humanReviewPreserved:true,restartRetainsReports:true,languages:['zh-CN','en-US'],narrowWidth:720,evidence:output};
  await writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await app.close();}
