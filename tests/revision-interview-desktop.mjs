import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
import {fixture,interviewFixture} from './helpers/artifact-fixtures.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-interview-ui-'));
const versionDir=path.join(data,'artifacts/t/v1');await mkdir(versionDir,{recursive:true});await fixture('website',versionDir);
await writeFile(path.join(data,'state.json'),JSON.stringify({activeTaskId:'t',settings:{},tasks:[{id:'t',title:'评分访谈测试',requirement:'制作网站',stage:'rating',versions:[{id:'v1',label:'V1'}],currentVersionId:'v1',previewVersionId:'v1'}]}));
const installed=process.env.NODUS_TEST_INSTALLED;
const app=await electron.launch({executablePath:installed||electronExecutable(),args:[...(installed?[]:['.']),`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try {
 const page=await app.firstWindow();await page.locator('#submitRating').waitFor();
 await app.evaluate(({ipcMain},proposal)=>{
  ipcMain.removeHandler('forma:propose-revision');ipcMain.handle('forma:propose-revision',()=>proposal);
  ipcMain.removeHandler('forma:execute-revision');ipcMain.handle('forma:execute-revision',(_event,payload)=>{
    globalThis.revisionPayload=payload;
    return {artifact:{type:'website'},verification:{status:'passed'},previewUrl:null};
  });
 },interviewFixture());
 await page.locator('[data-rating]').first().locator('[data-score="2"]').click();await page.locator('#ratingComment').fill('希望更清晰');await page.locator('#submitRating').click();
 await page.locator('#nextRevisionQuestion').waitFor();assert.equal(await page.locator('[data-choice]').count(),4);assert(await page.locator('#nextRevisionQuestion').isDisabled());
 const original=await readFile(path.join(versionDir,'index.html'),'utf8');
 await page.locator('[data-choice]').first().check();await page.locator('[data-choice]').nth(1).check();await page.locator('[data-detail]').first().click();await page.locator('#optionNoteInput').fill('保留原有配色');await page.locator('#collapsePreview').click();
 await page.locator('#nextRevisionQuestion').click();await page.locator('#previousRevisionQuestion').click();assert.equal(await page.locator('[data-choice]:checked').count(),2);
 await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();await page.reload();await page.locator('#nextRevisionQuestion').waitFor();assert.equal(await page.locator('[data-choice]:checked').count(),2);
 await page.locator('#nextRevisionQuestion').click();
 for(let index=1;index<8;index++){
  assert.match(await page.locator('#actionTitle').innerText(),new RegExp(`${index+1}/8`));
  if(index===7)await page.locator('#freeformInput').fill('最后一项保持现状');else await page.locator('[data-choice]').first().check();
  assert.equal(await app.evaluate(()=>Boolean(globalThis.revisionPayload)),false);
  if(index<7)await page.locator('#nextRevisionQuestion').click();
 }
 await mkdir('test-results/revision-interview',{recursive:true});await page.screenshot({path:'test-results/revision-interview/final-question.png'});
 await page.locator('#confirmRevision').click();await page.locator('#submitRating').waitFor();
 const payload=await app.evaluate(()=>globalThis.revisionPayload);assert.equal(Object.keys(payload.proposal.answers).length,8);assert.equal(payload.proposal.answers.q1.optionNotes.a,'保留原有配色');assert.equal(payload.baseVersionId,'v1');
 assert.equal(await readFile(path.join(versionDir,'index.html'),'utf8'),original);
 console.log(JSON.stringify({passed:true,model:'mocked',questions:8,multiSelect:true,notes:true,reload:true,noExecutionBeforeFinalSubmit:true}));
}finally{await app.close();}
