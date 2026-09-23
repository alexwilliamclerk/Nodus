import test from 'node:test';
import assert from 'node:assert/strict';
import {recoverLegacyDecision} from '../frontend/decision-recovery.js';
import {localNode,emptyAnswer,commitDecision,confirmedFlow} from '../frontend/decision-flow.js';
export function legacyTask(){
 const original={schemaVersion:3,baseVersionId:'v2',status:'confirmed',history:[],invalidated:[],current:localNode('area','website'),draft:emptyAnswer(),artifactType:'website'};
 for(let i=0;i<24;i++){original.draft={...emptyAnswer(),freeform:`要求${i}`};commitDecision(original);}
 original.current=localNode('confirm');original.summary={changes:'完整执行24项要求'};
 return {id:'legacy',requirement:'制作网站',artifactType:'website',currentVersionId:'v2',stage:'decision',operation:{phase:'artifact',status:'error'},timeline:[{text:'这条决策路径已较长，已暂存。请回看并收敛范围后继续。'}],decisionFlowHistory:[original],decisionFlow:{schemaVersion:3,baseVersionId:'v2',pendingId:null,history:[],current:localNode('failure'),draft:emptyAnswer(),status:'answering'}};
}
test('legacy retry menus recover submitted requirements once without authorizing writes',()=>{
 const task=legacyTask();const saved=structuredClone(task.decisionFlowHistory[0]);assert(recoverLegacyDecision(task));assert.equal(task.decisionFlow.history.length,24);assert.equal(task.decisionFlow.current.kind,'confirm');assert.throws(()=>confirmedFlow(task.decisionFlow));assert.deepEqual(task.decisionFlowHistory[0],saved);assert.equal(recoverLegacyDecision(task),false);
 task.decisionFlow.status='confirmed';task.decisionFlow.draft.selectedOptionIds=['execute'];assert.equal(confirmedFlow(task.decisionFlow).decisions.length,24);
});
test('normal parked, completed and different-baseline conversations are left alone',()=>{
 for(const mutate of [t=>t.timeline=[],t=>t.stage='rating',t=>t.decisionFlowHistory[0].status='completed',t=>t.decisionFlowHistory[0].baseVersionId='v1']){const task=legacyTask();mutate(task);assert.equal(recoverLegacyDecision(task),false);}
});
