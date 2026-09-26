import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,mkdir} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-advice-ui-'));await mkdir('test-results/advice-watch',{recursive:true});
await writeFile(path.join(data,'state.json'),JSON.stringify({activeTaskId:'chat',settings:{language:'en-US',theme:'moonlit-peaks'},tasks:[{id:'chat',title:'Offline editor',stage:'input',timeline:[{type:'user',text:'Which editor works offline?'},{type:'agent',text:'Use Editor A because it supports offline editing.',sources:[{title:'Official documentation',url:'https://vendor.example/docs'}]}],versions:[]}]}));
const launch=()=>electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
let app=await launch();const errors=[];
try{
 let page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('[data-adopt-advice]').waitFor();
 // Exercise real persistence, classification and IPC using deterministic page/model fixtures.
 await app.evaluate(async({ipcMain,app,BrowserWindow})=>{
   const require=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');const path=require('node:path');
   const {AdviceWatchService}=require(path.join(app.getAppPath(),'backend/advice-watch.mjs'));
   globalThis.watchFixtureChanged=false;
   const before='The desktop app supports offline editing for all users.',after='Starting October, offline editing is no longer available.';
   const service=new AdviceWatchService({file:path.join(process.env.NODUS_DATA_DIR,'advice-watch.json'),onChange:r=>BrowserWindow.getAllWindows()[0].webContents.send('forma:advice-watches',r),fetchSource:async url=>({url,text:globalThis.watchFixtureChanged?after:before}),review:async()=>({findings:[{reasonIndex:0,outcome:globalThis.watchFixtureChanged?'changed':'supported',sourceIndex:0,quote:globalThis.watchFixtureChanged?after:before,previousQuote:globalThis.watchFixtureChanged?before:'',explanation:'Your offline workflow may be affected.',nextStep:'Confirm the version before your trip.'}]})});
   await service.initialize();for(const name of ['list','save','action','check'])ipcMain.removeHandler('forma:advice-'+name);
   ipcMain.handle('forma:advice-list',()=>service.list());ipcMain.handle('forma:advice-save',(_e,input)=>service.save(input));ipcMain.handle('forma:advice-action',(_e,{id,action})=>service.action(id,action));ipcMain.handle('forma:advice-check',(_e,id)=>service.check(id));
 });
 await page.getByRole('button',{name:'Adopt and track',exact:true}).click();
 await page.locator('#watchTitle').fill('My offline editor');await page.locator('#watchReasons').fill('Must work offline during travel');
 assert.equal(await page.locator('#watchAutomatic').isChecked(),false);
 await page.getByRole('button',{name:'Confirm adoption and save'}).click();await page.getByRole('button',{name:'Check now',exact:true}).waitFor();
 await page.getByRole('button',{name:'Check now',exact:true}).click();await page.getByText('No issue found in checked sources',{exact:true}).waitFor();
 await app.evaluate(()=>{globalThis.watchFixtureChanged=true;});await page.getByRole('button',{name:'Check now',exact:true}).click();await page.getByText('Impact needs review',{exact:true}).waitFor();
 assert.equal(await page.locator('#adviceWatchCount').textContent(),'1');await page.getByRole('button',{name:'Mark read',exact:true}).click();await page.waitForFunction(()=>document.querySelector('#adviceWatchCount').textContent==='');
 await page.getByRole('button',{name:'Check now',exact:true}).click();await page.getByText('Impact needs review',{exact:true}).waitFor();
 await page.screenshot({path:'test-results/advice-watch/impact-en.png'});
 assert(!/[\u4e00-\u9fff]/.test(await page.locator('#adviceWatchDialog').innerText()));
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.getByText('Paused',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Resume',exact:true}).click();await page.getByRole('button',{name:'Pause',exact:true}).waitFor();
 await app.close();app=await launch();page=await app.firstWindow();page.on('pageerror',e=>errors.push(e.message));await page.locator('#adviceWatchButton').click();await page.getByRole('button',{name:'View watch'}).click();await page.getByText('Impact needs review',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#watchReasons').fill('Must export my files');await page.getByRole('button',{name:'Confirm adoption and save'}).click();await page.getByText('Not checked',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Delete watch',exact:true}).click();await page.getByRole('button',{name:'Confirm delete',exact:true}).click();await page.getByText('No adopted advice yet.',{exact:true}).waitFor();
 const state=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));assert.equal(state.tasks[0].timeline.length,2);
 assert.deepEqual(errors,[]);console.log('Adoption, grounded change alert, acknowledge, pause/resume, restart, edit, delete and English UI passed (fixture model and sources).');
}finally{await app.close();}
