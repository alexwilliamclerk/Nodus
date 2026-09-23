import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-expand-'));
await mkdir(path.join(data,'artifacts/t/v1'),{recursive:true});
await writeFile(path.join(data,'artifacts/t/v1/index.html'),'<html><body><h1>预览内容</h1><input id="draft"></body></html>');
await writeFile(path.join(data,'state.json'),JSON.stringify({activeTaskId:'t',settings:{},tasks:[{id:'t',title:'展开测试',stage:'rating',versions:[{id:'v1',label:'V1'}],currentVersionId:'v1',previewVersionId:'v1'}]}));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#togglePreview').click();
 await page.frameLocator('#sitePreview').locator('#draft').fill('不重载预览');
 const before=await page.locator('#previewColumn').boundingBox();
 await page.locator('#expandPreview').click();
 const check=async()=>{
   const bounds=await page.locator('#previewColumn').boundingBox();const size=await page.evaluate(()=>({w:innerWidth,h:innerHeight}));
   assert.equal(bounds.x,0);assert.equal(bounds.y,0);assert.equal(bounds.width,size.w);assert.equal(bounds.height,size.h);
   assert.equal(await page.locator('.workspace').isVisible(),false);
 };
 await check();assert.equal(await page.frameLocator('#sitePreview').locator('#draft').inputValue(),'不重载预览');
 await mkdir('test-results/preview-expand',{recursive:true});await page.screenshot({path:'test-results/preview-expand/expanded.png'});
 await page.locator('#expandPreview').click();assert.equal((await page.locator('#previewColumn').boundingBox()).width,before.width);
 await page.locator('#collapseRail').click();await page.locator('#expandPreview').click();await check();await page.keyboard.press('Escape');assert.equal(await page.locator('#taskRail').isVisible(),false);
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,720));await page.locator('#expandPreview').click();await check();
 await page.locator('#collapsePreview').click();assert.equal(await page.locator('.workspace').isVisible(),true);assert.equal(await page.locator('#previewColumn').isVisible(),false);
 await page.locator('#togglePreview').click();assert.equal(await page.locator('#expandPreview').getAttribute('aria-pressed'),'false');
 console.log(JSON.stringify({passed:true,fullWindow:true,restoreLayout:true,preserveIframe:true,escape:true,compact:true}));
}finally{await app.close();}
