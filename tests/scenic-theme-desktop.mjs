import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from './helpers/electron-path.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-theme-'));
const evidence=path.join(process.cwd(),'test-results','theme');
await mkdir(evidence,{recursive:true});
const launch=()=>electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
let app=await launch();
try{
  let page=await app.firstWindow();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.locator('#newTaskButton').waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'),'light');
  await page.locator('#modelButton').click();
  await page.locator('#manageConnections').click();
  assert.equal(await page.locator('#themeSetting').inputValue(),'light');
  await page.locator('#themeSetting').selectOption('dark');
  await page.locator('html[data-theme="dark"]').waitFor();
  await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
  const colors=await page.evaluate(()=>({
    scheme:getComputedStyle(document.documentElement).colorScheme,
    ink:getComputedStyle(document.documentElement).color,
    background:getComputedStyle(document.querySelector('.workspace')).backgroundColor,
    control:getComputedStyle(document.querySelector('#themeSetting')).backgroundColor,
  }));
  assert.match(colors.scheme,/dark/);
  assert.notEqual(colors.ink,colors.background);
  await page.screenshot({path:path.join(evidence,'settings-dark.png')});
  await page.locator('#closeSettings').click();
  await page.screenshot({path:path.join(evidence,'workspace-dark.png')});
  assert.equal(JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).settings.theme,'dark');
  await app.close();

  app=await launch();
  page=await app.firstWindow();
  page.on('pageerror',error=>errors.push(error.message));
  await page.locator('html[data-theme="dark"]').waitFor();
  await page.locator('#modelButton').click();
  await page.locator('#manageConnections').click();
  assert.equal(await page.locator('#themeSetting').inputValue(),'dark');
  await page.locator('#themeSetting').selectOption('system');
  await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
  const systemDark=await app.evaluate(({nativeTheme})=>nativeTheme.shouldUseDarkColors);
  assert.equal(await page.locator('html').getAttribute('data-theme'),systemDark?'dark':'light');
  assert.equal(JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).settings.theme,'system');
  await page.locator('#themeSetting').selectOption('light');
  await page.locator('html[data-theme="light"]').waitFor();
  await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
  assert.equal(JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).settings.theme,'light');
  for(const id of ['lavender-dawn','moonlit-peaks','peach-mist','bamboo-pavilion']){
    await page.locator(`[data-theme-choice="${id}"]`).click();
    await page.locator(`html[data-scenic-theme="${id}"]`).waitFor();
    await page.waitForFunction(id=>document.querySelector(`[data-theme-choice="${id}"]`).getAttribute('aria-pressed')==='true',id);
    assert.equal(await page.locator('#themeSetting').inputValue(),id);
    const image=page.locator(`[data-theme-choice="${id}"] img`);
    assert.ok(await image.evaluate(img=>img.complete&&img.naturalWidth>0));
    assert.match(await page.locator('.app-shell').evaluate(el=>getComputedStyle(el).backgroundImage),new RegExp(id));
    await page.screenshot({path:path.join(evidence,id+'.png')});
    await page.locator('#closeSettings').click();
    await page.screenshot({path:path.join(evidence,id+'-workspace.png')});
    await page.locator('#modelButton').click();await page.locator('#manageConnections').click();
  }
  await page.locator('#languageSetting').selectOption('en-US');
  await page.getByRole('button',{name:'Bamboo Pavilion',exact:true}).waitFor();
  await page.locator('#saveState').filter({hasText:'Saved'}).waitFor();
  await page.waitForTimeout(500);
  assert.equal(JSON.parse(await readFile(path.join(data,'state.json'),'utf8')).settings.theme,'bamboo-pavilion');
  await app.close();app=await launch();page=await app.firstWindow();
  await page.locator('html[data-scenic-theme="bamboo-pavilion"]').waitFor();
  await page.locator('#modelButton').click();await page.locator('#manageConnections').click();
  await page.getByRole('button',{name:'Bamboo Pavilion',exact:true}).waitFor();
  assert.equal(await page.locator('[data-theme-choice="bamboo-pavilion"]').getAttribute('aria-pressed'),'true');
  await page.locator('#themeSetting').selectOption('light');
  await page.waitForFunction(()=>!document.documentElement.hasAttribute('data-scenic-theme'));
  assert.deepEqual(errors,[]);
  console.log('All seven themes, image loading, translation and restart passed.');
}finally{await app.close();}
