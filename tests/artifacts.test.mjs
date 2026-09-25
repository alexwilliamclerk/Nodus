import { fixture,interviewFixture } from './helpers/artifact-fixtures.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, readdir, mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { PiService } from '../backend/pi-service.mjs';
import { StorageService } from '../backend/storage.mjs';
import { ArtifactService, readArtifact, artifactUrl } from '../backend/artifact-service.mjs';
import { finalizeArtifact, validatePptx, prepareAnalysis } from '../backend/artifacts.mjs';
import { artifactTypes } from '../frontend/artifact-types.js';
import {localNode,emptyAnswer} from '../frontend/decision-flow.js';
import JSZip from 'jszip';
const options=[1,2,3,4].map(n=>({id:String(n),title:`方案${n}`,description:'具体方法',effect:'效果',tradeoff:'取舍',condition:'条件'}));
async function setup(){const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-types-'));const storage=new StorageService(dir);await storage.initialize();const pi=new PiService({piDir:storage.piDir,emit:()=>{}});pi.model={id:'mock'};return {dir,storage,pi,service:new ArtifactService(storage,pi)};}
const cases=[['AI 行业市场调研报告','report'],['季度复盘演示文稿','presentation'],['Python 数据清洗脚本','python'],['企业官网','website'],['正式 Word 文件','word'],['真实 Excel 工作簿','excel'],['JavaScript 代码工程','code']];
test('malformed decisions cannot expose duplicate choices or invalid recommendations',async()=>{
  const {pi}=await setup();
  for(const malformed of [
    {options:[options[0],options[0],options[2],options[3]]},
    {options:options.map(o=>({...o,tradeoff:''}))},
    {options,recommendation:{optionIds:['absent'],reason:'test'}},
  ]) {
    pi.runText=async()=>JSON.stringify({artifactType:'report',...malformed});
    await assert.rejects(pi.generateOptions({requirement:'AI 行业市场调研报告'}),/方案/);
  }
});
test('website validates navigation targets and inline module dependencies without rejecting external links',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-website-links-'));
  for(const body of ['<a href="missing.html">下一页</a>','<a href="#missing">不存在的区块</a>','<a href="javascript:void(0)">无效跳转</a>','<a href="https://example.com" target="_top">预览中受限的跳转</a>','<script>function broken( {</script>','<script type="module">import "./missing.js";</script>']) {
    await writeFile(path.join(dir,'index.html'),`<html><body>${body}</body></html>`);
    await assert.rejects(finalizeArtifact({artifactType:'website'},dir));
  }
  await writeFile(path.join(dir,'index.html'),'<html><body><a href="https://example.com" target="_blank">来源</a><a href="#here">目录</a><section id="here">内容</section></body></html>');
  assert.equal((await finalizeArtifact({artifactType:'website'},dir)).verification.localResources,'passed');
});
test('broken navigation in a revision cannot replace the working website version',async()=>{
  const {storage,pi,service}=await setup();
  pi.runText=async args=>{
    await writeFile(path.join(args.cwd,'index.html'),`<html><body><a href="${args.phase==='revision'?'#missing':'#works'}">Go</a><section id="works">Working</section></body></html>`);
    return 'written';
  };
  const task={id:'navigation',artifactType:'website',requirement:'A website with working navigation'};
  await service.execute({task,versionId:'v1'});
  const original=await readFile(path.join(storage.versionDir(task.id,'v1'),'index.html'),'utf8');
  await assert.rejects(service.execute({task,versionId:'v2',baseVersionId:'v1',proposal:{suggestion:'Change appearance only'}}),/跳转目标不存在/);
  assert.equal(await storage.artifactExists(task.id,'v2'),false);
  assert.equal(await readFile(path.join(storage.versionDir(task.id,'v1'),'index.html'),'utf8'),original);
});
test('visual-only revision cannot silently remove working interaction controls',async()=>{
  const {storage,pi,service}=await setup();
  pi.runText=async args=>{
    const old=args.phase!=='revision';
    await writeFile(path.join(args.cwd,'index.html'),`<html><body>${old?'<a href="#works">Go</a><button id="open" type="button">Open</button>':''}<section id="works">Working</section></body></html>`);
    return 'written';
  };
  const task={id:'preservation',artifactType:'website',requirement:'Keep working navigation'};
  await service.execute({task,versionId:'v1'});
  const flow={schemaVersion:3,status:'confirmed',baseVersionId:'v1',artifactType:'website',current:localNode('confirm','website'),draft:{...emptyAnswer(),selectedOptionIds:['execute']},history:[{node:localNode('area','website'),answer:{...emptyAnswer(),selectedOptionIds:['visual']}}],summary:{changes:'Change colors',preserve:'Keep navigation',verification:'Preview'}};
  await assert.rejects(service.execute({task,versionId:'v2',baseVersionId:'v1',proposal:flow}),/交互入口/);
  assert.equal(await storage.artifactExists(task.id,'v2'),false);
});
test('PPTX rejects slides missing from the presentation relationship graph',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-pptx-rels-'));await fixture('presentation',dir);
  await finalizeArtifact({artifactType:'presentation'},dir);
  const zip=await JSZip.loadAsync(await readFile(path.join(dir,'presentation.pptx')));
  const xml=await zip.file('ppt/_rels/presentation.xml.rels').async('string');
  zip.file('ppt/_rels/presentation.xml.rels',xml.replace('slides/slide1.xml','slides/missing.xml'));
  await writeFile(path.join(dir,'presentation.pptx'),await zip.generateAsync({type:'nodebuffer'}));
  await assert.rejects(validatePptx(dir),/引用/);
});
test('manifest cannot select a mismatched preview or conceal missing delivery files on restart',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-manifest-'));await fixture('report',dir);
  const artifact=await finalizeArtifact({artifactType:'report'},dir);
  await writeFile(path.join(dir,'artifact.json'),JSON.stringify({...artifact,preview:{kind:'document',entry:'report.md'}}));
  await assert.rejects(readArtifact(dir),/协议/);
  await writeFile(path.join(dir,'artifact.json'),JSON.stringify({...artifact,files:artifact.files.filter(f=>f!=='sources.json')}));
  await assert.rejects(readArtifact(dir),/必需文件/);
});
for(const [requirement,type] of cases)test(`${type}: mocked routing, real files, revision, restore, restart`,async()=>{
  const {storage,pi,service}=await setup();const calls=[];
  pi.runText=async args=>{calls.push(args);if(args.phase==='options')return JSON.stringify({artifactType:type,options});if(args.phase==='artifact'||args.phase==='revision'){await fixture(type,args.cwd,args.phase==='revision'?'V2':'V1');return '已写入';}return '{}';};
  const task={id:'task',requirement,options,selectedOptionIds:['1'],attachments:[]};
  const decision=await pi.generateOptions(task);assert.equal(decision.artifactType,type);task.artifactType=decision.artifactType;
  assert.deepEqual(calls[0].tools,[]);assert.match(calls[0].prompt,/交付格式/);
  const v1=await service.execute({task,versionId:'v1',versionLabel:'V1'});
  assert.equal(v1.artifact.type,type);assert(v1.artifact.files.includes(artifactTypes[type].entry));
  const original=await readFile(path.join(storage.versionDir(task.id,'v1'),artifactTypes[type].entry));
  const v2=await service.execute({task:{...task,artifactType:'wrong'},versionId:'v2',versionLabel:'V2',baseVersionId:'v1',proposal:{suggestion:'更新版本标题',scope:'标题'}});
  assert.equal(v2.artifact.type,type);assert.notDeepEqual(await readFile(path.join(storage.versionDir(task.id,'v2'),artifactTypes[type].entry)),original);
  const restored=await service.restore({taskId:task.id,sourceVersionId:'v1',versionId:'v3'});
  assert.equal(restored.artifact.type,type);assert.deepEqual(await readFile(path.join(storage.versionDir(task.id,'v3'),artifactTypes[type].entry)),original);
  const state={schemaVersion:1,activeTaskId:task.id,settings:{provider:'kimi-coding',modelId:''},tasks:[{...task,projectId:'group',evaluations:[{versionId:'v1',scores:{需求符合度:4}}],versions:[{id:'v1',artifact:v1.artifact},{id:'v2',artifact:v2.artifact},{id:'v3',artifact:restored.artifact}]}]};
  await storage.saveState(state);const reload=await storage.loadState();assert.deepEqual(reload,state);
  const disk=await readArtifact(storage.versionDir(task.id,'v3'));assert.equal(disk.type,type);
  assert.notEqual(artifactUrl('http://127.0.0.1:1',task.id,'v3',disk),artifactUrl('http://127.0.0.1:2',task.id,'v3',disk));
  if(type==='presentation')assert.equal((await validatePptx(storage.versionDir(task.id,'v1'))).slides,2);
  if(type==='python')assert.equal(v1.verification.syntax,'passed');
});
test('unknown, mixed, unsupported format and correction never silently select website',async()=>{
  const {pi}=await setup();const calls=[];
  pi.runText=async args=>{calls.push(args);return JSON.stringify(args.prompt.includes('用户已指定当前类型')?{artifactType:'python',options}:{clarification:'请明确主交付物',options:[]});};
  for(const requirement of ['帮我做一个项目','同时做网站和PPT','必须交付PDF'])assert((await pi.generateOptions({requirement})).clarification);
  const decision=await pi.generateOptions({requirement:'不要网站，交付Python脚本',artifactType:'python'});assert.equal(decision.artifactType,'python');assert.match(calls.at(-1).prompt,/实际 .py 源文件/);
  pi.runText=async()=>JSON.stringify({artifactType:'website',options});assert((await pi.generateOptions({requirement:'交付Python',artifactType:'python'})).clarification);
});
test('analysis without materials blocks before writing; supplied inputs produce matched trusted results',async()=>{
  const {storage,pi,service}=await setup();let executions=0;
  pi.runText=async args=>{if(args.phase==='options')return JSON.stringify({artifactType:'analysis',options});executions++;await fixture('analysis',args.cwd);return '已写入';};
  const task={id:'data',artifactType:'analysis',requirement:'分析数据',attachments:[]};
  assert.match((await pi.generateOptions(task)).clarification,/CSV/);
  await assert.rejects(service.execute({task,versionId:'v1'}),/需要数据材料/);assert.equal(executions,0);assert.equal(await storage.artifactExists('data','v1'),false);
  task.attachments=[{name:'sales.csv',status:'read',text:'month,revenue\nJan,10\nFeb,30\n'}];
  const result=await service.execute({task,versionId:'v2',versionLabel:'V2'});assert.equal(result.verification.inputResultCorrespondence,'passed');
  const stats=JSON.parse(await readFile(path.join(storage.versionDir('data','v2'),'results.json')));assert.equal(stats.inputs[0].numeric.revenue.mean,20);
  const v3=await service.execute({task:{...task,attachments:[]},versionId:'v3',baseVersionId:'v2',proposal:{suggestion:'补充限制'}});assert.equal(v3.artifact.type,'analysis');
  assert.equal((await service.restore({taskId:'data',sourceVersionId:'v2',versionId:'v4'})).artifact.type,'analysis');
});
test('wrong artifacts and invalid Python never become success versions, pending files survive',async()=>{
  const {storage,pi,service}=await setup();
  pi.runText=async args=>{await fixture('website',args.cwd);return 'finished';};
  for(const type of ['report','presentation','python']){
    await assert.rejects(service.execute({task:{id:type,artifactType:type},versionId:'v1'}));assert.equal(await storage.artifactExists(type,'v1'),false);
    assert((await readdir(storage.taskDir(type))).some(f=>f.startsWith('.pending-')));
  }
  pi.runText=async args=>{await fixture('python',args.cwd);await writeFile(path.join(args.cwd,'main.py'),'def broken(:\n');return 'done';};
  await assert.rejects(service.execute({task:{id:'invalid',artifactType:'python'},versionId:'v1'}),/语法检查失败/);
});
test('validators reject broken resources, false verified sources, invalid PPTX and tampered analysis',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-invalid-'));
  await fixture('website',dir);await writeFile(path.join(dir,'index.html'),'<html><body><img src="missing.png"></body></html>');await assert.rejects(finalizeArtifact({artifactType:'website'},dir));
  await fixture('report',dir);await writeFile(path.join(dir,'sources.json'),'[{"claim":"fake","source":"URL","status":"verified"}]');await assert.rejects(finalizeArtifact({artifactType:'report'},dir),/来源/);
  await writeFile(path.join(dir,'presentation.pptx'),'<html>fake PPT</html>');await assert.rejects(validatePptx(dir));
  const data=await mkdtemp(path.join(os.tmpdir(),'nodus-data-'));await prepareAnalysis({attachments:[{status:'read',name:'a.json',text:'[{"a":1},{"a":3}]'}]},data);await fixture('analysis',data);
  await writeFile(path.join(data,'inputs/1.json'),'[{"a":999}]');await assert.rejects(finalizeArtifact({artifactType:'analysis'},data),/不匹配/);
});
test('legacy website without manifest restores into new typed version without touching original',async()=>{
  const {storage,service}=await setup();const old=await storage.prepareVersion('legacy','v1');await fixture('website',old);
  assert.equal((await readArtifact(old)).verification.status,'historical');
  const result=await service.restore({taskId:'legacy',sourceVersionId:'v1',versionId:'v2'});assert.equal(result.artifact.type,'website');assert(!(await readdir(old)).includes('artifact.json'));
});
test('analysis, chat, and revision proposals remain read-only and type aware',async()=>{
  const {pi}=await setup();const calls=[];pi.runText=async args=>{calls.push(args);return args.phase==='chat'?'答复':JSON.stringify(args.phase==='revision-analysis'?interviewFixture():{artifactType:'report',options,suggestion:'建议'});};
  const task={id:'r',artifactType:'report',requirement:'调研'};await pi.generateOptions(task);await pi.oneShotChat(task,'问题');await pi.proposeRevision(task,{versionId:'v1'});
  for(const call of calls){assert.deepEqual(call.tools,[]);assert.match(call.prompt,/report/);}
});
test('all model phases receive attachments through the shared backend context',async()=>{
  const {pi,service}=await setup();const calls=[];
  pi.runText=async args=>{calls.push(args);if(args.phase==='artifact'){await fixture('report',args.cwd);return 'done';}return args.phase==='chat'?'答复':JSON.stringify(args.phase==='revision-analysis'?interviewFixture():{artifactType:'report',options,suggestion:'建议'});};
  const task={id:'attached-report',artifactType:'report',requirement:'根据附件写报告',attachments:[{name:'brief.txt',status:'read',text:'材料口令 MATERIAL-849'}]};
  await pi.generateOptions(task);await pi.oneShotChat(task,'问题');await pi.proposeRevision(task,{versionId:'v1'});await service.execute({task,versionId:'v1'});
  assert.equal(calls.length,5);for(const call of calls)assert.match(call.prompt,/材料口令 MATERIAL-849/);
});

