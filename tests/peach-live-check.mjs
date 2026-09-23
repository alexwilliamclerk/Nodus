import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, writeFile, cp, readdir } from 'node:fs/promises';
import path from 'node:path';
import { electronExecutable, savedLiveData } from './helpers/electron-path.mjs';
const root=process.cwd();
const resume=process.argv[2];
const data=resume?path.resolve(resume):await mkdtemp(path.join(root,'.forma-data','peach-live-'));
const evidence=path.join(root,'test-results',path.basename(data));await mkdir(evidence,{recursive:true});
const liveSource=savedLiveData(root);
if(!resume)await cp(path.join(liveSource,'credentials.json'),path.join(data,'credentials.json'));
const profile=path.join(data,'browser-profile');await mkdir(profile,{recursive:true});
if(!resume&&process.platform==='win32')await cp(path.join(process.env.APPDATA,'forma-agent-workspace','Local State'),path.join(profile,'Local State'));
const launch=()=>electron.launch({executablePath:electronExecutable(root),args:['.',`--user-data-dir=${profile}`],cwd:root,env:{...process.env,NODUS_DATA_DIR:data,FORMA_DATA_DIR:data}});
let app=await launch();let page=await app.firstWindow();
const results=resume?JSON.parse(await readFile(path.join(evidence,'results.json'),'utf8')).results:[];
const record=(step,detail={})=>{results.push({step,...detail});console.log(JSON.stringify({step,...detail}));};
const saved=async()=>{await page.locator('#saveState').filter({hasText:'已保存'}).waitFor();return JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));};
async function capture(name) { await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.show();w.focus();});await page.bringToFront();await page.screenshot({path:path.join(evidence,name),timeout:45000}); }
async function outcome(selector,timeout=240000){
  await page.waitForFunction(s=>document.querySelector(s)||document.querySelector('.error-panel'),selector,{timeout});
  if(await page.locator('.error-panel').count())throw new Error(await page.locator('.error-panel').innerText());
}
try{
  await page.locator(resume?'#submitRating':'#requirementInput').waitFor();
  assert.match(await page.locator('#accountModelStatus').innerText(),/已连接/);
  record('已有加密模型配置恢复',{model:await page.locator('#accountModelStatus').innerText(),data});
  if(!resume){
  await page.locator('#requirementInput').fill('为青禾精密制作一页简洁中文企业介绍页（隔离测试企业）。面向采购负责人，介绍精密加工服务、质量流程和联系前需要准备的资料。企业资质、业绩、地址和联系方式未知时标待补充。不使用外部资源。页面保持简短、清晰，标题初始为“青禾精密”。');
  await page.locator('#submitRequirement').click();await outcome('#submitDecision');
  assert.equal(await page.locator('[data-choice]').count(),4);record('真实模型生成四个方案');
  await page.locator('[data-choice]').first().check();await page.locator('[data-choice]').nth(1).check();
  await page.locator('#freeformInput').fill('页面简洁，保留清楚的采购咨询路径。');
  await page.locator('[data-detail]').first().click();await page.locator('#optionNoteInput').fill('不要添加未提供的资质和客户名称。');await page.locator('#collapsePreview').click();
  await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill('用一句话解释如何保留企业事实边界。');await page.locator('#sendDialog').click();
  await page.waitForFunction(()=>document.querySelector('#submitDecision')||(!document.querySelector('#actionError').hidden && document.querySelector('#sendDialog')),null,{timeout:180000});
  assert(await page.locator('#submitDecision').isVisible(),await page.locator('#actionError').textContent());
  assert.equal(await page.locator('#freeformInput').inputValue(),'页面简洁，保留清楚的采购咨询路径。');assert.equal(await page.locator('[data-choice]:checked').count(),2);
  record('临时对话完整答复后恢复选项和草稿');
  await page.locator('#freeformInput').blur();await page.screenshot({path:path.join(evidence,'options.png')});
  await page.locator('#submitDecision').click();await outcome('#submitRating',360000);
  }
  let s=await saved();let task=s.tasks.find(t=>t.id===s.activeTaskId);const taskId=task.id;
  assert(await page.locator('#previewColumn').isHidden());
  await page.locator('#togglePreview').click();await page.frameLocator('#sitePreview').locator('h1').waitFor();
  const originalDir=path.join(data,'artifacts',taskId,'v1');const v1Files={};for(const name of await readdir(originalDir))v1Files[name]=await readFile(path.join(originalDir,name));
  if(task.currentVersionId==='v1'){
  record('Pi 真实生成 V1 与页面预览',{files:Object.keys(v1Files)});
  await page.screenshot({path:path.join(evidence,'preview-v1.png')});
  for(const group of await page.locator('[data-rating]').all())await group.locator('[data-score="4"]').click();
  await page.locator('#ratingComment').fill('只把网页最主要的 h1 标题改为“让精密制造更易合作”，保留原配色、信息栏目和事实边界。');
  await page.locator('#submitRating').click();await outcome('#nextRevisionQuestion',180000);
  s=await saved();task=s.tasks.find(t=>t.id===taskId);assert.equal(task.versions.length,1);assert.equal(task.evaluations.at(-1).versionId,'v1');
  for(const [name,bytes] of Object.entries(v1Files))assert(bytes.equals(await readFile(path.join(originalDir,name))));
  record('四维评分绑定 V1，确认前未产生 V2 或修改 V1');
  while(await page.locator('#nextRevisionQuestion').count()){
    await page.locator('#freeformInput').fill('只将主 h1 改为“让精密制造更易合作”，其他内容保持不变。');
    await page.locator('#nextRevisionQuestion').click();
  }
  await page.locator('#freeformInput').fill('只将主 h1 改为“让精密制造更易合作”，其他内容保持不变。');
  await page.locator('#confirmRevision').click();await outcome('#submitRating',360000);
  }
  s=await saved();task=s.tasks.find(t=>t.id===taskId);assert.equal(task.currentVersionId,'v2');
  const v2=await readFile(path.join(data,'artifacts',taskId,'v2','index.html'));assert(!v2.equals(v1Files['index.html']));
  const heading=await page.frameLocator('#sitePreview').locator('h1').innerText();assert.match(heading,/让精密制造更易合作/);
  for(const [name,bytes] of Object.entries(v1Files))assert(bytes.equals(await readFile(path.join(originalDir,name))));
  assert(task.executionEvents.some(e=>e.type==='tool_end'));assert(task.executionEvents.some(e=>e.type==='usage'));
  record('确认修改后 V2 内容实际变化，V1 完整保留',{heading,eventCount:task.executionEvents.length});
  await capture('preview-v2.png');
  await page.locator('#collapsePreview').click();await page.locator('#dialogLauncher').click();await page.locator('#dialogInput').fill('请详细解释页面现有结构。');await page.locator('#sendDialog').click();await page.locator('#stopExecution').click();
  await page.locator('#sendDialog').waitFor({timeout:60000});assert.match(await page.locator('#actionError').innerText(),/已停止/);await page.locator('#cancelDialog').click();record('真实 Pi 临时调用已停止，版本保留');
  await page.locator('#modelConnection').hover();await page.locator('#modelPopover').waitFor();assert.match(await page.locator('#modelUsage').innerText(),/Token/);await page.screenshot({path:path.join(evidence,'model-usage.png')});
  await page.mouse.move(800,100);await page.waitForTimeout(250);
  await app.evaluate(({shell})=>{const original=shell.openExternal.bind(shell);shell.openExternal=async url=>{await original(url);globalThis.nodusOpenedPluginUrl=url;};});
  await page.locator('#pluginButton').click();await page.waitForTimeout(700);const pluginUrl=await app.evaluate(()=>globalThis.nodusOpenedPluginUrl);assert.match(pluginUrl||'',/npmjs.com\/search/);record('插件入口已交给系统浏览器打开',{pluginUrl});
  await page.locator('#modelConnection').hover();await page.locator('#disconnectButton').click();await page.locator('#confirmManage').click();await page.locator('#manageDialog').waitFor({state:'hidden'});assert.match(await page.locator('#accountModelStatus').innerText(),/尚未连接/);record('真实断开模型，隔离任务与作品保留');
  await saved();await app.close();app=await launch();page=await app.firstWindow();await page.locator('#submitRating').waitFor();
  assert.match(await page.locator('#accountModelStatus').innerText(),/尚未连接/);assert(await page.locator('#previewColumn').isHidden());await page.locator('#togglePreview').click();assert.match(await page.frameLocator('#sitePreview').locator('h1').innerText(),/让精密制造更易合作/);record('重启恢复任务和 V2，断开状态保持');
  await writeFile(path.join(evidence,'results.json'),JSON.stringify({passed:true,data,results},null,2));console.log(JSON.stringify({passed:true,evidence}));
}catch(error){await page.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});await writeFile(path.join(evidence,'results.json'),JSON.stringify({passed:false,data,results,error:error.message},null,2));throw error;}finally{await app.close();}
