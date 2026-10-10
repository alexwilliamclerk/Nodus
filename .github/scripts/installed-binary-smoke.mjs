import {_electron as electron} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=process.env.RUNNER_TEMP,output=path.join(root,'nodus-binary-evidence'),data=path.join(root,'nodus-binary-data');
await mkdir(output,{recursive:true});await mkdir(data,{recursive:true});
await writeFile(path.join(data,'state.json'),JSON.stringify({schemaVersion:1,activeTaskId:'binary-check',tasks:[{id:'binary-check',title:'Synthetic installer check',stage:'input',requirement:'',timeline:[{type:'agent',text:'# Markdown check\n\n**Bold text**\n\n- First item\n- Second item'}],attachments:[],versions:[]}],settings:{language:'en-US'}}));
const app=await electron.launch({executablePath:process.env.NODUS_QA_EXE,args:[`--user-data-dir=${path.join(root,'nodus-binary-profile')}`],env:{...process.env,NODUS_DATA_DIR:data},timeout:60000});
let page;
try{
 page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.locator('#requirementInput').waitFor({timeout:60000});
 const info=await app.evaluate(({app})=>({version:app.getVersion(),packaged:app.isPackaged,executable:app.getPath('exe'),platform:process.platform,arch:process.arch}));assert.equal(info.version,process.env.NODUS_QA_VERSION);assert(info.packaged);
 assert(await page.locator('#demoButton').isVisible());assert(await page.locator('#cloudAccountButton').isVisible());assert.equal(await page.locator('.chat-markdown h1').innerText(),'Markdown check');assert.equal(await page.locator('.chat-markdown strong').innerText(),'Bold text');
 await page.screenshot({path:path.join(output,'installed-conversation.png')});await page.locator('#demoButton').click();await page.locator('#demoDialog').waitFor();await page.screenshot({path:path.join(output,'demo.png')});await page.locator('#closeDemo').click();
 await page.locator('#cloudAccountButton').click();await page.locator('#cloudAuthForm').waitFor();await page.screenshot({path:path.join(output,'account.png')});await page.locator('#closeCloud').click();
 await page.locator('#modelConnectionButton').click();await page.locator('#settingsButton').click();await page.locator('#settingsModal').waitFor();const settings={modelFieldVisible:await page.locator('#providerInput').isVisible(),themeCardsVisible:await page.locator('#themeCards').isVisible(),hasSections:await page.locator('.settings-tabs').count()};await page.screenshot({path:path.join(output,'settings.png')});
 assert.deepEqual(errors,[]);await writeFile(path.join(output,'result.json'),JSON.stringify({passed:true,...info,markdown:true,demo:true,account:true,settings,modelCalls:0,source:'official installed binary; no private application source checked out'},null,2));
}catch(e){if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});await writeFile(path.join(output,'failure.txt'),String(e));throw e;}finally{await app.close();}