test('report verifier distinguishes explicit non-verification from verified claims',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-report-language-'));await fixture('report',dir);
  const base=await readFile(path.join(dir,'report.md'),'utf8');
  await writeFile(path.join(dir,'report.md'),base+'\n因此不存在「已核实」的外部事实。');
  await finalizeArtifact({artifactType:'report'},dir);
  await writeFile(path.join(dir,'report.md'),base+'\n引入联网核实工具后，将 sources.json 中条目逐条由 unverified 更新为已核实；');
  await finalizeArtifact({artifactType:'report'},dir);
  await writeFile(path.join(dir,'report.md'),base+'\n本版本无任何来源，所有条目均需新增可核实来源，并按“已核实/未核实”标注。');
  await finalizeArtifact({artifactType:'report'},dir);
  await writeFile(path.join(dir,'report.md'),base+'\n核心判断均为推测，非已核实结论。');
  await finalizeArtifact({artifactType:'report'},dir);
  await writeFile(path.join(dir,'report.md'),base+'\n本版无一条已核实。');
  await finalizeArtifact({artifactType:'report'},dir);
  await writeFile(path.join(dir,'report.md'),base+'\n需人工核实工具完成来源补充后，方可升级为“已核实”。\n升级路径：补充真实来源 → 填入各板块 → 逐条核实 → 将 sources.json 中条目从 unverified 更新为已核实。');
  await finalizeArtifact({artifactType:'report'},dir);
  await writeFile(path.join(dir,'report.md'),base+'\n以上来源已核实。');
  await assert.rejects(finalizeArtifact({artifactType:'report'},dir),/不能声称/);
});

