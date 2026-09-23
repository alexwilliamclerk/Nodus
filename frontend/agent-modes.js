export const DEFAULT_AGENT_MODE='plan';
export const GOAT_ATTEMPT_LIMIT=3;
export function parseModeCommand(value){
  const match=String(value||'').trim().match(/^\/(plan|goat)(?=\s|$)\s*([\s\S]*)$/i);
  return match?{mode:match[1].toLowerCase(),message:match[2].trim()}:null;
}
export function autonomousPlan(task){
  const ids=task.recommendation?.optionIds;
  if(!Array.isArray(ids)||!ids.length||ids.some(id=>!task.options?.some(option=>option.id===id)))throw new Error('自主方案缺少有效推荐，请选择方案或重新规划。');
  return {options:task.options.filter(option=>ids.includes(option.id)),reason:task.recommendation.reason||'依据任务目标选择',source:'agent',authorizedBy:'/goat'};
}
