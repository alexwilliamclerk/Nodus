import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
import {applicationMenu} from '../electron/application-menu.mjs';
for(const platform of ['win32','darwin']){
 const commands=[];const menu=applicationMenu(platform,id=>commands.push(id));
 const file=menu.find(item=>item.label==='文件');for(const item of file.submenu)if(item.click)item.click();
 assert.deepEqual(commands,['new-task','open-task','open-material','export-work','open-work-directory','save-task','export-backup']);
}
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-menu-'));
const exports=await mkdtemp(path.join(os.tmpdir(),'nodus-menu-export-'));
await writeFile(path.join(data,'sample.txt'),'菜单导入材料');
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();await page.locator('#requirementInput').fill('我的原任务');
 const click=id=>app.evaluate(({Menu},id)=>Menu.getApplicationMenu().getMenuItemById(id).click(),id);
 await click('save-task');await page.getByText('对话已保存',{exact:true}).waitFor();
 await click('new-task');await page.waitForFunction(()=>document.querySelector('#requirementInput')?.value==='');
 await click('open-task');await page.locator('[data-open-saved-task]').last().click();assert.equal(await page.locator('#requirementInput').inputValue(),'我的原任务');
 await app.evaluate(({dialog},{data,exports})=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[data+'/sample.txt']});dialog.showSaveDialog=async()=>({canceled:false,filePath:exports+'/backup.zip'});},{data,exports});
 await click('open-material');await page.getByRole('button',{name:'sample.txt · 已读取 ×'}).waitFor();
 await click('save-task');await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();const state=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));assert.equal(state.tasks.find(t=>t.requirement==='我的原任务').attachments[0].text,'菜单导入材料');
 await click('export-backup');await page.waitForFunction(()=>document.querySelector('#backupStatus')?.textContent.includes('已导出'));assert((await readFile(path.join(exports,'backup.zip'))).length>0);
 console.log(JSON.stringify({passed:true,nativeMenu:true,newTask:true,switchTask:true,importRealFile:true,save:true,exportRealZip:true,dialogs:'mocked',platform:process.platform}));
}finally{await app.close();}
