import { typeInfo } from './artifact-types.js';
const paths = {
  expand:'<path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5"/>',
  contract:'<path d="M3 8h5V3M21 8h-5V3M16 21v-5h5M8 21v-5H3"/>',
  brand:'<rect x="4" y="3" width="16" height="18" rx="4"/>',
  panel:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  document:'<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9zM14 3v6h6M8 13h8M8 17h5"/>',
  edit:'<path d="m14 5 5 5M5 15l-1 5 5-1L21 7l-5-5zM11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>',
  plugin:'<circle cx="12" cy="12" r="9"/><path d="m9 8 6 4-6 4z"/>',
  external:'<path d="M14 3h7v7M21 3l-11 11M10 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/>',
  folder:'<path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7h18"/>',
  archive:'<rect x="3" y="3" width="18" height="5" rx="1"/><path d="M5 8v13h14V8M9 12h6"/>',
  model:'<path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="m9 3-1 3-3 1v3l-2 2 2 2v3l3 1 1 3h6l1-3 3-1v-3l2-2-2-2V7l-3-1-1-3z"/>',
  disconnect:'<path d="M9 8 5 12l4 4M5 12h14M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5"/>',
  preview:'<rect x="2" y="4" width="20" height="15" rx="2"/><path d="M8 22h8M12 19v3M5 8h4"/>',
  mobile:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M10 18h4"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  plus:'<path d="M12 4v16M4 12h16"/>', close:'<path d="m6 6 12 12M6 18 18 6"/>', chevron:'<path d="m6 9 6 6 6-6"/>',
  refresh:'<path d="M20 7v5h-5M4 17v-5h5M5 7a8 8 0 0 1 13-2l2 2M4 17l2 2a8 8 0 0 0 13-2"/>',
  bulb:'<path d="M9 18h6M10 22h4M9 18v-3a6 6 0 1 1 6 0v3"/>',
  chat:'<path d="M21 11a9 9 0 0 1-9 9H3l1-6a9 9 0 1 1 17-3z"/>', send:'<path d="M12 21V3M5 10l7-7 7 7"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="1"/>', pin:'<path d="m8 3 8 0-1 6 4 4H5l4-4zM12 13v9"/>',
};
export function icon(name) { return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.document}</svg>`; }
export function hydrateIcons(root = document) { root.querySelectorAll('[data-icon]').forEach(node => { node.innerHTML = icon(node.dataset.icon); }); }
export function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
export function brief(description = '') {
  const clause = String(description).trim().split(/[。；;\n]/)[0];
  if (clause.length <= 36) return clause;
  return clause.split(/[，,：:]/).find(part=>part.length>=7 && part.length<=36) || `${clause.slice(0,32)}…`;
}
export const dimensions = ['需求符合度','视觉表现','信息清晰度','交互可用性'];
export function providerLabel(id) { return ({'minimax-cn':'MiniMax 中国 API',minimax:'MiniMax 全球 API','qwen-api-cn':'Qwen 百炼 API','kimi-coding':'Kimi Coding Plan','moonshotai-cn':'Moonshot 中国 API','moonshotai':'Moonshot 全球 API','zai':'智谱全球 Coding Plan','zai-coding-cn':'智谱中国 Coding Plan',deepseek:'DeepSeek API'})[id] || id || '模型'; }
export function optionsView(task) {
  return `<div class="option-grid">${task.options.map(option=>`<div class="option-row ${task.selectedOptionIds.includes(option.id)?'selected':''}" data-option="${escapeHtml(option.id)}"><label class="option-choice"><input type="checkbox" data-choice="${escapeHtml(option.id)}" ${task.selectedOptionIds.includes(option.id)?'checked':''}/><span class="option-copy"><strong>${escapeHtml(option.title)}</strong><span>${escapeHtml(brief(option.description))}</span></span></label>${task.optionNotes[option.id]?'<span class="option-note-mark">已补充</span>':''}<button class="icon-button option-detail" data-detail="${escapeHtml(option.id)}" aria-label="${escapeHtml(option.title)}：详情与补充" title="完整说明与补充">${icon('more')}</button></div>`).join('')}</div><textarea id="freeformInput" class="freeform-input" aria-label="补充自己的方向" placeholder="补充自己的方向或具体要求…">${escapeHtml(task.freeform)}</textarea>`;
}
export function ratingView(task,versionId) {
  const scores=task.ratingDrafts?.[versionId]?.scores || {};
  return `<div class="rating-grid">${(typeInfo(task.versions?.find(v=>v.id===versionId)?.artifact?.type||task.artifactType)?.dimensions||dimensions).map(name=>`<div class="rating-row"><span title="1 分：差距明显；3 分：基本符合；5 分：符合预期">${name}</span><span class="stars" data-rating="${name}">${[1,2,3,4,5].map(score=>`<button class="star ${score<=(scores[name]||0)?'active':''}" data-score="${score}" aria-label="${name} ${score} 分" aria-pressed="${score===scores[name]}">★</button>`).join('')}</span></div>`).join('')}</div><textarea id="ratingComment" class="rating-comment" aria-label="评价补充" placeholder="补充你的直观感受…">${escapeHtml(task.ratingDrafts?.[versionId]?.comment||'')}</textarea>`;
}
