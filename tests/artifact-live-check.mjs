// Real Pi calls in an isolated directory. Existing credentials are copied encrypted, never logged.
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, cp, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { electronExecutable, savedLiveData } from './helpers/electron-path.mjs';
const root=process.cwd();const data=await mkdtemp(path.join(root,'.forma-data','artifact-live-'));
const evidence=path.join(root,'test-results',path.basename(data));await mkdir(evidence,{recursive:true});
const results=[];let app;
const record=async value=>{results.push(value);console.log(JSON.stringify(value));await writeFile(path.join(evidence,'results.json'),JSON.stringify({data,evidence,results},null,2));};
try {
  try {await cp(path.join(savedLiveData(root),'credentials.json'),path.join(data,'credentials.json'));}catch(error){if(error.code!=='ENOENT')throw error;await record({skipped:true,reason:'没有本机测试凭据'});process.exit(0);}
  app=await electron.launch({executablePath:electronExecutable(root),args:['.',`--user-data-dir=${path.join(data,'profile')}`],cwd:root,env:{...process.env,NODUS_DATA_DIR:data,FORMA_DATA_DIR:data}});
  const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
  const bootstrap=await page.evaluate(()=>window.forma.bootstrap());
  if(!bootstrap.model.configured){await record({skipped:true,reason:'当前本机无法解密/恢复模型凭据'});}else{
    await record({step:'model',configured:true,model:bootstrap.model.modelId});
    for(const [requirement,type] of [['AI 行业市场调研报告','report'],['季度复盘演示文稿','presentation'],['Python 数据清洗脚本','python'],['制作一个企业介绍网站','website'],['分析销售数据','analysis']]){
      if(process.env.NODUS_LIVE_TYPES&&!process.env.NODUS_LIVE_TYPES.split(',').includes(type))continue;
      const task={id:`live-${type}`,artifactType:null,requirement,attachments:[],options:[],selectedOptionIds:[],optionNotes:{}};
      let decision=await page.evaluate(task=>window.forma.generateOptions({task}),task);
      if(type==='analysis'){
        assert.match(decision.clarification,/数据|CSV|JSON/);await record({step:'missing-data',passed:true,decision});
        task.attachments=[{name:'sales.csv',status:'read',text:'month,revenue\nJan,10\nFeb,30\n'}];
        task.requirement='对附件 sales.csv 做描述统计，交付分析代码、实际结果和说明';
        decision=await page.evaluate(task=>window.forma.generateOptions({task}),task);
      }
      assert.equal(decision.artifactType,type,JSON.stringify(decision));assert.equal(decision.options.length,4,JSON.stringify(decision));
      task.artifactType=type;task.options=decision.options;task.selectedOptionIds=[decision.options[0].id];
      // Unknown business facts remain labelled placeholders. Avoid inventing quarter metrics.
      task.freeform='制作简短但完整的第一版。未提供的具体企业事实、季度业绩或调研来源明确标注待补充或待验证，不虚构；遵循当前格式协议。';
      await record({step:'route',type,passed:true});
      const result=await page.evaluate(task=>window.forma.executeArtifact({task,versionId:'v1',versionLabel:'V1'}),task);
      assert.equal(result.artifact.type,type);await record({step:'execute',type,passed:true,artifact:result.artifact});
      task.currentVersionId='v1';task.previewVersionId='v1';
      if(type==='analysis'){
        const stats=JSON.parse(await readFile(path.join(data,'artifacts',task.id,'v1','results.json'),'utf8'));
        assert.equal(stats.inputs[0].numeric.revenue.mean,20);await record({step:'trusted-results',type,passed:true});
      }
      const response=await fetch(result.previewUrl);assert.equal(response.status,200);
      if(type==='report'){
        const reply=await page.evaluate(task=>window.forma.oneShotChat({task,message:'说明当前报告的来源核实边界'}),task);assert(reply.length>0);await record({step:'chat',type,passed:true});
        const proposal=await page.evaluate(task=>window.forma.proposeRevision({task,evaluation:{versionId:'v1',scores:{信息清晰度:2},comment:'请让摘要更简洁'}}),task);
        assert(proposal.questions.length>=8);
        proposal.answers=Object.fromEntries(proposal.questions.map(q=>[q.id,{selectedOptionIds:[],optionNotes:{},freeform:'仅让摘要更简洁，其他内容保持不变。'}]));
        await record({step:'interview',questions:proposal.questions.length,answers:'test-script supplied explicit choices',passed:true});
        const revision=await page.evaluate(({task,proposal})=>window.forma.executeRevision({task,proposal,baseVersionId:'v1',versionId:'v2',versionLabel:'V2'}),{task,proposal});assert.equal(revision.artifact.type,type);
        const restored=await page.evaluate(()=>window.forma.restoreVersion({taskId:'live-report',sourceVersionId:'v1',versionId:'v3'}));assert.equal(restored.artifact.type,type);
        await record({step:'revision-restore',type,passed:true});
      }
    }
  }
}catch(error){await record({failed:true,message:error.message});process.exitCode=1;}finally{await app?.close();console.log(JSON.stringify({evidence,data}));}
