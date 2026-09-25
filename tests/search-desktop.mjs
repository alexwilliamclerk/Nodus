import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from './helpers/electron-path.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-search-ui-'));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
  const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
  await page.locator('#modelButton').click();await page.locator('#manageConnections').click();
  const providers=await page.locator('#providerInput option').evaluateAll(options=>options.map(option=>option.value));
  assert(providers.includes('openai')&&providers.includes('anthropic'));
  await page.locator('#searchMode').selectOption('separate');
  assert(await page.locator('#searchApiKey').isVisible());
  await app.evaluate(({ipcMain})=>{
    ipcMain.removeHandler('forma:configure-search');
    ipcMain.handle('forma:configure-search',()=>({mode:'separate',provider:'brave',configured:true,currentSupported:false,remembered:false}));
    ipcMain.removeHandler('forma:web-search');
    ipcMain.handle('forma:web-search',()=>[{title:'Example result',url:'https://example.com/result',snippet:'A short excerpt',provider:'brave'}]);
  });
  await page.locator('#searchProvider').selectOption('brave');
  await page.locator('#searchApiKey').fill('test-only-key');
  await page.locator('#saveSearch').click();
  await page.getByText('联网搜索已配置。').waitFor();
  await page.locator('#closeSettings').click();
  await page.locator('#requirementInput').fill('latest topic');
  await page.locator('#webSearchButton').click();
  const link=page.locator('.search-sources a');await link.waitFor();
  await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
  assert.equal(await link.getAttribute('href'),'https://example.com/result');
  const task=JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).tasks[0];
  assert.equal(task.webSearchResults[0].title,'Example result');
  assert.equal(task.requirement,'latest topic');
  assert(!JSON.stringify(task).includes('test-only-key'));
  console.log(JSON.stringify({passed:true,modelProviders:providers.filter(id=>['openai','anthropic'].includes(id)),searchSources:true,keyExcluded:true}));
}finally{await app.close();}
