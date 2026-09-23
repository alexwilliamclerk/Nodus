import {_electron as electron} from 'playwright';
import {mkdtemp} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-clipboard-key-'));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
 await app.evaluate(({ipcMain})=>{
  const boot=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await boot(...args);b.model.configured=false;return b;});
  ipcMain.removeHandler('forma:read-clipboard');ipcMain.handle('forma:read-clipboard',()=> 'sk-windows-clipboard-test-secret');
 });
 await page.locator('#modelButton').click();await page.locator('#manageConnections').click();await page.locator('#pasteApiKey').waitFor();await page.locator('#pasteApiKey').click();
 assert.equal(await page.locator('#apiKeyInput').inputValue(),'sk-windows-clipboard-test-secret');assert.equal(await page.locator('#actionPanel').getByText('sk-windows-clipboard-test-secret',{exact:true}).count(),0);
 await page.locator('#apiKeyInput').press('Control+A');await page.locator('#apiKeyInput').press('Control+V');
 assert.equal(await page.locator('#apiKeyInput').inputValue(),'sk-windows-clipboard-test-secret');
 console.log(JSON.stringify({passed:true,explicitPaste:true,ctrlVFieldPreserved:true,secretNotRenderedInChat:true,model:'mocked'}));
}finally{await app.close();}
