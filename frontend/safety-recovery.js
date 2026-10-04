import {escapeHtml as esc} from './components.js';

export function createSafetyRecoveryUi({api,t,beforeOpen,onRecovered,toast}){
  const dialog=document.createElement('dialog');dialog.id='safetyRecovery';dialog.className='safety-dialog recovery-dialog';dialog.dataset.localized='';document.body.append(dialog);
  let review=null,selections=[],preview=null,selected=0,serial=0,busy=false,readOnly=false;
  const errorText=error=>String(error.message||error).replace(/^Error invoking remote method '[^']+': /,'').replace(/^(?:SafetyError|Error): /,'').replace(/^NODUS_SAFETY: /,'');
  const hintName=hint=>({instruction:t('疑似改写指令','Possible instruction override'),permission:t('疑似授予权限或要求外传','Possible permission claim or transfer request'),operation:t('与被检查操作有关联','Linked to the reviewed operation'),model:t('模型建议核对','Model-suggested review')})[hint]||hint;
  function render(){
    if(!review)return;const m=review.materials[selected],choice=selections[selected];
    dialog.setAttribute('aria-label',t('隔离材料并重试','Isolate material and retry'));
    dialog.innerHTML=`<div class="safety-heading"><div><small>${readOnly?t('保留的原材料','Preserved originals'):t('本轮已停止 · 原任务保持原样','Current run stopped · Original task preserved')}</small><h2>${readOnly?t('隔离记录','Isolation record'):t('隔离材料并重试','Isolate material and retry')}</h2></div><button id="closeRecovery" class="secondary-button">${t('关闭','Close')}</button></div>
      <p class="safety-note">${readOnly?t('这里保留当时的原文、移除选择和净化结果，只供核对。','Preserved originals, removal choices and cleaned results are shown for review.'):t('提示是待核对线索，可能漏报或误报。可选择任意片段移除，或排除整份材料；原文不会被改写。','Hints may miss attacks or flag benign text. Select any segments to remove, or exclude the whole material. Originals remain unchanged.')}</p>
      ${!readOnly?`<p><strong>${t('原始目标：','Original goal: ')}</strong>${esc(review.requirement)}</p><details><summary>${t('核对继续生效的用户要求','Review the user requirements that remain active')}</summary><ul>${(review.rules?.items||[]).filter(r=>r.status!=='retired').map(r=>`<li>${esc(r.text)}</li>`).join('')}</ul></details>`:''}
      <div class="recovery-materials"><label>${t('选择材料','Select material')}<select id="recoveryMaterial">${review.materials.map((s,i)=>`<option value="${i}" ${i===selected?'selected':''}>${esc(s.name)}${selections[i].exclude?t(' · 已排除',' · Excluded'):''}</option>`).join('')}</select></label><span>${review.materials.length} ${t('份材料','materials')}</span></div>
      ${m?`<label class="safety-check"><input type="checkbox" id="recoveryExclude" ${choice.exclude?'checked':''} ${readOnly||!m.available||!m.readable?'disabled':''}>${t('本轮排除整份材料','Exclude this whole material from the retry')}</label>
      <p class="safety-note">${esc(m.origin||'')}${!m.available?t(' · 没有完整原文，本轮必须排除。',' · Complete source unavailable; must be excluded.'):!m.readable?t(' · 当前文件权限不允许重新使用。',' · Current file permissions prohibit reuse.'):m.isImage?t(' · 图片只支持整份保留或排除，不进行文本净化。',' · Images can only be retained or excluded as a whole.'):''}</p>
      ${m.kind==='workspace'&&!m.completeFile?`<p class="safety-note">${t('这里只保留当时读到的上下文或片段，不能还原完整文件；保留后仅作为文字材料提供。','This is a previously read context or fragment, not a complete file. If retained, it is provided only as text material.')}</p>`:''}
      ${!readOnly&&m.text&&m.readable?`<button id="analyzeRecoveryMaterial" class="secondary-button">${t('用当前模型建议可疑片段','Ask the current model to suggest suspicious segments')}</button><p class="safety-note">${t('会将所选材料发送给当前模型，可能产生费用；仍受现有外发权限约束。建议不会自动应用。','Sends the selected material to the current model and may incur cost, subject to existing transfer permissions. Suggestions are not applied automatically.')}</p><div id="recoverySuggestions"></div>`:''}
      <div class="recovery-columns"><section><h3>${t('原材料 · 勾选要移除的片段','Original · Select segments to remove')}</h3><div id="recoverySegments" class="recovery-text">${m.segments?.length?m.segments.map(s=>`<label class="recovery-segment ${choice.remove.includes(s.id)?'is-removed':''}"><input type="checkbox" data-segment="${esc(s.id)}" ${choice.remove.includes(s.id)?'checked':''} ${choice.exclude||readOnly?'disabled':''}><span><small>${t('第','Line ')} ${s.line} ${t('行','')} ${s.hints.map(hintName).map(esc).join(' · ')}</small>${s.hints.length?`<mark>${esc(s.text)}</mark>`:`<span>${esc(s.text)}</span>`}</span></label>`).join(''):esc(m.text??(m.isImage?t('原图片保留在原任务中。','The original image is preserved in the source task.'):t('原文不可用','Original text unavailable')))}</div></section>
      <section><h3>${t('本轮将使用的材料','Material used in this retry')}</h3><pre id="recoveryCleaned" class="recovery-text"></pre></section></div>`:`<p>${t('没有可检查的材料。','No materials available for inspection.')}</p>`}
      ${!readOnly?`<p class="safety-note">${t('重试使用独立副本：旧对话、模型摘要、旧版本和未完成目录全部不继承。只有本次保留的材料和明确列出的工作文件会进入新任务；文件权限和来源分类保持。已发送的数据不能撤回。','Retry uses a separate copy without old conversations, summaries, versions or unfinished work. Only retained materials and listed files enter the new task. File permissions and source labels carry over. Already-sent data cannot be recalled.')}</p>
      <label>${t('重试方式','Retry mode')}<select id="recoveryMode"><option value="reply" ${review.mode==='reply'?'selected':''}>${t('重新回答原问题','Answer the original question again')}</option>${review.artifactType?`<option value="artifact" ${review.mode==='artifact'?'selected':''}>${t('重新制作产物，不继承旧工作副本','Regenerate the artifact in a fresh working copy')}</option>`:''}</select></label>
      <p id="recoveryScope" class="safety-note"></p><p id="recoveryError" role="alert"></p><div class="safety-actions"><button id="refreshRecoveryPreview" class="secondary-button">${t('刷新净化预览','Refresh preview')}</button><button id="startRecovery" class="primary-button" disabled>${t('使用预览内容重新执行','Retry with the previewed content')}</button></div>`:''}`;
    dialog.querySelector('#closeRecovery').onclick=()=>{serial++;if(busy&&review.taskId)void api.stopTask({taskId:review.taskId}).catch(()=>{});dialog.close();};
    dialog.querySelector('#recoveryMaterial').onchange=e=>{selected=Number(e.target.value);render();};
    if(m&&!readOnly){
      dialog.querySelector('#recoveryExclude').onchange=e=>{choice.exclude=e.target.checked;render();void refresh();};
      dialog.querySelectorAll('[data-segment]').forEach(box=>box.onchange=()=>{choice.remove=[...dialog.querySelectorAll('[data-segment]:checked')].map(e=>e.dataset.segment);render();void refresh();});
    }
    if(!readOnly){dialog.querySelector('#recoveryMode').onchange=e=>{review.mode=e.target.value;void refresh();};dialog.querySelector('#refreshRecoveryPreview').onclick=refresh;dialog.querySelector('#startRecovery').onclick=start;}
    dialog.querySelector('#analyzeRecoveryMaterial')?.addEventListener('click',analyze);
    displayPreview();
  }
  function displayPreview(){
    const m=review.materials[selected],clean=preview?.cleaned?.find(c=>c.id===m?.id),output=dialog.querySelector('#recoveryCleaned');
    if(output)output.textContent=clean?(clean.excluded?t('整份排除；不会提供给重试任务。','Excluded completely; not provided to the retry.'):clean.isImage?t('保留整张图片。','Retain the complete image.'):clean.text):t('正在更新预览…','Updating preview…');
    const scope=dialog.querySelector('#recoveryScope');if(scope&&preview)scope.textContent=`${t('本次执行请求：','Request: ')}${preview.message}\n${t('将提供的工作文件：','Working files: ')}${preview.files.join(', ')||t('无','None')}`;
    const button=dialog.querySelector('#startRecovery');if(button)button.disabled=busy||!preview||!selections.some(s=>s.exclude||s.remove.length);
  }
  async function refresh(){
    if(readOnly)return;const request=++serial;preview=null;displayPreview();
    try{const next=await api.safetyRecoveryPreview({reviewId:review.id,selections,mode:review.mode});if(request!==serial)return;preview=next;dialog.querySelector('#recoveryError').textContent='';displayPreview();}
    catch(error){if(request===serial){dialog.querySelector('#recoveryError').textContent=errorText(error);displayPreview();}}
  }
  async function start(){
    if(busy||!preview)return;busy=true;displayPreview();
    try{const result=await api.safetyRecoveryCommit(preview.id);dialog.close();await onRecovered(result);}
    catch(error){preview=null;if(dialog.open)dialog.querySelector('#recoveryError').textContent=errorText(error);else toast(errorText(error));}
    finally{busy=false;displayPreview();}
  }
  async function analyze(){
    if(busy)return;busy=true;const index=selected,request=++serial,material=review.materials[index],button=dialog.querySelector('#analyzeRecoveryMaterial');button.disabled=true;displayPreview();
    try{
      const result=await api.safetyRecoveryAnalyze({reviewId:review.id,materialId:material.id});if(request!==serial||index!==selected)return;
      const output=dialog.querySelector('#recoverySuggestions');
      output.innerHTML=`<p>${result.partial?t('只分析了部分文本。','Only part of the text was analyzed.'):t('模型建议，仍需核对。','Model suggestions still require review.')} ${result.analyzed}/${result.total}</p><ul>${result.segments.map(s=>`<li>${esc(s.id)} · ${esc(s.reason)}</li>`).join('')||`<li>${t('没有提出片段，不代表材料安全。','No segments suggested; this does not establish safety.')}</li>`}</ul>${result.segments.length?`<button id="applyRecoverySuggestions" class="secondary-button">${t('采用这些建议并更新预览','Apply suggestions and update preview')}</button>`:''}`;
      output.querySelector('#applyRecoverySuggestions')?.addEventListener('click',()=>{
        for(const suggestion of result.segments){const segment=material.segments.find(s=>s.id===suggestion.id);if(!segment.hints.includes('model'))segment.hints.push('model');}
        selections[index].exclude=false;selections[index].remove=[...new Set([...selections[index].remove,...result.segments.map(s=>s.id)])];render();void refresh();
      });
    }catch(error){if(dialog.open&&request===serial)dialog.querySelector('#recoveryError').textContent=errorText(error);}
    finally{busy=false;if(button.isConnected)button.disabled=false;displayPreview();}
  }
  return {async open(taskId,eventId){
    try{await beforeOpen(taskId);review=await api.safetyRecoveryReview({taskId,eventId});readOnly=false;selected=0;preview=null;
      selections=review.materials.map(m=>({id:m.id,exclude:m.defaultExclude,remove:m.suggested||[]}));render();dialog.showModal();await refresh();
    }catch(error){toast(errorText(error));}
  },async originals(taskId){
    try{const record=await api.safetyRecoveryOriginals(taskId);review={materials:record.materials.map(m=>({...m,available:m.text!==null,readable:true,isImage:m.isImage}))};selections=record.selections;preview={cleaned:record.cleaned};selected=0;readOnly=true;render();dialog.showModal();}
    catch(error){toast(errorText(error));}
  }};
}
