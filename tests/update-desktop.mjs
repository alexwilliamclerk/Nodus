import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from './helpers/electron-path.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-update-ui-'));
const evidence=path.join(process.cwd(),'test-results','update');
await mkdir(evidence,{recursive:true});
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
  const page=await app.firstWindow();
  await page.locator('#newTaskButton').waitFor();
  await app.evaluate(({ipcMain,BrowserWindow})=>{
    const replace=(name,handler)=>{ipcMain.removeHandler(name);ipcMain.handle(name,handler);};
    replace('forma:check-update',()=>({currentVersion:'1.2.0',latestVersion:'1.3.0',available:true,downloadable:true}));
    replace('forma:download-update',()=>{
      BrowserWindow.getAllWindows()[0].webContents.send('forma:update-progress',{received:60,total:100});
      return {version:'1.3.0',reused:false};
    });
    replace('forma:open-update-installer',()=>({message:'已打开安装包'}));
    replace('forma:open-update-page',()=>({opened:true}));
  });
  await page.locator('#modelButton').click();
  await page.locator('#manageConnections').click();
  await page.locator('#checkUpdateButton').click();
  await page.locator('#downloadUpdateButton:visible').waitFor();
  assert.match(await page.locator('#updateStatus').innerText(),/v1\.3\.0/);
  await page.screenshot({path:path.join(evidence,'settings.png')});
  await page.locator('#downloadUpdateButton').click();
  await page.locator('#openUpdateInstallerButton:visible').waitFor();
  assert.match(await page.locator('#updateStatus').innerText(),/SHA-256/);
  await page.locator('#openUpdateInstallerButton').click();
  assert.match(await page.locator('#updateStatus').innerText(),/已打开安装包/);
  assert.equal(await page.locator('#uninstallPanel').isVisible(),process.platform==='win32');
  console.log(JSON.stringify({passed:true,check:true,download:true,installAction:true}));
}finally{await app.close();}
