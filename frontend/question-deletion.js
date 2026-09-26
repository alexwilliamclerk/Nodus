import {emptyAnswer,localNode,selectedDecision} from './decision-flow.js';
import {buildRequirementLedger,extractTaskRules} from './requirements.js';

export function normalizeChatTurns(task,newId=()=>crypto.randomUUID()){
  const records=task.timeline||[];
  const conversations=task.temporaryConversations||[];
  const linked=new Set();
  for(let index=0;index<records.length;index++){
    const question=records[index];
    if(question.type!=='user'||question.meta!=='你 · 提问')continue;
    question.turnId ||= newId();
    question.kind='chat';
    let answer=null;
    for(let next=index+1;next<records.length&&records[next].type!=='user';next++){
      if(records[next].meta==='未完成的回复'){records[next].turnId=question.turnId;records[next].kind='chat';}
      if(records[next].meta==='完整答复'){answer=records[next];break;}
    }
    if(answer){answer.turnId=question.turnId;answer.kind='chat';}
    const match=conversations.findIndex((entry,i)=>!linked.has(i)&&(entry.id===question.turnId||(!entry.id&&entry.message===question.text&&entry.reply===answer?.text)));
    if(match>=0){conversations[match].id=question.turnId;linked.add(match);}
  }
}

export function deleteChatTurn(task,turnId){
  if(task.operation?.status==='running')throw new Error('请先停止当前操作，再删除问题。');
  if(!turnId||!task.timeline?.some(event=>event.type==='user'&&event.kind==='chat'&&event.turnId===turnId))throw new Error('这条提问已不存在。');
  task.timeline=task.timeline.filter(event=>event.turnId!==turnId);
  task.temporaryConversations=(task.temporaryConversations||[]).filter(entry=>entry.id!==turnId);
  if(!task.customTitle&&!task.originalRequirement&&!task.versions?.length){
    task.title=task.timeline.find(event=>event.type==='user')?.text?.trim().replace(/\s+/g,' ').slice(0,24)||'新对话';
  }
}

const decisionText=entry=>{
  const d=selectedDecision(entry.node,entry.answer);
  return `${d.question}\n${d.selected.map(o=>o.title+(o.note?`：${o.note}`:'')).join('；')}${d.supplement?`\n${d.supplement}`:''}`;
};

export function deleteDecisionQuestion(task,index){
  if(task.operation?.status==='running')throw new Error('请先停止当前操作，再删除问题。');
  const flow=task.decisionFlow;
  if(!flow||flow.status==='completed'||!['decision','paused'].includes(task.stage))throw new Error('已完成的制作记录不能撤销；请发起新的修改。');
  const current=index===null;
  if(current&&!['area','question'].includes(flow.current?.kind))throw new Error('当前没有可删除的题目。');
  if(!current&&(!Number.isInteger(index)||index<0||index>=flow.history.length))throw new Error('这道题已不存在。');
  const question=current?flow.current:flow.history[index].node;
  if(!['area','question'].includes(question?.kind))throw new Error('执行确认和恢复操作不能作为题目删除。');
  const removed=current?[]:flow.history.splice(index);
  const oldSummary=flow.summary;
  const emptyTask={requirement:'',options:[],freeform:'',completionContract:null};
  const removedRules=buildRequirementLedger(emptyTask,{schemaVersion:3,history:removed,status:'confirmed',summary:oldSummary},null).items;
  const retainedIds=new Set(buildRequirementLedger(emptyTask,{schemaVersion:3,history:flow.history},null).items.map(rule=>rule.id));
  const disabled=new Set(task.disabledRequirementIds||[]);
  for(const rule of removedRules)if(!retainedIds.has(rule.id))disabled.add(rule.id);
  task.disabledRequirementIds=[...disabled];
  // Remove matching legacy display records one at a time, working backwards.
  for(const entry of [...removed].reverse()){
    const text=decisionText(entry);
    const record=task.timeline.findLastIndex(event=>event.meta==='已选决定'&&(event.flowId?event.flowId===flow.id&&event.nodeId===entry.node.id:event.text===text));
    if(record>=0)task.timeline.splice(record,1);
  }
  task.timeline=task.timeline.filter(event=>!(event.flowId&&event.flowId===flow.id&&['待确认范围','执行确认'].includes(event.meta)));
  (flow.deletedQuestions||=[]).push(question.question);
  const removedQuestions=new Set([question.question,...removed.map(entry=>entry.node.question),flow.current?.question]);
  flow.invalidated=(flow.invalidated||[]).filter(entry=>!removedQuestions.has(entry.node?.question));
  flow.current=localNode('area',flow.artifactType);flow.draft=emptyAnswer();flow.summary=null;
  flow.awaitingNext=true;flow.refine=true;flow.resumeOriginal=false;flow.resumeFlow=null;
  flow.previewStartCount=flow.history.filter(entry=>['area','question'].includes(entry.node.kind)).length;
  flow.pendingId=null;flow.previewCheckpoint=false;flow.status='answering';
  task.stage='decision';task.temporaryOpen=false;task.error=null;
  task.taskRules=extractTaskRules({...task,options:[],freeform:'',completionContract:null},flow,task.taskRules||task.requirementLedger);
  task.requirementLedger=task.taskRules;
  return {removedChoices:removed.length};
}
