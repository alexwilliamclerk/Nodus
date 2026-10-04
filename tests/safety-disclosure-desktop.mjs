import {_electron as electron} from 'playwright';
import {mkdtemp,mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {electronExecutable} from './helpers/electron-path.mjs';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-disclosure-ui-')),output=await mkdtemp(path.resolve('test-results/minimal-disclosure-'));
const key='sk-syntheticcontractkey123456789',logKey='sk-syntheticlogkey9876543210';
const material=`客户姓名：张三\n邮箱：client@example.test\napi_key: ${key}\nproject_code: PRIVATE_PROJECT_A\n合同金额：12000 元\n交付日期：10 月 20 日\n无关备注：INTERNAL_DRAFT_ONLY\n<svg onload=alert(1)>`;
const task={id:'disclosure-demo',title:'合同与项目资料',stage:'input',requirement:'保留客户姓名，总结合同金额与交付日期。',attachments:[{name:'client-contract.txt',status:'read',text:material}],temporaryConversations:[{message:'旧问题',reply:`历史答复重复了 client@example.test 和 ${key}`}],timeline:[],versions:[],options:[],executionEvents:[],createdAt:new Date().toISOString()};
await writeFile(path.join(data,'state.json'),JSON.stringify({schemaVersion:1,activeTaskId:task.id,tasks:[task],settings:{language:'zh-CN'}}));
const work=path.join(data,'working');await mkdir(work);await writeFile(path.join(work,'server.log'),`api_key: ${logKey}\nproject_code: PRIVATE_PROJECT_A\nstatus: STATUS_OK\n`);
let app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
  const page=await app.firstWindow();await page.locator('#safetyButton').waitFor();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await app.evaluate(({app})=>{
    const require=process.getBuiltinModule('node:module').createRequire(app.getAppPath()+'/package.json'),{PiService}=require(app.getAppPath()+'/backend/pi-service.mjs');
    PiService.prototype.configure=async function(){
      globalThis.disclosurePi=this;globalThis.disclosureReceipts=[];globalThis.disclosureMode='contract';
      await this.modelRuntime.setRuntimeApiKey('deepseek','synthetic-auth-secret');this.model=this.modelRuntime.getModel('deepseek','deepseek-flash');this.providerId='deepseek';this.modelId=this.model.id;
      const prepare=this.modelRuntime.prepareRequest.bind(this.modelRuntime);
      this.modelRuntime.prepareRequest=async(model,options)=>{
        const prepared=await prepare(model,options);
        return {...prepared,options:{...prepared.options,fetch:async(input,init)=>{
          const body=typeof init?.body==='string'?init.body:await input.clone().text(),parsed=JSON.parse(body),headers=new Headers(init?.headers??input.headers);
          globalThis.disclosureReceipts.push({body,authPreserved:headers.get('authorization')==='Bearer synthetic-auth-secret'});
          const toolMode=globalThis.disclosureMode==='tool',hasTool=parsed.messages.some(m=>m.role==='tool');
          const delta=toolMode&&!hasTool?{tool_calls:[{index:0,id:'read-log-1',type:'function',function:{name:'read',arguments:'{"path":"server.log"}'}}]}:{content:toolMode?(body.includes('STATUS_OK')?'日志状态正常：STATUS_OK':'缺少日志状态'):(body.includes('12000')&&body.includes('10 月 20 日')?'合同金额 12000 元，交付日期 10 月 20 日。':'缺少必要信息')};
          const base={id:'synthetic-response',object:'chat.completion.chunk',created:0,model:model.id};
          const chunks=[{...base,choices:[{index:0,delta:{role:'assistant',...delta},finish_reason:null}]},{...base,choices:[{index:0,delta:{},finish_reason:toolMode&&!hasTool?'tool_calls':'stop'}],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}}];
          return new Response(chunks.map(chunk=>'data: '+JSON.stringify(chunk)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
        }}};
      };return this.status();
    };
  });
  await page.evaluate(async()=>{await window.forma.configureModel({providerId:'deepseek',apiKey:'synthetic-auth-secret',remember:false});await window.forma.safetyPolicy({taskId:'disclosure-demo',revision:0,policy:{readPaths:['.'],writePaths:['.'],deniedPaths:[],readOnly:false,destinations:['model|https://api.deepseek.com']}});});
  await page.locator('#safetyButton').click();await page.locator('#minimalDisclosureEnabled').check();
  await page.waitForFunction(()=>document.querySelector('#minimalDisclosureEnabled')?.checked&&!document.querySelector('#minimalDisclosureEnabled')?.disabled);await page.locator('#closeSafety').click();
  await page.evaluate(task=>{window.privateOutcome=null;window.forma.oneShotChat({task,message:'请总结合同金额与交付日期，保留客户姓名。'}).then(value=>window.privateOutcome={value},e=>window.privateOutcome={error:e.message});},task);
  const dialog=page.locator('#minimalDisclosure');await dialog.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#sendDisclosure').disabled);
  assert.equal(await app.evaluate(()=>globalThis.disclosureReceipts.length),0);assert(! (await dialog.textContent()).includes('synthetic-auth-secret'));assert.equal(await dialog.locator('svg').count(),0);
  await page.locator('.disclosure-candidate').filter({hasText:'张三'}).locator('input').uncheck();
  await page.locator('#disclosureFields').fill('project_code');await page.locator('#findDisclosureFields').click();
  await page.waitForFunction(()=>!document.querySelector('#sendDisclosure').disabled&&!document.querySelector('#disclosurePreview').value.includes('PRIVATE_PROJECT_A'));
  await page.locator('#disclosureManual').fill('INTERNAL_DRAFT_ONLY');assert.equal(await page.locator('#sendDisclosure').isDisabled(),true);await page.locator('#refreshDisclosure').click();
  await page.waitForFunction(()=>!document.querySelector('#sendDisclosure').disabled);
  const preview=await page.locator('#disclosurePreview').inputValue();for(const value of [key,'client@example.test','PRIVATE_PROJECT_A','INTERNAL_DRAFT_ONLY'])assert(!preview.includes(value));assert(preview.includes('张三'));assert(preview.includes('12000'));assert(preview.includes('10 月 20 日'));
  const readable=await page.locator('#disclosureTextViews').textContent();assert(readable.includes('12000'));assert(!readable.includes(key));assert(!readable.includes('client@example.test'));
  await page.locator('#disclosureView').selectOption('json');assert(await page.locator('#disclosurePreview').isVisible());assert.equal(await page.locator('#disclosurePreview').inputValue(),preview);await page.locator('#disclosureView').selectOption('text');
  await page.screenshot({path:path.join(output,'review-zh.png')});await page.locator('#sendDisclosure').click();await page.waitForFunction(()=>window.privateOutcome);
  assert.match((await page.evaluate(()=>window.privateOutcome)).value,/12000/);
  let receipts=await app.evaluate(()=>globalThis.disclosureReceipts);assert.equal(receipts.length,1);assert.equal(receipts[0].body,preview);assert(receipts[0].authPreserved);
  // Exercise a real SDK file read followed by a second provider request.
  await app.evaluate((_app,{work,task})=>{globalThis.disclosureMode='tool';globalThis.toolOutcome=null;globalThis.disclosurePi.runText({taskId:task.id,taskContext:task,phase:'chat',system:'Read the requested log and report its public status.',prompt:'Read server.log and report its public status.',cwd:work,tools:['read']}).then(value=>globalThis.toolOutcome={value},e=>globalThis.toolOutcome={error:e.message});},{work,task});
  await dialog.waitFor({state:'visible'});await page.waitForFunction(()=>!document.querySelector('#sendDisclosure').disabled);await page.locator('#sendDisclosure').click();
  await page.waitForFunction(()=>document.querySelector('#minimalDisclosure')?.open&&document.querySelector('#disclosurePreview')?.value.includes('STATUS_OK')&&!document.querySelector('#sendDisclosure').disabled);
  const toolPreview=await page.locator('#disclosurePreview').inputValue();assert(!toolPreview.includes(logKey));assert(!toolPreview.includes('PRIVATE_PROJECT_A'));
  await page.screenshot({path:path.join(output,'tool-result-review.png')});await page.locator('#sendDisclosure').click();
  for(let i=0;i<200;i++){if(await app.evaluate(()=>globalThis.toolOutcome))break;await page.waitForTimeout(20);}
  assert.match((await app.evaluate(()=>globalThis.toolOutcome)).value,/STATUS_OK/);receipts=await app.evaluate(()=>globalThis.disclosureReceipts);assert.equal(receipts.at(-1).body,toolPreview);
  assert.equal(await readFile(path.join(work,'server.log'),'utf8'),`api_key: ${logKey}\nproject_code: PRIVATE_PROJECT_A\nstatus: STATUS_OK\n`);
  // A denied request must never reach the mocked network either.
  const before=receipts.length;
  await page.evaluate(task=>{window.privateOutcome=null;window.forma.oneShotChat({task,message:'Summarize again'}).then(value=>window.privateOutcome={value},e=>window.privateOutcome={error:e.message});},task);
  await dialog.waitFor({state:'visible'});await page.locator('#cancelDisclosure').click();await page.waitForFunction(()=>window.privateOutcome?.error);assert.equal(await app.evaluate(()=>globalThis.disclosureReceipts.length),before);
  await page.reload();await page.locator('#safetyButton').click();assert.equal(await page.locator('#minimalDisclosureEnabled').isChecked(),true);await page.locator('#closeSafety').click();
  await page.evaluate(()=>{const select=document.querySelector('#languageSetting');select.value='en-US';select.dispatchEvent(new Event('change'));});
  await page.evaluate(task=>{window.privateOutcome=null;window.forma.oneShotChat({task,message:'Summarize again'}).then(value=>window.privateOutcome={value},e=>window.privateOutcome={error:e.message});},task);
  await dialog.getByRole('heading',{name:'Minimum necessary disclosure',exact:true}).waitFor();await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setMinimumSize(640,640);w.setSize(720,820);});await page.waitForFunction(()=>window.innerWidth===720);
  assert(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1));await page.screenshot({path:path.join(output,'review-en-narrow.png')});await page.locator('#cancelDisclosure').click();await page.waitForFunction(()=>window.privateOutcome?.error);
  const store=await readFile(path.join(data,'safety.json'),'utf8');assert(!store.includes(key));assert(!store.includes(logKey));assert(!store.includes('synthetic-auth-secret'));assert.deepEqual(errors,[]);
  const result={passed:true,provider:'real SDK encoder and decoder; HTTP replaced with recording SSE transport',paidCalls:0,exactPreviewEqualsBody:true,necessaryFieldsPreserved:true,historyAndToolCopiesHidden:true,sourceFilesUnchanged:true,denialPreventsTransfer:true,authenticationNotDisplayed:true,settingSurvivesReload:true,languages:['zh-CN','en-US'],narrowWidth:720,evidence:output};
  await writeFile(path.join(output,'results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await app.close();}