test('restore of a damaged non-website version cannot publish another version',async()=>{
  const {storage,pi,service}=await setup();pi.runText=async args=>{await fixture('python',args.cwd);return 'done';};
  await service.execute({task:{id:'code',artifactType:'python'},versionId:'v1'});
  await writeFile(path.join(storage.versionDir('code','v1'),'main.py'),'def invalid(:');
  await assert.rejects(service.restore({taskId:'code',sourceVersionId:'v1',versionId:'v2'}),/语法检查失败/);
  assert.equal(await storage.artifactExists('code','v2'),false);
});
test('registered types have finalizers and unknown types cannot inherit object properties',async()=>{
  const {artifactAdapters}=await import('../backend/artifacts.mjs');const {typeInfo}=await import('../frontend/artifact-types.js');
  assert.deepEqual(Object.keys(artifactTypes).sort(),Object.keys(artifactAdapters).sort());
  assert.equal(typeInfo('constructor'),null);assert.equal(typeInfo('__proto__'),null);
});
test('trusted analysis reproduction matches CSV quoted records and numeric edge cases',async()=>{
  const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-reproduce-'));
  const data='label,value,missing,mixed\n"line\nbreak",1,,true\nsecond,3,,false\n';
  const results=await prepareAnalysis({attachments:[{name:'quoted.csv',status:'read',text:data}]},dir);
  // Executes only the application-owned fixed reproducer against this fixture; no model code is run.
  const {stdout}=await promisify(execFile)(process.platform==='win32'?'python':'python3',['-I',path.join(dir,'reproduce.py')],{cwd:dir,timeout:10000});
  assert.deepEqual(JSON.parse(stdout)[0].numeric,results.inputs[0].numeric);
});
test('current version content reaches read-only revision context with authoritative type',async()=>{
  const {withVersionContext}=await import('../backend/artifact-service.mjs');const {storage}=await setup();
  const dir=await storage.prepareVersion('context','v1');await fixture('report',dir);await finalizeArtifact({artifactType:'report'},dir);
  const task=await withVersionContext(storage,{id:'context',artifactType:'website'},'v1');
  assert.equal(task.artifactType,'report');assert.match(task.versionContext,/AI 行业调研/);
});
