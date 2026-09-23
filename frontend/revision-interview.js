export function validateInterview(value){
  if(!value||typeof value.hypothesis!=='string'||!value.hypothesis.trim()||!Array.isArray(value.questions)||value.questions.length<8||value.questions.length>30)throw new Error('评分访谈应包含初步判断和 8–30 道选择题，请重新生成');
  const ids=new Set();
  for(const q of value.questions){
    if(!q||typeof q.id!=='string'||!q.id.trim()||ids.has(q.id)||typeof q.question!=='string'||!q.question.trim())throw new Error('访谈问题标识重复或内容缺失');
    ids.add(q.id);
    if(!Array.isArray(q.options)||q.options.length!==4||new Set(q.options.map(o=>o?.id)).size!==4||q.options.some(o=>!o||['id','title','description','effect','tradeoff','condition'].some(k=>typeof o[k]!=='string'||!o[k].trim())))throw new Error('每道访谈题必须有四个完整、不同的选项');
  }
  return {...value,schemaVersion:2};
}
export function interviewAnswerComplete(question,answer){
  return Boolean(answer?.freeform?.trim()||answer?.selectedOptionIds?.some(id=>question.options.some(o=>o.id===id)));
}
export function confirmedInterview(proposal){
  validateInterview(proposal);
  const decisions=proposal.questions.map(q=>{
    const answer=proposal.answers?.[q.id];
    if(!interviewAnswerComplete(q,answer))throw new Error(`请回答：${q.question}`);
    if((answer.selectedOptionIds||[]).some(id=>!q.options.some(o=>o.id===id)))throw new Error('答案引用了不存在的选项');
    return {question:q.question,selected:q.options.filter(o=>answer.selectedOptionIds?.includes(o.id)).map(o=>({title:o.title,description:o.description,note:answer.optionNotes?.[o.id]||''})),supplement:answer.freeform||''};
  });
  return {hypothesis:proposal.hypothesis,preserve:proposal.preserve||'',suggestion:'按用户已提交的逐题选择修改；初步判断不是用户要求，未选选项不执行。',decisions};
}
