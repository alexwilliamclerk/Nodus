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
    globalThis.updatePageCalls=0;globalThis.updateDownloadCalls=0;
    replace('forma:check-update',()=>({currentVersion:'1.2.0',latestVersion:'1.3.0',available:true,downloadable:true}));
    replace('forma:download-update',()=>{
      globalThis.updateDownloadCalls++;
      BrowserWindow.getAllWindows()[0].webContents.send('forma:update-progress',{received:60,total:100});
      return {version:'1.3.0',reused:false};
    });
    replace('forma:open-update-installer',()=>({message:'已打开安装包'}));
    replace('forma:open-update-page',()=>{globalThis.updatePageCalls++;return {opened:true};});
  });
  await page.locator('#modelButton').click();
  await page.locator('#manageConnections').click();
  await page.locator('#checkUpdateButton').click();
  await page.locator('#downloadUpdateButton:visible').waitFor();
  assert.match(await page.locator('#updateStatus').innerText(),/v1\.3\.0/);
  await page.screenshot({path:path.join(evidence,'settings.png')});
  if(process.platform==='darwin'){
    assert.equal(await page.locator('#downloadUpdateButton').innerText(),'前往 GitHub 下载');
    await page.locator('#downloadUpdateButton').click();
    assert.equal(await app.evaluate(()=>globalThis.updatePageCalls),1);
    assert.equal(await app.evaluate(()=>globalThis.updateDownloadCalls),0);
    assert.match(await page.locator('#updateStatus').innerText(),/选择“替换”/);
    assert(await page.locator('#openUpdateInstallerButton').isHidden());
  }else{
    await page.locator('#downloadUpdateButton').click();
    await page.locator('#openUpdateInstallerButton:visible').waitFor();
    assert.match(await page.locator('#updateStatus').innerText(),/SHA-256/);
    await page.locator('#openUpdateInstallerButton').click();
    assert.match(await page.locator('#updateStatus').innerText(),/已打开安装包/);
    await app.evaluate(({ipcMain})=>{
      globalThis.installUpdateCalls=0;
      ipcMain.removeHandler('forma:check-update');ipcMain.handle('forma:check-update',()=>({currentVersion:'1.2.0',latestVersion:'1.3.1',available:true,downloadable:true,installMode:'automatic'}));
      ipcMain.removeHandler('forma:download-update');ipcMain.handle('forma:download-update',()=>({version:'1.3.1',installMode:'automatic',reused:false}));
      ipcMain.removeHandler('forma:install-update');ipcMain.handle('forma:install-update',()=>{globalThis.installUpdateCalls++;return {started:true};});
    });
    await page.locator('#checkUpdateButton').click();await page.locator('#downloadUpdateButton').click();
    assert.equal(await page.locator('#openUpdateInstallerButton').innerText(),'安装并重启');
    await page.locator('#openUpdateInstallerButton').click();assert.equal(await app.evaluate(()=>globalThis.installUpdateCalls),0);
    await page.locator('#confirmManage').click();assert.equal(await app.evaluate(()=>globalThis.installUpdateCalls),1);
  }
  assert.equal(await page.locator('#uninstallPanel').isVisible(),process.platform==='win32');
  console.log(JSON.stringify({passed:true,check:true,macReleasePage:process.platform==='darwin',confirmedAutomaticInstall:process.platform!=='darwin'}));
}finally{await app.close();}
