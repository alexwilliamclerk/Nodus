import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { electronExecutable } from './helpers/electron-path.mjs';
import { fixture } from './helpers/artifact-fixtures.mjs';
import { StorageService } from '../backend/storage.mjs';
import { finalizeArtifact, prepareAnalysis } from '../backend/artifacts.mjs';
async function assertEventually(fn){for(let i=0;i<30;i++){try{return await fn();}catch(error){if(i===29)throw error;await new Promise(r=>setTimeout(r,100));}}}
const root=process.cwd();const data=await mkdtemp(path.join(root,'.forma-data','artifact-desktop-'));
const evidence=path.join(root,'test-results',path.basename(data));await mkdir(evidence,{recursive:true});
const storage=new StorageService(data);await storage.initialize();
const options=[1,2,3,4].map(n=>({id:String(n),title:`可选方向 ${n}`,description:'具体方法和范围',effect:'清楚的结果',tradeoff:'取舍',condition:'适用条件'}));
const tasks=[];
for(const type of ['report','presentation','python','analysis','website']){
  const task={id:type,title:type,artifactType:type,requirement:`制作${type}`,stage:'rating',options,selectedOptionIds:['1'],versions:[],evaluations:[{versionId:'v1',scores:{需求符合度:4}}],currentVersionId:'v2',previewVersionId:'v2'};
  for(const id of ['v1','v2']){
    const dir=await storage.prepareVersion(type,id);
    if(type==='analysis')await prepareAnalysis({attachments:[{name:'sample.csv',status:'read',text:'x,y\n1,10\n2,20'}]},dir);
    await fixture(type,dir,id);const artifact=await finalizeArtifact(task,dir);
    task.versions.push({id,label:id,artifact,previewUrl:'http://127.0.0.1:1/obsolete'});
  }
  tasks.push(task);
}
tasks.push({id:'new',title:'新对话',artifactType:null,requirement:'',stage:'input',versions:[]});
await storage.saveState({activeTaskId:'new',tasks,settings:{}});
const launch=()=>electron.launch({executablePath:electronExecutable(root),args:['.'],cwd:root,env:{...process.env,NODUS_DATA_DIR:data,FORMA_DATA_DIR:data}});
let app=await launch();let page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
await (await import('./helpers/delivery-dialog.mjs')).configureDeliveryDialog(app);
try {
  await page.locator('#requirementInput').waitFor();
  const clarification='缺少真实项目资料，请提供项目名称与目标用户。';
  await app.evaluate(({ipcMain},clarification)=>{
    const original=ipcMain._invokeHandlers.get('forma:bootstrap');ipcMain.removeHandler('forma:bootstrap');
    ipcMain.handle('forma:bootstrap',async(...args)=>{const b=await original(...args);const t=b.state.tasks.find(t=>t.id==='new');if(t.stage==='input'){t.clarification=clarification;t.timeline=[{type:'agent',text:clarification}];}return b;});
  },clarification);
  await page.reload();await page.locator('#requirementInput').waitFor();
  assert.equal(await page.locator('#timeline').getByText(clarification,{exact:true}).count(),1);
  assert.equal(await page.locator('#actionPanel').getByText(clarification,{exact:true}).count(),0);
  for(const kind of ['drop','paste']) {
    await page.locator('#requirementInput').evaluate((input,kind)=>{
      const transfer=new DataTransfer();transfer.items.add(new File(['name,value\nA,12'],`${kind}.csv`,{type:'text/csv'}));
      input.dispatchEvent(kind==='drop'?new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:transfer}):new ClipboardEvent('paste',{bubbles:true,cancelable:true,clipboardData:transfer}));
    },kind);
    await page.getByRole('button',{name:`${kind}.csv · 已读取 ×`}).waitFor();
  }
  await assertEventually(async()=>{
    const imported=(await storage.loadState()).tasks.find(t=>t.id==='new').attachments;
    assert.equal(imported.length,2);assert(imported.every(f=>f.text==='name,value\nA,12'));
  });
  await page.reload();await page.getByRole('button',{name:'paste.csv · 已读取 ×'}).waitFor();
  await page.getByRole('button',{name:'drop.csv · 已读取 ×'}).click();
  await page.getByRole('button',{name:'paste.csv · 已读取 ×'}).click();
  // Only the model boundary is simulated. IPC, renderer, file compiler, validation and restore run normally.
  await app.evaluate(async ({ipcMain},{root,data,options})=>{
    const require=process.getBuiltinModule('node:module').createRequire(`${root}/package.json`);
    const {StorageService}=require(`${root}/backend/storage.mjs`);
    const {ArtifactService}=require(`${root}/backend/artifact-service.mjs`);
    const {finalizeArtifact}=require(`${root}/backend/artifacts.mjs`);
    const {fixture}=require(`${root}/tests/helpers/artifact-fixtures.mjs`);
    const storage=new StorageService(data);
    const pi={executeArtifact:async(task,dir)=>{await fixture(task.artifactType,dir);return finalizeArtifact(task,dir);}};
    const artifacts=new ArtifactService(storage,pi);
    const originalBootstrap=ipcMain._invokeHandlers.get('forma:bootstrap');
    ipcMain.removeHandler('forma:bootstrap');ipcMain.handle('forma:bootstrap',async (...args)=>{const result=await originalBootstrap(...args);return {...result,model:{...result.model,configured:true,modelId:'mock-desktop'}};});
    ipcMain.removeHandler('forma:generate-options');ipcMain.handle('forma:generate-options',(_e,{task})=>{
      if(task.artifactType==='python'&&task.deliverySummary)throw new Error('纠正类型后仍携带旧交付协议');
      return {artifactType:task.artifactType||'report',options,question:'选择交付方向',deliverySummary:'主产物按当前类型交付'};
    });
    ipcMain.removeHandler('forma:execute-artifact');ipcMain.handle('forma:execute-artifact',async (_e,payload)=>{
      const result=await artifacts.execute(payload);
      // Bootstrap recalculates the URL against the real preview server.
      const state=await storage.loadState();const task=state.tasks.find(t=>t.id===payload.task.id);task.versions.push({id:payload.versionId,artifact:result.artifact});await storage.saveState(state);
      const bootstrap=await originalBootstrap();const version=bootstrap.state.tasks.find(t=>t.id===task.id).versions.at(-1);
      return {...result,previewUrl:version.previewUrl};
    });
  },{root,data,options});
  await page.reload();await page.locator('#requirementInput').fill('AI 行业市场调研报告');await page.locator('#submitRequirement').click();await page.locator('.option-row').first().waitFor();assert.equal(await page.locator('#artifactTypeSelect').inputValue(),'report');
  await page.locator('#artifactTypeSelect').selectOption('python');await page.locator('.option-row').first().waitFor();assert.equal(await page.locator('#artifactTypeSelect').inputValue(),'python');
  await page.locator('#completionSettings').click();
  await page.locator('#completionText').fill('代码可以满足数据清洗需求\n必须说明运行限制');
  await page.screenshot({path:path.join(evidence,'completion-settings.png')});
  await page.locator('#saveCompletion').click();
  await page.locator('[data-choice]').first().check();await page.locator('#submitDecision').click();await page.locator('#submitRating').waitFor();
  assert.equal(await page.locator('#dynamicAction > p').count(),0);
  await page.locator('#completionEvidence').click();await page.getByText('人工条件不会由模型自动标为通过。',{exact:false}).waitFor();
  await page.screenshot({path:path.join(evidence,'completion-evidence.png')});
  await page.locator('#previewTab').click();await page.locator('#collapsePreview').click();
  await page.locator('#togglePreview').click();await page.frameLocator('#sitePreview').getByRole('heading',{name:'工程 V1',exact:true}).waitFor();
  let snapshot=await storage.loadState();assert.equal(snapshot.tasks.find(t=>t.id==='new').versions[0].artifact.type,'python');
  for(const type of ['report','presentation','python','analysis','website']){
    await page.locator(`[data-task-id="${type}"]`).click();await page.frameLocator('#sitePreview').locator('body').waitFor();
    assert(!(await page.locator('#sitePreview').getAttribute('src')).includes(':1/'));
    if(type==='presentation'){assert.equal(await page.frameLocator('#sitePreview').locator('.slide').count(),2);const url=await page.locator('#sitePreview').getAttribute('src');const file=new URL('presentation.pptx',url);assert.equal((await fetch(file)).status,200);}
    if(type==='report')await page.frameLocator('#sitePreview').getByRole('heading',{name:'事实与来源',exact:true}).waitFor();
    if(type==='python')assert(await page.frameLocator('#sitePreview').getByText('main.py',{exact:true}).count());
    if(type==='analysis')await page.frameLocator('#sitePreview').getByRole('heading',{name:'数据描述统计',exact:true}).waitFor();
    if(type==='presentation') {
      const output=path.join(data,'downloaded.pptx');
      await app.evaluate(({BrowserWindow},output)=>{BrowserWindow.getAllWindows()[0].webContents.session.once('will-download',(_event,item)=>item.setSavePath(output));},output);
      await page.frameLocator('#sitePreview').getByRole('link',{name:'下载主文件',exact:true}).click();
      await assertEventually(async()=>assert((await readFile(output)).length>1000));
    }
    const geometry=await page.evaluate(()=>{const r=document.querySelector('.preview-stage').getBoundingClientRect();const h=document.querySelector('.preview-header').getBoundingClientRect();return{stageTop:r.top,headerBottom:h.bottom};});
    assert(geometry.stageTop-geometry.headerBottom<90,'preview toolbar must not expand into blank space');
    await page.screenshot({path:path.join(evidence,`${type}.png`)});
    await page.locator('#versionSelect').selectOption('v1');await page.locator('#restoreVersion').click();await page.locator('#confirmManage').click();await page.locator('#manageDialog').waitFor({state:'hidden'});await page.locator('#submitRating').waitFor();
    await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();
    const stored=(await storage.loadState()).tasks.find(t=>t.id===type);assert.equal(stored.versions.at(-1).artifact.type,type);assert.equal(stored.versions.length,3);assert.equal(stored.evaluations[0].scores.需求符合度,4);
  }
  snapshot=await storage.loadState();await app.close();app=await launch();page=await app.firstWindow();await page.locator('#submitRating').waitFor();await page.locator('#togglePreview').click();
  for(const type of ['report','presentation','python','analysis']){await page.locator(`[data-task-id="${type}"]`).click();await page.frameLocator('#sitePreview').locator('body').waitFor();assert.match(await page.locator('#sitePreview').getAttribute('src'),/\.nodus-preview.html/);}
  assert.equal(errors.length,0);await writeFile(path.join(evidence,'results.json'),JSON.stringify({passed:true,kind:'desktop with mocked model; actual file validation',data,evidence,types:['website','report','presentation','python','analysis'],typeCorrection:true,restart:true,restore:true},null,2));console.log(JSON.stringify({passed:true,evidence,data}));
}finally{await app.close();}
