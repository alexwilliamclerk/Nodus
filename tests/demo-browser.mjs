import {_electron as electron} from 'playwright';
import {createServer} from 'node:http';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const root=process.cwd(),data=await mkdtemp(path.join(os.tmpdir(),'nodus-demo-browser-'));
const server=createServer(async(req,res)=>{try{const url=new URL(req.url,'http://localhost');const file=path.resolve(root,'.'+decodeURIComponent(url.pathname)+(url.pathname.endsWith('/')?'index.html':''));if(!file.startsWith(root+path.sep))throw Error('Invalid path');const types={'.js':'text/javascript','.css':'text/css','.html':'text/html','.webm':'video/webm'};res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404);res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const fixture=path.join(data,'browser.cjs');
await writeFile(fixture,`const {app,BrowserWindow}=require('electron');app.whenReady().then(()=>{const w=new BrowserWindow({width:1280,height:960,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true}});w.loadURL(process.env.NODUS_DEMO_TEST_URL);});`);
const app=await electron.launch({executablePath:electronExecutable(),args:[fixture,`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DEMO_TEST_URL:origin+'/docs/demo/'}});
try{
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const external=[];page.on('request',r=>{if(!r.url().startsWith(origin))external.push(r.url());});
 await page.getByRole('heading',{name:'Explore before connecting a model'}).waitFor();
 assert.equal(await page.locator('#demoTry').count(),0);
 await page.locator('#language').selectOption('zh-CN');await page.getByRole('heading',{name:'先体验，再连接模型'}).waitFor();
 for(const id of ['injection','memory','budget']){await page.locator(`[data-demo-case="${id}"]`).click();for(let i=0;i<3;i++)await page.locator('#demoNext').click();}
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setMinimumSize(360,640);w.setSize(390,844);});await page.waitForFunction(()=>window.innerWidth===390);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const video=await page.evaluate(async()=>{const v=document.createElement('video');v.src='nodus-demo.webm';v.muted=true;document.body.append(v);await new Promise((resolve,reject)=>{v.onloadeddata=resolve;v.onerror=()=>reject(Error('Video could not decode'));});await v.play();await new Promise(r=>setTimeout(r,200));v.pause();return {width:v.videoWidth,height:v.videoHeight,time:v.currentTime};});
 assert.equal(video.width,1280);assert.equal(video.height,960);assert(video.time>0);
 assert.deepEqual(external,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({passed:true,browserLanguages:2,mobileWidth:390,noExternalRequests:true,video}));
}finally{await app.close();server.close();}
