import {_electron as electron} from 'playwright';
import {mkdtemp,readFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {electronExecutable} from './helpers/electron-path.mjs';
const root=await mkdtemp(path.join(os.tmpdir(),'nodus-backup-ui-')),target=path.join(root,'backup.zip');
const installed=process.env.NODUS_TEST_INSTALLED;
const app=await electron.launch({executablePath:installed||electronExecutable(),args:[...(installed?[]:['.']),`--user-data-dir=${root}/profile`],env:{...process.env,NODUS_DATA_DIR:path.join(root,'data')}});
try{
 const page=await app.firstWindow();await page.locator('#requirementInput').fill('尚未提交但要保留的草稿');
 await page.locator('#modelButton').click();await page.locator('#manageConnections').click();
 await app.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});
 await page.locator('#exportBackup').click();await page.waitForFunction(()=>!document.querySelector('#exportBackup').disabled&&document.querySelector('#backupStatus').textContent==='');
 await app.evaluate(({dialog},filePath)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath});},target);
 await page.locator('#exportBackup').click();await page.waitForFunction(()=>document.querySelector('#backupStatus').textContent.includes('已导出'));
 const zip=await JSZip.loadAsync(await readFile(target));const state=JSON.parse(await zip.file('state.json').async('string'));assert.equal(state.tasks[0].requirement,'尚未提交但要保留的草稿');
 await mkdir('test-results/backup',{recursive:true});await page.screenshot({path:'test-results/backup/settings.png'});
 console.log(JSON.stringify({passed:true,cancel:true,export:true,draftSaved:true,modelCalls:false,nativeDialog:'mocked',zip:'real'}));
}finally{await app.close();}
