import {_electron as electron} from 'playwright';
import {mkdtemp,writeFile} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';
const data=await mkdtemp(path.join(os.tmpdir(),'nodus-markdown-'));
const output=await mkdtemp(path.resolve('test-results/chat-markdown-'));
const message='# 标题\n\n**加粗**和 `inline code`\n\n- 第一项\n- 第二项\n\n```js\nconst html = "<script>unsafe</script>";\n```\n\n| 项目 | 结果 |\n| --- | --- |\n| Markdown | 支持 |\n\n[链接](https://example.com)\n\n<img src="https://example.com/tracker" onerror="alert(1)">';
await writeFile(path.join(data,'state.json'),JSON.stringify({schemaVersion:1,activeTaskId:'md',tasks:[{id:'md',stage:'input',title:'Markdown test',requirement:'',timeline:[{type:'agent',text:message}],attachments:[],versions:[]}],settings:{language:'en-US'}}));
const app=await electron.launch({executablePath:process.env.NODUS_TEST_EXECUTABLE||electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
 const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('.chat-markdown h1').waitFor();assert.equal(await page.locator('.chat-markdown strong').innerText(),'加粗');assert.equal(await page.locator('.chat-markdown table td').count(),2);assert.equal(await page.locator('.chat-markdown img').count(),0);
 assert((await page.locator('.chat-markdown pre').innerText()).includes('<script>unsafe</script>'));
 await page.evaluate(async()=>{const b=await window.forma.bootstrap();b.state.tasks[0].operation={phase:'chat',status:'running',label:'Streaming',lastActivity:'Streaming'};await window.forma.saveState(b.state);});await page.reload();await page.locator('#liveResponse').waitFor();
 for(const text of ['## Live\n\n**part','## Live\n\n**complete**\n\n```js\nlet n = 1;']){
  await app.evaluate(({BrowserWindow},text)=>BrowserWindow.getAllWindows()[0].webContents.send('forma:execution-event',{taskId:'md',event:{type:'text_snapshot',text}}),text);
  await page.locator('#liveResponse h2').waitFor();
 }
 await page.locator('#liveResponse strong').waitFor();assert.equal(await page.locator('#liveResponse strong').innerText(),'complete');await page.locator('#liveResponse pre').waitFor();
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setSize(1280,720));
 assert(await page.locator('#timeline').evaluate(el=>el.scrollWidth<=el.clientWidth+1));
 await page.screenshot({path:path.join(output,'markdown.png')});assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,output,history:true,streaming:true,htmlEscaped:true}));
}finally{await app.close();}
