import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from './helpers/electron-path.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-language-'));
const evidence=path.join(process.cwd(),'test-results','language');
await mkdir(evidence,{recursive:true});
const launch=()=>electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
let app=await launch();
try{
  let page=await app.firstWindow();
  await page.locator('#requirementInput').waitFor();
  await page.locator('#requirementInput').fill('保留用户输入的原文');
  await page.locator('#modelButton').click();await page.locator('#manageConnections').click();
  await page.locator('#languageSetting').selectOption('en-US');
  await page.locator('html[lang="en-US"]').waitFor();
  await page.locator('#newTaskButton').filter({hasText:'New chat'}).waitFor();
  assert.equal(await page.locator('#actionTitle').innerText(),'What would you like to make?');
  assert.equal(await page.locator('#requirementInput').inputValue(),'保留用户输入的原文');
  assert.equal(await page.locator('#languageSetting').inputValue(),'en-US');
  assert.doesNotMatch(await page.locator('#settingsModal').innerText(),/[\u4e00-\u9fff]/,'English settings should not leave visible Chinese interface copy');
  await page.locator('#uninstallPanel').evaluate(panel=>{panel.hidden=false;});
  assert.doesNotMatch(await page.locator('#uninstallPanel').innerText(),/[\u4e00-\u9fff]/,'Windows uninstall controls should be translated');
  await page.locator('#uninstallPanel').evaluate(panel=>{panel.hidden=true;});
  assert.equal(await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(item=>item.label==='File')?.label),'File');
  await page.locator('#saveState').filter({hasText:'Saved'}).waitFor();
  assert.equal(JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).settings.language,'en-US');
  await page.screenshot({path:path.join(evidence,'english-settings.png')});
  await page.locator('#closeSettings').click();
  await page.screenshot({path:path.join(evidence,'english-workspace.png')});
  await app.close();

  const saved=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));
  saved.tasks[0].timeline.push({type:'user',text:'用户历史原文',meta:'你 · 初始需求'});
  await writeFile(path.join(data,'state.json'),JSON.stringify(saved));

  app=await launch();page=await app.firstWindow();
  await page.locator('html[lang="en-US"]').waitFor();
  await page.locator('#newTaskButton').filter({hasText:'New chat'}).waitFor();
  assert.equal(await page.locator('#requirementInput').inputValue(),'保留用户输入的原文');
  assert.equal(await page.locator('#timeline .event.user p').innerText(),'用户历史原文');
  await page.locator('#modelButton').click();await page.locator('#manageConnections').click();
  assert.equal(await page.locator('#languageSetting').inputValue(),'en-US');
  await page.locator('#languageSetting').selectOption('zh-CN');
  await page.locator('html[lang="zh-CN"]').waitFor();
  await page.locator('#newTaskButton').filter({hasText:'新对话'}).waitFor();
  assert.equal(await page.locator('#actionTitle').innerText(),'你想完成什么任务？');
  assert.equal(await page.locator('#requirementInput').inputValue(),'保留用户输入的原文');
  assert.equal(await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(item=>item.label==='文件')?.label),'文件');
  console.log(JSON.stringify({passed:true,english:true,chinese:true,persisted:true,userTextPreserved:true}));
}finally{await app.close();}
