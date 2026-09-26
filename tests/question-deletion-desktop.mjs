import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {electronExecutable} from './helpers/electron-path.mjs';
import {localNode,emptyAnswer,commitDecision} from '../frontend/decision-flow.js';
import {extractTaskRules,activeRequirements} from '../frontend/requirements.js';

const data=await mkdtemp(path.join(os.tmpdir(),'nodus-delete-questions-'));
const flow={id:'f',schemaVersion:3,artifactType:'website',trigger:'adjust',history:[],invalidated:[],status:'answering',current:localNode('area','website'),draft:{...emptyAnswer(),selectedOptionIds:['visual']}};
commitDecision(flow);flow.current={...localNode('area','website'),kind:'question',id:'q1',question:'选择颜色'};flow.draft={...emptyAnswer(),selectedOptionIds:['content']};commitDecision(flow);
flow.current={...localNode('area','website'),kind:'question',id:'q2',question:'不需要的第三题'};
const decision={id:'decisions',title:'制作流程',requirement:'制作网站',stage:'decision',artifactType:'website',decisionFlow:flow,timeline:[],versions:[]};
decision.taskRules=extractTaskRules(decision,flow);decision.requirementLedger=decision.taskRules;
const chat={id:'chat',title:'提问',stage:'input',requirement:'',timeline:['删掉的问题','保留的问题'].flatMap(text=>[{type:'user',meta:'你 · 提问',text},{type:'agent',meta:'完整答复',text:`回答：${text}`}]),temporaryConversations:['删掉的问题','保留的问题'].map(message=>({message,reply:`回答：${message}`})),versions:[]};
await writeFile(path.join(data,'state.json'),JSON.stringify({activeTaskId:'chat',settings:{},tasks:[chat,decision]}));
const app=await electron.launch({executablePath:electronExecutable(),args:['.',`--user-data-dir=${data}/profile`],env:{...process.env,NODUS_DATA_DIR:data}});
try{
  const page=await app.firstWindow();await page.locator('#requirementInput').waitFor();
  await app.evaluate(({ipcMain})=>{globalThis.decisionCalls=0;ipcMain.removeHandler('forma:next-decision');ipcMain.handle('forma:next-decision',()=>{globalThis.decisionCalls++;throw Error('Deletion must not generate a question');});});
  await page.locator('[data-delete-turn]').first().click();await page.locator('#cancelManage').click();assert.equal(await page.locator('[data-delete-turn]').count(),2);
  await page.locator('[data-delete-turn]').first().click();await page.locator('#confirmManage').click();await page.locator('#manageDialog').waitFor({state:'hidden'});
  assert(!(await page.locator('#timeline').innerText()).includes('删掉的问题'));
  await page.reload();await page.locator('#requirementInput').waitFor();assert.equal(await page.locator('[data-delete-turn]').count(),1);
  let saved=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));assert.equal(saved.tasks.find(t=>t.id==='chat').temporaryConversations.length,1);
  await page.locator('[data-task-id="decisions"]').click();
  await page.locator('#deleteCurrentQuestion').click();await page.locator('#confirmManage').click();await page.locator('#manageDialog').waitFor({state:'hidden'});await page.locator('#requestNextDecision').waitFor();
  await page.locator('#showDecisionPath').click();assert.equal(await page.locator('[data-delete-decision]').count(),2);
  await page.locator('[data-delete-decision="0"]').click();await page.locator('#confirmManage').click();await page.locator('#manageDialog').waitFor({state:'hidden'});
  await page.reload();await page.locator('#requestNextDecision').waitFor();assert.equal(await page.locator('#previousFlowDecision').count(),0);
  saved=JSON.parse(await readFile(path.join(data,'state.json'),'utf8'));const task=saved.tasks.find(t=>t.id==='decisions');
  assert.equal(task.decisionFlow.history.length,0);assert.equal(task.decisionFlow.status,'answering');
  assert(!activeRequirements(task.taskRules).some(rule=>/页面视觉|选择颜色/.test(rule.text)));
  assert.equal(await app.evaluate(()=>globalThis.decisionCalls),0);
  console.log(JSON.stringify({passed:true,chatPairDeleted:true,cancelSafe:true,reload:true,currentQuestionDeleted:true,dependentChoicesRetired:true,noModelCalls:true}));
}finally{await app.close();}
