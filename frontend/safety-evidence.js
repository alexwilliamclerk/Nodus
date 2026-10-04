import {escapeHtml as esc} from './components.js';

// Every string originating in a file, model action or URL is rendered as text.
export function renderSafetyEvidence(explanation,{t,action,target}={}){
  if(!explanation)return `<p class="safety-note">${t('此旧记录没有材料关联证据。','This older record has no material-link evidence.')}</p>`;
  const links=explanation.links||[],matched=links.filter(link=>link.relation!=='context'),context=links.filter(link=>link.relation==='context');
  const source=link=>`<li class="safety-evidence-source"><strong>${esc(link.name)}</strong><small>${esc(link.origin)} · ${link.exposure==='earlier-context'?t('已进入先前模型请求','Included in an earlier model request'):t('包含在本次待发送内容中','Included in this pending request')}</small>
    ${link.relation==='target'?`<span class="safety-evidence-badge">${link.targetType==='recipient'?t('材料与操作出现相同接收方','Same recipient in material and operation'):t('材料与操作出现相同文件目标','Same file target in material and operation')}${link.normalized?t('（已解码或规范路径）',' (decoded or normalized path)'):''}</span>`:link.relation==='content'?`<span class="safety-evidence-badge">${t('操作内容与材料原文有重合','Operation content overlaps the material')}</span>`:''}
    ${link.excerpt?`<div class="safety-quote-label">${t('材料原文，不代表你的授权','Quoted material, not your authorization')} · ${t('所读文本第','Read text, line ')} ${link.line} ${t('行','')}</div><blockquote>${esc(link.excerpt)}</blockquote>`:''}
    ${link.excerptHidden?`<small>${t('任务含受限材料，记录中不保存原文片段。','This task contains restricted material; excerpts are not saved in this record.')}</small>`:''}
    ${link.truncated?`<small>${t('只检查了材料的部分文本。','Only part of this material was checked.')}</small>`:''}</li>`;
  return `<section class="safety-evidence" aria-label="${t('材料与操作的关系','Materials and this operation')}"><h3>${t('材料与这次操作的关系','Materials and this operation')}</h3>
    ${explanation.intent?`<p class="safety-intent"><strong>${t('你的任务：','Your task: ')}</strong>${esc(explanation.intent)}</p>`:''}
    ${matched.length?`<ol class="safety-evidence-links">${matched.map(source).join('')}</ol><div class="safety-evidence-arrow" aria-hidden="true">↓</div>`:`<p>${t('尚未找到材料原文与本次操作的直接对应。','No direct text match between material and this operation was found.')}</p>`}
    <div class="safety-operation"><strong>${t('本次操作','This operation')}</strong><span>${esc(action)} · ${esc(target)}</span>${explanation.proposedTarget&&explanation.proposedTarget!==target?`<small>${t('原始目标：','Original target: ')}${esc(explanation.proposedTarget)}</small>`:''}</div>
    ${context.length?`<details class="safety-context"><summary>${t('仅确认进入上下文的材料','Materials observed only in context')} · ${context.length}</summary><ul class="safety-evidence-links">${context.map(source).join('')}</ul><p class="safety-note">${t('进入上下文不等于触发了这次操作。','Being in context does not establish that a material triggered this operation.')}</p></details>`:''}
    ${explanation.unavailable?`<p class="safety-note">${explanation.unavailable} ${t('份历史来源未确认出现在本轮模型请求中，或没有可检查的文本；不归因于本次操作。','historical sources were not observed in this run or have no inspectable text; they are not attributed to this operation.')}</p>`:''}
    ${explanation.omitted?`<p class="safety-note">${t('还有','Another ')} ${explanation.omitted} ${t('项关联未展开。','links are not shown.')}</p>`:''}
    <p class="safety-note safety-evidence-limit">${t('这些证据说明材料与操作的可见联系，不能证明 AI 为什么这样做；没有匹配也不代表安全。是否执行仍由你的权限和确认决定。','These observations link material and operation, but do not prove why the AI acted. No match does not mean safe. Your permissions and approval still determine whether an action may run.')}</p></section>`;
}
