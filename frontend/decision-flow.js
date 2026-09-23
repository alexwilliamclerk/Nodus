const option=(id,title,description)=>({id,title,description,effect:description,tradeoff:'只在最终确认后执行',condition:'按当前任务和实际能力处理'});
export const decisionAreas={
  website:[['visual','页面视觉','配色、字体、组件和排版'],['interaction','交互与动效','导航、反馈和页面脚本'],['content','页面内容','文案、栏目和信息层级'],['responsive','适配与资源','窄屏布局和本地资源']],
  report:[['structure','报告结构','摘要、章节和阅读顺序'],['evidence','事实与来源','材料、引用和待验证事项'],['conclusion','论证与结论','推理、假设和建议'],['writing','文字表达','措辞、长度和清晰度']],
  presentation:[['story','叙事结构','页面顺序和整体逻辑'],['content','页面内容','标题和文字要点'],['density','信息密度','拆页、合页和要点长度'],['notes','演讲备注','补充讲稿和待补充材料']],
  python:[['input','数据读取','文件解析和输入格式'],['logic','处理逻辑','算法、清洗与异常处理'],['output','输出结果','输出格式和文件组织'],['usage','依赖与说明','环境要求、运行方法和限制']],
  analysis:[['input','输入材料','数据来源和字段含义'],['metrics','统计指标','描述统计和数值列'],['explanation','结果解读','假设、限制与说明'],['delivery','交付内容','代码、复现说明和结果呈现']],
};
export function localNode(kind,type){
  const sets={
    pause:[['adjust','调整当前任务','选择要修改的部分'],['supplement','补充要求','补充材料、约束或遗漏内容'],['continue','按原计划继续','从已保留的状态继续'],['park','暂时结束','保存状态，稍后继续']],
    failure:[['adjust','调整后重试','通过选项澄清修改方向'],['retry','按原要求重试','保留已有文件，重新尝试未完成步骤'],['model','更换模型','选择已接入的模型后继续'],['park','暂时结束','保留任务与失败记录']],
    confirm:[['execute','确认并执行','按已确认的路径修改'],['back','返回调整选择','回看并修改上一题'],['deeper','继续细化','进一步明确需要调整的内容'],['park','暂存，不执行','保存全部选择，稍后决定']],
    area:decisionAreas[type]||[['goal','任务目标','明确主产物与范围'],['materials','已有材料','补充现有资料'],['constraints','交付约束','明确必须保持的内容'],['format','交付格式','确认当前支持的类型']],
  };
  return {id:`local-${kind}`,kind,question:({pause:'接下来你想怎么处理？',failure:'接下来如何处理？',confirm:'确认接下来的操作',area:'你想调整哪一部分？'})[kind],allowMultiple:kind==='area',options:sets[kind].map(args=>option(...args))};
}
export const emptyAnswer=()=>({selectedOptionIds:[],optionNotes:{},freeform:''});
export function isExecutionRequest(message){
  const text=message.trim();
  if(/[?？]|不要|别|不能|不需要|如何|怎么|能否|是否|能不能|解释|举例|示例/.test(text))return false;
  return /^(?:请|现在|就|你|帮我|开始|直接|按照|按|照|这个|这些|以上|之前|已选|方案|要求|选择|确定的|确认的|的|来|进行|实际|马上|立即|全部|\s)*(?:编码|写代码|修改代码|改代码|实现|执行|制作)(?:吧|了|一下|即可|。|！|!|\s)*$/.test(text);
}
export function prepareFlowConfirmation(flow,message=''){
  flow.summary={changes:[flow.summary?.changes||'按照任务目标及全部已提交选择制作或修改产物，不增加未选择的范围。',message].filter(Boolean).join('\n'),preserve:flow.summary?.preserve||'保留已确认约束和修改范围以外的内容。',verification:flow.summary?.verification||'按当前产物协议及完成条件检查；未验证的内容如实标明。'};
  flow.current=localNode('confirm',flow.artifactType);flow.draft=emptyAnswer();flow.awaitingNext=false;flow.refine=false;flow.status='answering';
}
export function validateDecisionNode(node){
  if(!node||typeof node.question!=='string'||!node.question.trim()||!Array.isArray(node.options)||node.options.length!==4)throw new Error('下一步必须包含一个问题与四个选项');
  const ids=new Set();
  for(const o of node.options){if(!o||['id','title','description','effect','tradeoff','condition'].some(k=>typeof o[k]!=='string'||!o[k].trim())||ids.has(o.id))throw new Error('决策选项不完整或标识重复');ids.add(o.id);}
  if(typeof node.allowMultiple!=='boolean')throw new Error('决策节点缺少单选或多选定义');
  return {...node,kind:'question'};
}
export function selectedDecision(node,answer){
  if(!answer||!Array.isArray(answer.selectedOptionIds)||(!answer.freeform?.trim()&&!answer.selectedOptionIds.length))throw new Error('请选择一个方向或补充你的要求');
  if(!node.allowMultiple&&answer.selectedOptionIds.length>1)throw new Error('此题只能选择一个选项');
  if(answer.selectedOptionIds.some(id=>!node.options.some(o=>o.id===id)))throw new Error('选择包含不存在的选项');
  return {question:node.question,selected:node.options.filter(o=>answer.selectedOptionIds.includes(o.id)).map(o=>({id:o.id,title:o.title,description:o.description,note:answer.optionNotes?.[o.id]||''})),supplement:answer.freeform||''};
}
export function commitDecision(flow){
  const decision=selectedDecision(flow.current,flow.draft);
  flow.history.push({node:structuredClone(flow.current),answer:structuredClone(flow.draft),decision});
  flow.draft=emptyAnswer();return decision;
}
export function backDecision(flow){
  const last=flow.history.pop();if(!last)return false;
  (flow.invalidated||=[]).push({node:flow.current,answer:flow.draft,summary:flow.summary,at:new Date().toISOString()});
  flow.current=last.node;flow.draft=last.answer;flow.summary=null;flow.awaitingNext=false;flow.refine=false;flow.resumeOriginal=false;flow.status='answering';return true;
}
export function confirmedFlow(flow){
  if(flow?.schemaVersion!==3||flow.status!=='confirmed'||flow.current?.kind!=='confirm'||flow.draft?.selectedOptionIds?.length!==1||flow.draft.selectedOptionIds[0]!=='execute')throw new Error('必须由用户最终确认后才能执行');
  if(!flow.summary?.changes?.trim())throw new Error('缺少待确认修改范围');
  const decisions=flow.history.map(({node,answer})=>selectedDecision(node,answer));
  return {suggestion:flow.summary.changes,preserve:flow.summary.preserve||'',verification:flow.summary.verification||'',decisions};
}
