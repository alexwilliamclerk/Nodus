import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-picker-'));
const installed=process.env.NODUS_TEST_INSTALLED;
const app=await electron.launch({executablePath:installed||electronExecutable(),args:[...(installed?[]:['.']),`--user-data-dir=${path.join(data,'profile')}`],env:{...process.env,NODUS_DATA_DIR:path.join(data,'data')}});
try {
 const page=await app.firstWindow();await page.locator('#requirementInput').fill('保留我的任务草稿');
 await app.evaluate(({app,safeStorage})=>{
  const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');
  const {PiService}=require(app.getAppPath()+'/backend/pi-service.mjs');
  PiService.prototype.configure=async function(c){if(c.apiKey==='bad')throw Error('401');this.model={id:c.modelId,input:['text']};this.modelId=c.modelId;this.providerId=c.providerId;this.modelRuntime={};return this.status();};
  safeStorage.isEncryptionAvailable=()=>{throw Error('unexpected keychain');};
 });
 await page.locator('#modelButton').click();assert.equal(await page.locator('#settingsModal').isVisible(),false);await page.locator('#manageConnections').click();
 for(const [provider,id] of [['minimax-cn','MiniMax-test'],['qwen-api-cn','qwen-plus']]){
  await page.locator('#providerInput').selectOption(provider);await page.locator('#modelIdInput').fill(id);await page.locator('#apiKeyInput').fill('placeholder');await page.locator('#connectModel').click();
  await page.waitForFunction(n=>document.querySelectorAll('.connection-row').length===n,provider==='minimax-cn'?1:2);
 }
 await page.locator('#apiKeyInput').fill('bad');await page.locator('#connectModel').click();await page.waitForFunction(()=>document.querySelector('#settingsError').textContent.includes('401'));
 assert.equal(await page.locator('.connection-row').count(),2);await page.locator('#closeSettings').click();
 await page.locator('#modelButton').click();await page.getByRole('menuitemradio',{name:/MiniMax-test/}).click();assert.match(await page.locator('#modelLabel').innerText(),/MiniMax-test/);
 assert.equal(await page.locator('#requirementInput').inputValue(),'保留我的任务草稿');
 await page.locator('#modelButton').click();await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,720));
 await page.waitForFunction(()=>innerWidth===1280);await page.waitForTimeout(300);await page.locator('#modelButton').click();
 const menu=await page.locator('#modelPicker').boundingBox();assert(menu&&menu.x>=0&&menu.y>=0&&menu.x+menu.width<=1280);
 await mkdir('test-results/model-picker',{recursive:true});await page.screenshot({path:'test-results/model-picker/dropdown.png'});
 console.log(JSON.stringify({passed:true,model:'mocked',multiKey:true,dropdownSwitch:true,draftPreserved:true,failedAddRetains:true}));
}finally{await app.close();}
