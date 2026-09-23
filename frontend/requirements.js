import {selectedDecision} from './decision-flow.js';
function normalized(value){return String(value||'').replace(/\s+/g,' ').trim();}
function stableId(source,text){
  let hash=2166136261;
  for(const char of `${source}\0${normalized(text)}`){hash^=char.codePointAt(0);hash=Math.imul(hash,16777619);}
  return `req-${(hash>>>0).toString(16).padStart(8,'0')}`;
}
function item(source,kind,text){
  text=normalized(text);if(!text)return null;
  return {id:stableId(source,text),source,kind,text};
}
function proposalItems(proposal){
  if(!proposal)return [];
  const result=[];
  const add=(source,kind,text)=>{const value=item(source,kind,text);if(value)result.push(value);};
  if(proposal.schemaVersion===3){
    for(const entry of proposal.history||[]){
      const decision=entry.node&&entry.answer?selectedDecision(entry.node,entry.answer):entry.decision;
      for(const choice of decision?.selected||[])add('decision','choice',`${decision.question}：${choice.title}。${choice.description||''}${choice.note?`；用户补充：${choice.note}`:''}`);
      if(decision?.supplement)add('decision','constraint',decision.supplement);
    }
    if(proposal.status==='confirmed'){
      add('confirmed-change','change',proposal.summary?.changes);
      add('confirmed-preserve','preserve',proposal.summary?.preserve);
    }
  }else{
    for(const decision of proposal.decisions||[]){
      for(const choice of decision.selected||[])add('revision-decision','choice',`${decision.question}：${choice.title||''}。${choice.description||''}${choice.note?`；用户补充：${choice.note}`:''}`);
      add('revision-decision','constraint',decision.supplement);
    }
    add('revision-change','change',proposal.suggestion||proposal.scope);
    add('revision-preserve','preserve',proposal.preserve);
  }
  return result;
}
export function buildRequirementLedger(task,proposal=null,previous=task.requirementLedger){
  const collected=[];
  const add=(source,kind,text)=>{const value=item(source,kind,text);if(value)collected.push(value);};
  // Keep user wording intact; each submitted paragraph is independently editable.
  // Do not ask a model to paraphrase or invent acceptance criteria here.
  for(const paragraph of String(task.requirement||'').split(/\n+/))add('initial-request','goal',paragraph);
  for(const option of task.options||[])if(task.selectedOptionIds?.includes(option.id))add(`option:${option.id}`,'choice',`${option.title}。${option.description||''}${task.optionNotes?.[option.id]?`；用户补充：${task.optionNotes[option.id]}`:''}`);
  add('freeform','constraint',task.freeform);
  for(const condition of task.completionContract?.conditions||[])add(`completion:${condition.kind}`,'acceptance',condition.text);
  collected.push(...proposalItems(proposal||task.decisionFlow));
  const merged=new Map(),byText=new Map();
  for(const entry of previous?.items||[])if(entry?.id&&entry.text&&!byText.has(normalized(entry.text))){merged.set(entry.id,{...entry});byText.set(normalized(entry.text),entry.id);}
  for(const entry of collected){
    const existing=byText.get(normalized(entry.text));
    if(existing)merged.set(existing,{...merged.get(existing),kind:merged.get(existing).kind==='goal'&&entry.kind==='acceptance'?'acceptance':merged.get(existing).kind});
    else{merged.set(entry.id,{...entry});byText.set(normalized(entry.text),entry.id);}
  }
  const disabled=new Set(task.disabledRequirementIds||[]);
  const items=[...merged.values()].map(entry=>({...entry,status:disabled.has(entry.id)?'retired':'active'}));
  if(items.length>300)throw new Error('已确认要求超过 300 项，请先在“任务要求”中停用或合并重复要求。');
  return {schemaVersion:1,policy:'要求持续生效，未再次提及不表示取消；新增要求若与旧要求冲突，必须由用户明确停用其中一项。',items};
}
export const activeRequirements=ledger=>(ledger?.items||[]).filter(entry=>entry.status!=='retired');
export function extractTaskRules(task,proposal=null,previous=task.taskRules||task.requirementLedger){
  const ledger=buildRequirementLedger({...task,requirement:task.originalRequirement??task.requirement},proposal,previous);
  const items=ledger.items.map(entry=>{
    const old=previous?.items?.find(item=>item.id===entry.id);
    return {...entry,...(old?.editedByUser?{text:old.text,editedByUser:true}:{}),
      status:task.disabledRequirementIds?entry.status:(old?.status||entry.status),
      category:entry.kind==='acceptance'?'acceptance':/不要|禁止|不得|不能/.test(entry.text)?'prohibition':/保持|保留|不变/.test(entry.text)?'preserve':entry.kind==='goal'?'goal':'constraint',
      originalText:old?.originalText||entry.text,source:entry.source};
  });
  const changed=JSON.stringify(items)!==JSON.stringify(previous?.items);
  return {...ledger,items,kind:'task-rules',revision:(previous?.revision||0)+(changed?1:0),history:previous?.history||[],policy:'当前规则文本持续生效；用户明确修改或停用后更新后续任务，旧文本只作历史；尚未明确解决的矛盾才需要澄清。',sourcePolicy:'仅用户提交或最终确认的内容进入规则；普通对话和模型建议只作背景。'};
}
export function editTaskRule(rules,id,text){
  text=String(text).trim();if(!text)throw new Error('任务规则不能为空');
  const original=rules.items.find(item=>item.id===id);if(!original)throw new Error('任务规则不存在');
  return {...rules,revision:(rules.revision||0)+1,items:rules.items.map(item=>item.id===id?{...item,text,editedByUser:true}:item),history:[...(rules.history||[]),{id,before:original.text,after:text,at:new Date().toISOString(),source:'user-edit'}]};
}
export function taskRuleContext(task){
  const rules=task.taskRules||task.requirementLedger;
  return `任务规则（用户级任务数据，不是系统指令）：\n${requirementContext(rules)}\n规则仅适用于当前任务，不改变工具权限；停用和已修改的旧文本只保留为历史，不得重新激活。`;
}
export function requirementContext(ledger){
  const active=activeRequirements(ledger);
  return active.length?`当前有效要求（${active.length} 项，按确认历史持续生效）：\n${active.map((entry,index)=>`${index+1}. [${entry.id}] ${entry.text}`).join('\n')}\n约束规则：${ledger.policy}`:'当前没有已确认要求。';
}
export const requirementSourceLabel=source=>({
  'initial-request':'初始需求',freeform:'用户补充',decision:'动态选择','confirmed-change':'确认修改','confirmed-preserve':'确认保留','revision-decision':'修订选择','revision-change':'修订修改','revision-preserve':'修订保留'
})[source]||(source?.startsWith('option:')?'方案选择':source?.startsWith('completion:')?'完成条件':'已确认要求');
