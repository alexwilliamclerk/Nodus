import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeChatTurns,deleteChatTurn,deleteDecisionQuestion} from '../frontend/question-deletion.js';
import {localNode,emptyAnswer,commitDecision,confirmedFlow,backDecision} from '../frontend/decision-flow.js';
import {extractTaskRules,activeRequirements} from '../frontend/requirements.js';
import {previewCheckpointDue} from '../frontend/preview-cadence.js';
import {oneShotPrompt,nextDecisionPrompt} from '../backend/prompts.mjs';

test('legacy duplicate chat turns link independently and deletion removes future context after reload',()=>{
  const task={timeline:[{type:'user',meta:'你 · 初始需求',text:'Keep task goal'},...Array.from({length:2},()=>[{type:'user',meta:'你 · 提问',text:'same question'},{type:'agent',meta:'完整答复',text:'same answer'}]).flat()],temporaryConversations:[{message:'same question',reply:'same answer'},{message:'same question',reply:'same answer'}],versions:[{id:'v1'}],taskRules:{items:[{id:'r',text:'Keep task goal'}]}};
  let n=0;normalizeChatTurns(task,()=>`turn-${++n}`);
  assert.deepEqual(task.temporaryConversations.map(entry=>entry.id),['turn-1','turn-2']);
  deleteChatTurn(task,'turn-1');
  assert.equal(task.temporaryConversations.length,1);assert.equal(task.temporaryConversations[0].id,'turn-2');
  const restored=JSON.parse(JSON.stringify(task));normalizeChatTurns(restored);
  deleteChatTurn(restored,'turn-2');
  assert(!oneShotPrompt(restored,'new question').includes('same question'));
  assert.equal(restored.timeline.length,1);assert.equal(restored.versions[0].id,'v1');assert.equal(restored.taskRules.items[0].text,'Keep task goal');
});

function setup(){
  const flow={id:'flow',schemaVersion:3,artifactType:'website',trigger:'adjust',baseVersionId:'v1',history:[],invalidated:[],status:'answering',current:localNode('area','website'),draft:{...emptyAnswer(),selectedOptionIds:['visual']}};
  commitDecision(flow);
  for(const name of ['UNIQUE_COLOR','UNIQUE_LAYOUT']){
    flow.current={...localNode('area','website'),id:name,kind:'question',question:name};flow.draft={...emptyAnswer(),selectedOptionIds:['content']};commitDecision(flow);
  }
  flow.current=localNode('confirm','website');flow.status='confirmed';flow.draft={...emptyAnswer(),selectedOptionIds:['execute']};flow.summary={changes:'UNIQUE_SUMMARY',preserve:'Keep content'};
  const task={id:'t',stage:'decision',requirement:'Build site',artifactType:'website',previewEvery:3,timeline:[],versions:[{id:'v1'}],decisionFlow:flow};
  task.taskRules=extractTaskRules(task,flow);task.requirementLedger=task.taskRules;return task;
}

test('deleting an answered decision retires dependent rules, clears confirmation and cannot resurrect them',()=>{
  const task=setup();
  deleteDecisionQuestion(task,1);
  assert.equal(task.decisionFlow.history.length,1);
  assert.throws(()=>confirmedFlow(task.decisionFlow),/确认/);
  assert.equal(task.decisionFlow.pendingId,null);assert.equal(task.decisionFlow.awaitingNext,true);
  assert(!previewCheckpointDue(task,task.decisionFlow));
  let rules=activeRequirements(task.taskRules).map(rule=>rule.text).join('\n');
  assert(!/UNIQUE_COLOR|UNIQUE_LAYOUT|UNIQUE_SUMMARY/.test(rules));assert.match(rules,/页面视觉/);
  const restored=JSON.parse(JSON.stringify(task));restored.taskRules=extractTaskRules(restored,restored.decisionFlow);
  rules=activeRequirements(restored.taskRules).map(rule=>rule.text).join('\n');assert(!/UNIQUE_COLOR|UNIQUE_LAYOUT|UNIQUE_SUMMARY/.test(rules));
  backDecision(restored.decisionFlow);assert.equal(restored.decisionFlow.current.kind,'area');assert.equal(restored.decisionFlow.history.length,0);
  assert.equal(restored.versions.length,1);
});

test('deleting current question preserves earlier choices and marks it excluded from next question',()=>{
  const task=setup();task.decisionFlow.status='answering';task.decisionFlow.summary=null;
  task.decisionFlow.current={...localNode('area','website'),id:'current',kind:'question',question:'DO_NOT_REPEAT'};
  task.decisionFlow.draft={...emptyAnswer(),selectedOptionIds:['interaction']};
  deleteDecisionQuestion(task,null);
  assert.equal(task.decisionFlow.history.length,3);assert.deepEqual(task.decisionFlow.draft,emptyAnswer());
  assert.match(nextDecisionPrompt(task,task.decisionFlow),/DO_NOT_REPEAT/);
  assert(!previewCheckpointDue(task,task.decisionFlow));
  task.operation={status:'running'};
  assert.throws(()=>deleteDecisionQuestion(task,0),/停止/);
});
