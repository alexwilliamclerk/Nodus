// Record the actual demo UI with synthetic data in an isolated Electron profile.
import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from '../tests/helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-demo-record-'));
await writeFile(path.join(data,'state.json'),JSON.stringify({schemaVersion:1,tasks:[],settings:{language:'en-US',theme:'light'}}));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#demoButton').waitFor();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,960));
 await page.locator('#demoButton').click();
 await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=1280;canvas.height=960;
  const chunks=[];const recorder=new MediaRecorder(canvas.captureStream(10),{mimeType:'video/webm;codecs=vp9',videoBitsPerSecond:1500000});
  window.demoRecording={canvas,recorder,chunks,finished:new Promise(resolve=>{recorder.onstop=async()=>resolve(Array.from(new Uint8Array(await new Blob(chunks,{type:'video/webm'}).arrayBuffer())));})};
  recorder.ondataavailable=e=>chunks.push(e.data);recorder.start();
 });
 async function hold(ms){const end=Date.now()+ms;while(Date.now()<end){const png=await page.screenshot({scale:'css'});await page.evaluate(async src=>{const image=new Image();image.src=src;await image.decode();const c=window.demoRecording.canvas;c.getContext('2d').drawImage(image,0,0,c.width,c.height);},'data:image/png;base64,'+png.toString('base64'));await page.waitForTimeout(150);}}
 await hold(7000);
 for(let i=0;i<3;i++){await page.locator('#demoNext').click();await hold(7000);}
 await page.locator('[data-demo-case="memory"]').click();await hold(7000);
 await page.locator('[data-demo-case="budget"]').click();await hold(7000);
 await page.locator('#demoTry').scrollIntoViewIfNeeded();await hold(5000);
 const bytes=await page.evaluate(async()=>{window.demoRecording.recorder.stop();return await window.demoRecording.finished;});
 await mkdir('docs/demo',{recursive:true});await writeFile('docs/demo/nodus-demo.webm',Buffer.from(bytes));
 console.log(JSON.stringify({output:'docs/demo/nodus-demo.webm',bytes:bytes.length,kind:'recorded scripted desktop demo',modelCalls:0}));
}finally{await app.close();}
