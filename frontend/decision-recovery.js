import {prepareFlowConfirmation} from './decision-flow.js';
export function recoverLegacyDecision(task){
  if(task.decisionRecoveryVersion===1||task.operation?.status==='running')return false;
  if(!task.timeline?.some(event=>event.text?.includes('这条决策路径已较长，已暂存')))return false;
  const current=task.decisionFlow;if(!current||!['decision','paused','error'].includes(task.stage))return false;
  const base=current.baseVersionId||task.currentVersionId||null;
  const original=[...(task.decisionFlowHistory||[]),current].find(flow=>flow.schemaVersion===3&&flow.history?.length>=24&&flow.status!=='completed'&&(flow.baseVersionId||null)===base);
  if(!original)return false;
  const recovered=structuredClone(original),seen=new Set(recovered.history.map(item=>JSON.stringify([item.node,item.answer])));
  for(const item of current.history||[]){
    if(!['area','question'].includes(item.node?.kind))continue;
    const key=JSON.stringify([item.node,item.answer]);if(!seen.has(key)){recovered.history.push(structuredClone(item));seen.add(key);}
  }
  recovered.pendingId=current.pendingId||null;recovered.baseVersionId=base;
  recovered.resumeOriginal=false;recovered.resumeFlow=null;
  prepareFlowConfirmation(recovered);
  (task.decisionFlowHistory||=[]).push(structuredClone(current));
  task.decisionFlow=recovered;task.stage='decision';task.temporaryOpen=false;task.error=null;
  task.decisionRecoveryVersion=1;
  return true;
}
