import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from './helpers/electron-path.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-language-flow-'));
const evidence=path.join(process.cwd(),'test-results','language');
await mkdir(evidence,{recursive:true});
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
  const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
  await page.locator('#modelButton').click();await page.locator('#manageConnections').click();
  await page.locator('#languageSetting').selectOption('en-US');
  await page.locator('#saveState').filter({hasText:'Saved'}).waitFor();
  await page.locator('#closeSettings').click();
  await app.evaluate(({ipcMain})=>{
    const boot=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');
    ipcMain.handle('forma:bootstrap',async(...args)=>{const data=await boot(...args);data.model.configured=true;data.model.modelId='Test Model';data.model.providerId='deepseek';return data;});
    ipcMain.removeHandler('forma:generate-options');
    ipcMain.handle('forma:generate-options',(_event,payload)=>{
      if(payload.task.uiLanguage!=='en-US')throw Error('English language was not sent to planning');
      return {artifactType:'website',deliverySummary:'An HTML website',question:'Choose a direction',context:'Select how the site should be organized.',options:[1,2,3,4].map(id=>({id:String(id),title:`Direction ${id}`,description:`English option ${id}`,effect:'Clear structure',tradeoff:'Requires content',condition:'Fits the task'}))};
    });
  });
  await page.reload();await page.locator('#requirementInput').waitFor();
  await page.locator('#requirementInput').fill('Build a simple portfolio website');
  await page.locator('#submitRequirement').click();
  await page.locator('#submitDecision').waitFor();
  assert.equal(await page.locator('#actionTitle').innerText(),'Choose a direction');
  assert.match(await page.locator('#actionPanel').innerText(),/Completion conditions/);
  assert.match(await page.locator('#actionPanel').innerText(),/Direction 1/);
  assert.doesNotMatch(await page.locator('#actionPanel').innerText(),/[\u4e00-\u9fff]/);
  assert.doesNotMatch(await page.locator('#timeline .event.agent p').innerText(),/[\u4e00-\u9fff]/,'new agent explanations should not append Chinese interface copy');
  await page.screenshot({path:path.join(evidence,'english-planning.png')});
  console.log(JSON.stringify({passed:true,englishPlanning:true,englishControls:true}));
}finally{await app.close();}
