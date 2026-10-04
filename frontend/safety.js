import {escapeHtml as esc} from './components.js';
import {renderSafetyEvidence} from './safety-evidence.js';
import {createSafetyRecoveryUi} from './safety-recovery.js';
import {createDisclosureUi} from './minimal-disclosure.js';
import {createSafetyCheckUi} from './safety-check.js';
import {createMemoryUi} from './reviewed-memory.js';

export function createSafetyUi({api,getTask,getLanguage,persist,toast,beforeRecovery=async()=>persist(),onRecovered=()=>{}}){
  const t=(zh,en)=>getLanguage()==='en-US'?en:zh;
  const policyDialog=document.createElement('dialog'),approval=document.createElement('dialog');
  for(const el of [policyDialog,approval]){el.className='safety-dialog';el.dataset.localized='';document.body.append(el);}
  policyDialog.id='safetyDialog';approval.id='safetyApproval';
  let pending=[],current=null,policyTask=null,busy=false,historyFilter='attention';
  const unreadBlocks=new Set();
  const disclosure=createDisclosureUi({api,t,toast});
  const checkUi=createSafetyCheckUi({api,t,persist,toast});
  const memoryUi=createMemoryUi({api,t,persist,toast});
  const recovery=createSafetyRecoveryUi({api,t,toast,onRecovered,beforeOpen:async taskId=>{await beforeRecovery(taskId);if(policyDialog.open)policyDialog.close();}});
  const message=error=>String(error.message||error).replace(/^Error invoking remote method '[^']+': (?:SafetyError|Error): /,'');
  const actionName=kind=>({disclosure:t('最小必要信息外发','Minimum necessary disclosure'),model:t('发送模型上下文','Send model context'),search:t('发送搜索问题','Send a search query'),web:t('读取网页','Read a web source'),read:t('读取工作文件','Read a work file'),write:t('修改工作文件','Change a work file')})[kind]||kind;
  const classification=kind=>({normal:t('普通材料','Ordinary material'),private:t('每次外发需确认','Approve each transfer'),blocked:t('禁止外发','Never send')})[kind]||kind;
  const resultName=value=>({allowed:t('按现有授权允许','Allowed by policy'),approved:t('用户批准','Approved by user'),requested:t('请求确认','Approval requested'),blocked:t('已阻止','Blocked'),denied:t('用户拒绝','Denied by user'),cancelled:t('已取消或失效','Cancelled or expired'),updated:t('权限已更新','Policy updated')})[value]||classification(value);
  const evidence=request=>renderSafetyEvidence(request.explanation,{t,action:actionName(request.kind),target:request.target});
  function refreshButton(){const button=document.querySelector('#safetyButton');if(button)button.textContent=t('安全与授权','Safety & permissions')+(unreadBlocks.has(getTask()?.id)?t(' · 有拦截记录',' · Blocked action'): '');}
  function recordsMarkup(){
    const ended=new Set(current.events.filter(e=>e.requestId&&e.outcome!=='requested').map(e=>e.requestId));
    const events=historyFilter==='all'?current.events:current.events.filter(e=>
      ['blocked','denied','approved','cancelled'].includes(e.outcome)||
      (e.outcome==='requested'&&!ended.has(e.requestId))||
      (e.outcome==='allowed'&&e.explanation?.links.some(l=>l.relation!=='context')));
    return `<summary>${t('操作记录与材料关联','Action history and material links')} · ${current.events.length}</summary><label class="safety-history-filter">${t('显示','Show')} <select id="safetyHistoryFilter"><option value="attention" ${historyFilter==='attention'?'selected':''}>${t('拦截、确认与材料关联','Blocked, approvals and material links')}</option><option value="all" ${historyFilter==='all'?'selected':''}>${t('全部权限判断','All permission decisions')}</option></select></label><p class="safety-note">${t('这里记录权限判断。“允许”或“批准”不表示操作已经执行成功。','These are permission decisions. Allowed or approved does not mean execution succeeded.')}</p><ol class="safety-events">${events.slice(-200).reverse().map(e=>`<li data-safety-event="${esc(e.id)}"><strong>${esc(resultName(e.outcome))}</strong> · ${esc(actionName(e.kind))}<small>${esc(e.target||'')} · ${esc(e.at)}</small>${e.reason?`<small>${esc(e.reason)}</small>`:''}${e.target?`<details class="safety-event-evidence" ${['blocked','denied'].includes(e.outcome)?'open':''}><summary>${t('查看材料与操作的关系','Inspect material links')}</summary>${evidence(e)}</details>`:''}</li>`).join('')}</ol>${!events.length?`<p class="safety-note">${t('暂无需要关注的操作。可切换查看全部判断。','No actions in this view. Switch to all decisions for the full history.')}</p>`:''}`;}
  function updateRecords(){
    const panel=policyDialog.querySelector('#safetyRecords');if(!panel)return;
    const list=panel.querySelector('.safety-events'),scroll=list?.scrollTop||0;
    const expanded=new Map([...panel.querySelectorAll('[data-safety-event]')].map(el=>[el.dataset.safetyEvent,el.querySelector('.safety-event-evidence')?.open]));
    panel.innerHTML=recordsMarkup();bindHistoryFilter();
    panel.querySelectorAll('[data-safety-event]').forEach(el=>{const detail=el.querySelector('.safety-event-evidence');if(detail&&expanded.has(el.dataset.safetyEvent))detail.open=expanded.get(el.dataset.safetyEvent);});
    const next=panel.querySelector('.safety-events');if(next)next.scrollTop=scroll;
  }
  function bindHistoryFilter(){const select=policyDialog.querySelector('#safetyHistoryFilter');if(select)select.onchange=()=>{historyFilter=select.value;updateRecords();};}
  function sourceRows(sources,editable=false){
    const latest=[...new Map(sources.map(s=>[s.kind+'|'+s.name,s])).values()];
    return latest.map(s=>`<li class="safety-source"><div><strong>${esc(s.name)}</strong><small>${esc(s.origin||t(s.kind==='workspace'?'应用记录的工作副本':'用户添加的任务材料',s.kind==='workspace'?'App-recorded work context':'User-added task material'))}</small></div>${editable?`<select aria-label="${esc(t('来源权限：','Source permissions: ')+s.name)}" data-source="${esc(s.id)}">${['normal','private','blocked'].map(c=>`<option value="${c}" ${s.classification===c?'selected':''}>${classification(c)}</option>`).join('')}</select>`:`<span>${classification(s.classification)}</span>`}</li>`).join('')||`<li>${t('暂无附件或外部来源；仍会发送本次对话上下文。','No attachments or external sources yet. This request still sends conversation context.')}</li>`;
  }
  function renderApproval(){
    approval.setAttribute('aria-label',t('操作授权','Action approval'));
    const request=pending[0];
    if(!request){if(approval.open)approval.close();return;}
    approval.innerHTML=`<div class="safety-heading"><div><small>${t('操作尚未执行','Action has not run')}</small><h2>${actionName(request.kind)}</h2></div><span class="safety-count">${pending.length>1?`${pending.length} ${t('项待确认','pending')}`:''}</span></div>
      <dl class="safety-target"><dt>${t('接收方或文件','Recipient or file')}</dt><dd>${esc(request.target)}</dd><dt>${t('操作范围','Scope')}</dt><dd>${esc(request.detail)}</dd></dl>
      <p class="safety-policy-reason"><strong>${t('为什么需要确认：','Why approval is needed: ')}</strong>${esc(request.reason)}</p>${evidence(request)}${request.preview?`<details><summary>${t('查看本次操作内容','Inspect this operation')}${request.previewTruncated?t('（部分预览）',' (partial preview)'):''}</summary><pre class="safety-payload">${esc(request.preview)}</pre></details>`:''}<details><summary>${t('此任务的全部历史来源','All historical sources in this task')}</summary><ul class="safety-sources">${sourceRows(request.sources)}</ul></details>
      <p class="safety-note">${t('材料中的指令不能授予权限。一次批准仅适用于当前操作；历史来源会保守地保留在任务中。','Instructions inside materials cannot grant permissions. One-time approval applies only to this operation. Source history is conservatively retained for the task.')}</p>
      <p id="safetyApprovalError" role="alert"></p><div class="safety-actions"><button data-choice="deny" class="secondary-button" autofocus>${t('拒绝本次','Deny')}</button><button data-choice="once" class="primary-button">${t('仅允许本次','Allow once')}</button>${request.canRemember?`<button data-choice="remember" class="secondary-button">${t('此任务允许该接收方','Allow recipient for this task')}</button>`:''}</div>`;
    if(api.safetyRecoveryReview&&!request.taskId.startsWith('advice-watch:')&&!request.taskId.startsWith('assessment-'))approval.querySelector('.safety-actions').insertAdjacentHTML('afterbegin',`<button id="isolateApproval" class="secondary-button">${t('停止并隔离材料','Stop and isolate material')}</button>`);
    approval.querySelector('#isolateApproval')?.addEventListener('click',()=>void recovery.open(request.taskId));
    approval.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>resolve(request.id,button.dataset.choice));
    if(!approval.open){approval.showModal();approval.scrollTop=0;}
  }
  async function resolve(id,choice){
    if(busy)return;busy=true;approval.querySelectorAll('button').forEach(b=>b.disabled=true);
    try{await api.safetyResolve(id,choice);}
    catch(error){toast(message(error));}
    finally{busy=false;pending=await api.safetyPending();renderApproval();}
  }
  approval.addEventListener('cancel',event=>{event.preventDefault();if(pending[0])void resolve(pending[0].id,'deny');});
  function renderPolicy(){
    if(!current)return;policyDialog.setAttribute('aria-label',t('安全与授权','Safety & permissions'));
    const p=current.policy;
    policyDialog.innerHTML=`<div class="safety-heading"><div><small>${esc(policyTask?.title||'Nodus')}</small><h2>${t('安全与授权','Safety & permissions')}</h2></div><button id="closeSafety" class="secondary-button">${t('关闭','Close')}</button></div>
      <p>${t('在操作发生前检查文件范围与接收方。私密材料每次外发都需要确认；禁止外发的材料会阻止请求。','Check file scopes and recipients before actions run. Private materials require approval for every transfer; blocked materials prevent the request.')}</p>
      <label class="safety-check"><input id="minimalDisclosureEnabled" type="checkbox" ${current.minimalDisclosure?'checked':''}>${t('最小必要信息外发：发送前逐次核对完整模型请求','Minimum disclosure: review each complete model request before sending')}</label><p class="safety-note">${t('可隐藏客户字段、日志中的密钥或无关段落。开关会保存；隐藏的值仅在本次应用会话中辅助后续核对。改变设置会停止当前调用。','Hide customer fields, log secrets or irrelevant text. The switch is saved; hidden values assist review only during this app session. Changing it stops the current call.')}</p>
      <details id="safetyRecords" ${current.events.some(e=>['blocked','denied'].includes(e.outcome))?'open':''}>${recordsMarkup()}</details>
      <details id="safetyNaturalLanguage"><summary>${t('用一句话描述权限要求','Describe permissions in your own words')}</summary><label>${t('希望允许或禁止哪些操作？','Which actions should be allowed or denied?')}<textarea id="safetyInstructions" rows="2" maxlength="4000" placeholder="${t('例如：只允许修改 src，禁止读取 private；其他权限保持不变。','For example: only edit src, never read private; keep other permissions unchanged.')}"></textarea></label><button type="button" id="proposeSafetyDraft" class="secondary-button">${t('生成待核对草案','Draft for review')}</button><p class="safety-note">${t('将这段要求发送给当前模型。草案不会自动生效；不支持的要求会单独列出。','Send these instructions to the current model. Drafts never activate automatically; unsupported requirements are listed separately.')}</p><div id="safetyDraftResult"></div></details>
      <form id="safetyPolicyForm"><label class="safety-check"><input type="checkbox" id="safetyReadOnly" ${p.readOnly?'checked':''}>${t('当前任务只读，不允许模型修改文件','Read-only task: the model cannot change files')}</label>
      <div class="safety-columns">${[['readPaths','可读取路径','Readable paths'],['writePaths','可修改路径','Writable paths'],['deniedPaths','明确禁止的路径','Denied paths']].map(([key,zh,en])=>`<label>${t(zh,en)}<textarea id="safety-${key}" rows="3" spellcheck="false">${esc(p[key].join('\n'))}</textarea></label>`).join('')}</div>
      <p class="safety-note">${t('每行一个相对路径；“.”表示当前任务工作副本，目录包含其子目录。空列表表示没有预先授权的路径。禁止路径优先。读取的文件会进入已授权模型的上下文。','One relative path per line. “.” means this task’s working copy; a directory includes descendants. Empty lists grant no paths in advance. Denials take precedence. Read files enter the authorized model’s context.')}</p>
      <label>${t('已授权接收方','Authorized recipients')}</label><div class="safety-recipients">${p.destinations.map(value=>{const [kind,origin]=value.split('|');return `<label class="safety-check"><input type="checkbox" data-destination="${esc(value)}" checked><span>${esc(actionName(kind))}<small>${esc(origin)}</small></span></label>`;}).join('')||`<p class="safety-note">${t('尚未授权接收方。首次发送时可以批准本次，或为此任务记住接收方。','No recipients authorized. At the first transfer, allow once or remember the recipient for this task.')}</p>`}</div>
      <p class="safety-note">${t('取消勾选并保存，可撤回后续访问；不会撤回已经发送的数据。','Uncheck and save to revoke future access. Data already sent cannot be recalled.')}</p>
      <button type="submit" class="primary-button">${t('保存权限','Save permissions')}</button><span id="safetySaved" role="status"></span></form>
      <h3>${t('材料与来源','Materials & sources')}</h3><ul class="safety-sources">${sourceRows(current.sources,true)}</ul>
      <p class="safety-note">${t('修改权限会停止当前模型调用。检查覆盖 Nodus 内部调用，不能控制其他应用或导出后单独运行的作品。预览中禁止外部联网、表单提交和弹窗。来源说明不是提示注入检测或安全认证。','Changing permissions stops the current model call. Checks cover Nodus calls, not other apps or exported files run elsewhere. Previews block external networking, form submissions and popups. Source descriptions are not injection detection or security certification.')}</p><p id="safetyError" role="alert"></p>`;
    bindHistoryFilter();
    if(api.memoryDescribe&&!policyTask.id.startsWith('advice-watch:')){policyDialog.querySelector('#safetyRecords').insertAdjacentHTML('beforebegin',`<button id="openReviewedMemory" class="secondary-button">${t('可审阅、可撤销的记忆','Reviewable, revocable memory')}</button>`);policyDialog.querySelector('#openReviewedMemory').onclick=()=>{policyDialog.close();void memoryUi.open(policyTask.id);};}
    if(api.safetyCheckDescribe&&!policyTask.id.startsWith('advice-watch:')){policyDialog.querySelector('#safetyRecords').insertAdjacentHTML('beforebegin',`<button id="openSafetyCheck" class="secondary-button">${t('用自己的任务做安全体检','Safety check for this task')}</button>`);policyDialog.querySelector('#openSafetyCheck').onclick=()=>{policyDialog.close();void checkUi.open(policyTask.id);};}
    policyDialog.querySelector('#minimalDisclosureEnabled').onchange=async event=>{const enabled=event.target.checked;event.target.disabled=true;try{current=await api.disclosureSetting({taskId:policyTask.id,enabled});renderPolicy();}catch(error){toast(message(error));event.target.checked=!enabled;event.target.disabled=false;}};
    if(api.safetyRecoveryReview&&!policyTask.id.startsWith('advice-watch:')){
      policyDialog.querySelector('#safetyRecords').insertAdjacentHTML('beforebegin',`<div class="safety-actions"><button id="openSafetyRecovery" class="secondary-button">${t('隔离材料并重试','Isolate material and retry')}</button>${policyTask.safetyRecovery?`<button id="recoveryOriginals" class="secondary-button">${t('查看隔离前原材料','View preserved originals')}</button>`:''}</div>`);
      policyDialog.querySelector('#openSafetyRecovery').onclick=()=>void recovery.open(policyTask.id);
      policyDialog.querySelector('#recoveryOriginals')?.addEventListener('click',()=>{policyDialog.close();void recovery.originals(policyTask.id);});
    }
    policyDialog.querySelector('#closeSafety').onclick=()=>policyDialog.close();
    policyDialog.querySelector('#proposeSafetyDraft').onclick=async event=>{
      const button=event.currentTarget,output=policyDialog.querySelector('#safetyDraftResult');button.disabled=true;output.textContent=t('正在生成草案…','Drafting…');
      try{
        const draft=await api.safetyDraft({taskId:policyTask.id,instructions:policyDialog.querySelector('#safetyInstructions').value});
        output.innerHTML=`<p><strong>${t('草案尚未生效','Draft is not active')}</strong></p><p>${esc(draft.explanation)}</p><dl class="safety-target"><dt>${t('可读 / 可改 / 禁止','Readable / writable / denied')}</dt><dd>${esc(draft.policy.readPaths.join(', ')||'—')}<br>${esc(draft.policy.writePaths.join(', ')||'—')}<br>${esc(draft.policy.deniedPaths.join(', ')||'—')}</dd><dt>${t('只读','Read only')}</dt><dd>${draft.policy.readOnly?t('是','Yes'):t('否','No')}</dd><dt>${t('接收方','Recipients')}</dt><dd>${esc(draft.policy.destinations.join(', ')||'—')}</dd></dl>${draft.unresolved.length?`<p>${t('尚不能落实的要求：','Not enforced by this draft:')}</p><ul>${draft.unresolved.map(v=>`<li>${esc(v)}</li>`).join('')}</ul>`:''}<button type="button" id="applySafetyDraft" class="secondary-button">${t('填入权限表，继续核对','Fill the form for review')}</button>`;
        output.querySelector('#applySafetyDraft').onclick=()=>{current={...current,policy:{...draft.policy,revision:draft.basedOnRevision}};renderPolicy();policyDialog.querySelector('#safetySaved').textContent=t('草案未生效；核对后点击保存。','Draft is not active; review and save.');};
      }catch(error){output.textContent=message(error);}finally{button.disabled=false;}
    };

    policyDialog.querySelector('#safetyPolicyForm').onsubmit=async event=>{
      event.preventDefault();const button=event.submitter;button.disabled=true;
      const list=key=>policyDialog.querySelector('#safety-'+key).value.split('\n').map(v=>v.trim()).filter(Boolean);
      try{current=await api.safetyPolicy({taskId:policyTask.id,revision:p.revision,policy:{readOnly:policyDialog.querySelector('#safetyReadOnly').checked,readPaths:list('readPaths'),writePaths:list('writePaths'),deniedPaths:list('deniedPaths'),destinations:[...policyDialog.querySelectorAll('[data-destination]:checked')].map(el=>el.dataset.destination)}});renderPolicy();policyDialog.querySelector('#safetySaved').textContent=t(' 已保存',' Saved');}
      catch(error){policyDialog.querySelector('#safetyError').textContent=message(error);button.disabled=false;}
    };
    policyDialog.querySelectorAll('[data-source]').forEach(select=>select.onchange=async()=>{
      select.disabled=true;
      try{current=await api.safetySource({taskId:policyTask.id,sourceId:select.dataset.source,classification:select.value});renderPolicy();}
      catch(error){policyDialog.querySelector('#safetyError').textContent=message(error);select.disabled=false;}
    });
  }
  async function open(scope){
    try{await persist();policyTask=scope?.id?scope:getTask();if(!policyTask)return;current=await api.safetyGet(policyTask.id);unreadBlocks.delete(policyTask.id);refreshButton();renderPolicy();policyDialog.showModal();}
    catch(error){toast(message(error));}
  }
  return {open,refresh(){refreshButton();if(policyDialog.open)renderPolicy();if(approval.open)renderApproval();disclosure.refresh();},async initialize(){
    if(!api.safetyPending)return;
    document.querySelector('#safetyButton').dataset.localized='';document.querySelector('#safetyButton').textContent=t('安全与授权','Safety & permissions');document.querySelector('#safetyButton').onclick=()=>open();window.addEventListener('nodus-open-safety',event=>void open(event.detail));
    api.onSafetyRequests(requests=>{pending=requests;renderApproval();});pending=await api.safetyPending();renderApproval();
    await disclosure.initialize();
    api.onSafetyRecord?.(({taskId,event})=>{
      if(['blocked','denied'].includes(event.outcome)){
        unreadBlocks.add(taskId);refreshButton();
        if(getTask()?.id===taskId)toast(t('操作已阻止；在“安全与授权”中查看材料与操作的关系。','Action blocked. Inspect material links in Safety & permissions.'));
      }
      // Refresh records without replacing an in-progress permission edit.
      if(policyDialog.open&&policyTask?.id===taskId&&current){current.events=[...current.events.filter(e=>e.id!==event.id),event].slice(-200);updateRecords();}
    });
    // Only a deliberate click in the trusted app opens source links externally.
    document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(!link||!/^https?:/i.test(link.href))return;event.preventDefault();if(event.isTrusted)api.openSource(link.href).catch(error=>toast(message(error)));});
  }};
}
