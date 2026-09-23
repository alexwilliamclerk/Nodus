export function sameEvaluation(evaluation,draft){
  if(!evaluation||!draft)return false;
  const a=evaluation.scores||{},b=draft.scores||{};
  return String(evaluation.comment||'').trim()===String(draft.comment||'').trim()&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>a[key]===b[key]);
}
