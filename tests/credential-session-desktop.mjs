import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-session-only-'));
const saved=JSON.stringify({providerId:'deepseek',modelId:'old',encryptedKey:'invalid-old-ciphertext'});
await writeFile(path.join(data,'credentials.json'),saved);
const installed=process.env.NODUS_TEST_INSTALLED;
const app=await electron.launch({executablePath:installed||electronExecutable(),args:[...(installed?[]:['.']),`--user-data-dir=${path.join(data,'profile')}`],env:{...process.env,NODUS_DATA_DIR:data}});
try {
  const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
  assert.equal((await page.evaluate(()=>window.forma.bootstrap())).model.configured,false);
  await app.evaluate(async({safeStorage,app})=>{
    for(const key of ['isEncryptionAvailable','encryptString','decryptString'])safeStorage[key]=()=>{throw new Error('KEYCHAIN_ACCESS_FORBIDDEN');};
    const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json');
    const {PiService}=require(app.getAppPath()+'/backend/pi-service.mjs');
    PiService.prototype.configure=async function(config){this.model={id:'test-session'};this.providerId=config.providerId;this.modelId='test-session';return this.status();};
  });
  await page.locator('#modelButton').click();await page.locator('#manageConnections').click();assert.equal(await page.locator('#rememberConnection').isChecked(),false);
  await page.locator('#providerInput').selectOption('moonshotai-cn');
  await page.locator('#apiKeyInput').fill('test-placeholder-not-real');await page.locator('#connectModel').click();
  await page.locator('.connection-row').waitFor();await page.locator('#closeSettings').click();
  assert.match(await page.locator('#accountModelStatus').innerText(),/test-session.*已连接/);
  assert.equal(await readFile(path.join(data,'credentials.json'),'utf8'),saved);
  console.log(JSON.stringify({passed:true,installed:Boolean(installed),model:'mocked',deniedKeychainConnection:true,oldCredentialsUnchanged:true}));
}finally{await app.close();}
