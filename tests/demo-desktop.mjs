import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-demo-'));
const output=await mkdtemp(path.resolve('test-results/demo-'));
const original={id:'original',title:'Keep my task',requirement:'Do not replace this request',stage:'input',attachments:[],timeline:[],versions:[]};
await writeFile(path.join(data,'state.json'),JSON.stringify({schemaVersion:1,activeTaskId:original.id,tasks:[original],settings:{language:'zh-CN'}}));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('#demoButton').click();
 await page.getByRole('heading',{name:'先体验，再连接模型'}).waitFor();
 const before=await page.evaluate(()=>window.forma.bootstrap());
 for(const id of ['injection','memory','budget']){
  await page.locator(`[data-demo-case="${id}"]`).click();
  assert(await page.locator('#demoBack').isDisabled());
  for(let step=0;step<3;step++)await page.locator('#demoNext').click();
  assert(await page.locator('#demoNext').isDisabled());
  await page.locator('#demoReset').click();assert(await page.locator('#demoBack').isDisabled());
 }
 const after=await page.evaluate(()=>window.forma.bootstrap());
 assert.deepEqual(after.state.tasks,before.state.tasks);assert.deepEqual(after.model,before.model);
 await page.locator('[data-demo-case="injection"]').click();await page.locator('#demoTry').click();
 await page.waitForFunction(()=>!document.querySelector('#demoDialog').open);
 const saved=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));
 assert.equal(saved.tasks.length,2);assert.equal(saved.tasks.find(t=>t.id==='original').requirement,original.requirement);
 const trial=saved.tasks.find(t=>t.id!=='original');assert.equal(trial.stage,'input');assert.equal(trial.agentMode,'plan');assert.equal(trial.timeline.length,0);assert.equal(trial.versions.length,0);assert.equal(trial.attachments.length,1);assert.equal(trial.operation,undefined);assert.equal(trial.demoExample.kind,'fictional-input-only');
 await page.locator('#demoButton').click();await page.screenshot({path:path.join(output,'demo-zh.png')});await page.locator('#closeDemo').click();
 await page.evaluate(()=>{const s=document.querySelector('#languageSetting');s.value='en-US';s.dispatchEvent(new Event('change'));});
 await page.locator('#demoButton').click();await page.getByRole('heading',{name:'Explore before connecting a model'}).waitFor();
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setMinimumSize(640,640);w.setSize(720,820);});await page.waitForFunction(()=>window.innerWidth===720);
 assert(await page.locator('#demoDialog').evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:path.join(output,'demo-en-narrow.png')});
 await page.keyboard.press('Escape');assert.equal(await page.locator('#demoDialog').evaluate(el=>el.open),false);
 assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,output,scriptedCases:3,languages:2,noModelConfigured:true,trialDoesNotRun:true,originalTaskPreserved:true}));
}finally{await app.close();}
