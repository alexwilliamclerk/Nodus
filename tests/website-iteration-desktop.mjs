import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from './helpers/electron-path.mjs';
import {finalizeArtifact} from '../backend/artifacts.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-web-iteration-'));
const versions=[];
for(const number of [1,2]){
  const id=`v${number}`,dir=path.join(data,'artifacts','web',id);
  await mkdir(dir,{recursive:true});
  await writeFile(path.join(dir,'index.html'),`<!doctype html><html><body><nav><a href="#contact">Contact</a><a href="https://example.com" target="_blank">External</a></nav><button id="change" type="button">Change</button><section id="contact">Version ${number}</section><script>document.querySelector('#change').addEventListener('click',()=>{document.querySelector('#contact').textContent='Clicked ${number}'})</script></body></html>`);
  const artifact=await finalizeArtifact({artifactType:'website'},dir);
  versions.push({id,label:id.toUpperCase(),artifact});
}
await writeFile(path.join(data,'state.json'),JSON.stringify({activeTaskId:'web',settings:{},tasks:[{id:'web',title:'Website',artifactType:'website',requirement:'Website',stage:'rating',currentVersionId:'v2',previewVersionId:'v2',versions,timeline:[]}]}));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
  const page=await app.firstWindow();await page.locator('#submitRating').waitFor();
  await app.evaluate(({shell})=>{globalThis.openedUrls=[];shell.openExternal=async url=>{globalThis.openedUrls.push(url);};});
  await page.locator('#togglePreview').click();
  const frame=page.frameLocator('#sitePreview');
  assert(!(await page.locator('#sitePreview').getAttribute('sandbox')).includes('allow-same-origin'));
  await frame.getByText('Version 2').waitFor();
  await frame.getByRole('link',{name:'Contact'}).click();
  let hash='';for(let i=0;i<20;i++){hash=await frame.locator('body').evaluate(()=>location.hash);if(hash==='#contact')break;await page.waitForTimeout(50);}
  assert.equal(hash,'#contact',JSON.stringify(await frame.locator('body').evaluate(()=>({href:location.href,link:document.querySelector('a')?.href}))));
  await frame.getByRole('button',{name:'Change'}).click();
  await frame.getByText('Clicked 2').waitFor();
  await frame.getByRole('link',{name:'External'}).click();
  let opened=[];for(let i=0;i<20;i++){opened=await app.evaluate(()=>globalThis.openedUrls);if(opened.length)break;await page.waitForTimeout(50);}
  assert.deepEqual(opened,['https://example.com/']);
  assert.equal(await page.locator('#sitePreview').isVisible(),true);
  await page.locator('#versionSelect').selectOption('v1');
  await frame.getByText('Version 1').waitFor();
  console.log(JSON.stringify({passed:true,latestPreviewVisible:true,revisionNavigation:true,revisionButton:true,externalLink:true,versionSwitch:true}));
}finally{await app.close();}
