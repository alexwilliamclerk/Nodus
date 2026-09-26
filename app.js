import {createAdviceWatchUi} from './frontend/advice-watch.js';
let adviceUi;
import {scenicThemes} from './frontend/themes.js';
import { artifactTypes, typeInfo } from './frontend/artifact-types.js';
import {localNode,emptyAnswer,selectedDecision,commitDecision,backDecision,confirmedFlow,isExecutionRequest,prepareFlowConfirmation} from './frontend/decision-flow.js';
import { icon, hydrateIcons, escapeHtml as esc, providerLabel, optionsView, ratingView } from './frontend/components.js';
import {buildRequirementLedger,extractTaskRules,editTaskRule,activeRequirements,requirementSourceLabel} from './frontend/requirements.js';
import {DEFAULT_AGENT_MODE,parseModeCommand,autonomousPlan} from './frontend/agent-modes.js';
import {recoverLegacyDecision} from './frontend/decision-recovery.js';
import {createTranscriptFollower} from './frontend/transcript-follow.js';
import {previewIntervals,modificationCount,previewCheckpointDue} from './frontend/preview-cadence.js';
import {sameEvaluation} from './frontend/evaluation-state.js';
import {createUiTranslator,translateUiText} from './frontend/i18n.js';
import {normalizeChatTurns,deleteChatTurn,deleteDecisionQuestion} from './frontend/question-deletion.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const api = window.forma;
const translator=createUiTranslator(document);
const ui=text=>translateUiText(text,state?.settings?.language||'zh-CN');
document.documentElement.dataset.platform = api?.platform || 'browser';
function applyAppearance(appearance) {
  const root = document.documentElement;
  root.dataset.theme = appearance.dark ? 'dark' : 'light';
  const scenic=scenicThemes.some(t=>t.id===appearance.theme);
  if(scenic)root.dataset.scenicTheme=appearance.theme;else delete root.dataset.scenicTheme;
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.themeChoice===appearance.theme)));
  root.classList.toggle('reduce-transparency', appearance.reducedTransparency);
  root.classList.toggle('increase-contrast', appearance.increasedContrast);
  root.classList.toggle('window-inactive', !appearance.focused);
}
api?.onAppearance?.(applyAppearance);
api?.getAppearance?.().then(applyAppearance).catch(console.error);
let state, model;
let updateInstallMode='guided';
let searchStatus={mode:'off',configured:false,currentSupported:false};
let saveTimer, toastTimer, popoverTimer;
let saveQueue = Promise.resolve();
const layout = { railOpen:true, previewOpen:false, railWidth:210, previewWidth:370, view:'preview', detail:null };
let archiveView = false;
let lastRecordTask = null;
const materialImports = new Set();
const liveResponses=new Map();
let liveFrame=null;
let transcriptFollower;
function renderLiveResponse(task){
  let node=$('#liveResponse');
  const text=liveResponses.get(task.id);
  if(!text&&!isBusy(task)){node?.remove();return;}
  if(!node){$('#timeline').insertAdjacentHTML('beforeend','<article id="liveResponse" class="event agent"><p></p></article>');node=$('#liveResponse');}
  node.querySelector('p').textContent=text||task.operation?.lastActivity||'正在连接模型';
  transcriptFollower?.refresh();
}
const activeTask = () => state.tasks.find(t=>t.id===state.activeTaskId && !t.deletedAt);
const isBusy = task => task?.operation?.status === 'running';
const anyBusy = () => state.tasks.some(isBusy);
const on = (selector, event, fn) => $(selector)?.addEventListener(event, fn);

function normalizeTask(task) {
  if(!['plan','goat'].includes(task.agentMode))task.agentMode=DEFAULT_AGENT_MODE;
  for (const key of ['timeline','options','selectedOptionIds','versions','evaluations','executionEvents','attachments']) task[key] ||= [];
  normalizeChatTurns(task);
  task.optionNotes ||= {};
  task.freeform ||= '';
  recoverLegacyDecision(task);
  if(!task.taskRules&&task.requirementLedger)task.taskRules=task.requirementLedger;
  if(task.stage==='revision'&&task.revisionProposal&&!task.decisionFlow){
    task.decisionFlow={schemaVersion:3,id:crypto.randomUUID(),trigger:'adjust',baseVersionId:task.revisionBaseVersionId||task.currentVersionId||null,pendingId:null,artifactType:task.artifactType,history:[],invalidated:[],current:localNode('area',task.artifactType),draft:emptyAnswer(),status:'answering',summary:null};
    task.stage='decision';
  }
  const hasLegacyDraft = !task.ratingDrafts;
  task.ratingDrafts ||= {};
  if (hasLegacyDraft && task.previewVersionId && (Object.keys(task.ratingsDraft || {}).length || task.ratingCommentDraft)) {
    task.ratingDrafts[task.previewVersionId] = { scores: task.ratingsDraft || {}, comment:task.ratingCommentDraft || '' };
  }
  return task;
}

function createTask(projectId = null) {
  const task = normalizeTask({id:`task-${crypto.randomUUID()}`,title:'新对话',requirement:'',stage:'input',status:'待输入',createdAt:new Date().toISOString(),projectId,artifactType:null});
  state.tasks.unshift(task);
  state.activeTaskId = task.id;
  archiveView = false;
  persist(task); render(); $('#requirementInput')?.focus();
}

function persist(task) {
  if (task) task.updatedAt = new Date().toISOString();
  clearTimeout(saveTimer);
  $('#saveState').textContent='保存中…';
  saveTimer=setTimeout(()=>persistNow().catch(()=>{}),180);
}
function persistNow() {
  clearTimeout(saveTimer);
  const snapshot=structuredClone(state);
  saveQueue=saveQueue.catch(()=>{}).then(()=>api.saveState(snapshot));
  return saveQueue.then(()=>{$('#saveState').textContent='已保存';},error=>{$('#saveState').textContent='保存失败';throw error;});
}

function render() {
  const task=activeTask();
  renderNav(); renderModel();
  if (!task) return createTask();
  $('#taskTitle').textContent=task.title;
  renderTimeline(task); renderAction(task); renderPreview(task);
}
function renderCurrent(task) { if(activeTask()?.id===task.id) render(); else { renderNav(); renderModel(); } }

function taskButton(task) {
  return `<button class="task-item ${task.id===state.activeTaskId?'active':''}" data-task-id="${esc(task.id)}" title="${esc(task.title)}">${icon('document')}<span>${esc(task.title)}</span>${isBusy(task)?'<i class="running-dot" aria-label="处理中"></i>':''}</button>`;
}
function renderNav() {
  const tasks=state.tasks.filter(t=>!t.deletedAt).sort((a,b)=>(b.updatedAt||b.createdAt||'').localeCompare(a.updatedAt||a.createdAt||''));
  if(archiveView) {
    $('#taskList').innerHTML=`<section class="nav-section"><div class="section-heading">已归档<button class="text-button" id="exitArchive">返回</button></div>${tasks.filter(t=>t.archivedAt).map(taskButton).join('')||'<p class="empty-list">暂无归档对话</p>'}</section>`;
    on('#exitArchive','click',()=>{archiveView=false;renderNav();});
  } else {
    const current=tasks.filter(t=>!t.archivedAt);
    $('#taskList').innerHTML=`<section class="nav-section"><div class="section-heading">置顶</div>${current.filter(t=>t.pinned).map(taskButton).join('')||'<p class="empty-list">右键对话可置顶</p>'}</section><section class="nav-section"><div class="section-heading">项目<button id="newProjectButton" class="icon-button" aria-label="新建项目">${icon('plus')}</button></div>${(state.settings.projects||[]).map(project=>`<details class="project-group" open><summary>${icon('folder')}<span>${esc(project.name)}</span></summary>${current.filter(t=>t.projectId===project.id).map(taskButton).join('')}<button class="task-item" data-new-project-task="${esc(project.id)}">${icon('plus')}新对话</button></details>`).join('')||'<p class="empty-list">按项目组织对话</p>'}</section><section class="nav-section"><div class="section-heading">最近</div>${current.filter(t=>!t.pinned && !t.projectId).map(taskButton).join('')||'<p class="empty-list">暂无其他对话</p>'}</section>`;
    on('#newProjectButton','click',()=>manage({title:'新建项目',description:'项目用于归组对话，不移动已有作品文件。',value:'',submit:name=>{if(!name.trim())return false;(state.settings.projects||=[]).push({id:crypto.randomUUID(),name:name.trim()});persist();renderNav();}}));
    $$('[data-new-project-task]').forEach(button=>button.onclick=()=>createTask(button.dataset.newProjectTask));
  }
  $$('[data-task-id]').forEach(button=>{
    button.onclick=()=>{state.activeTaskId=button.dataset.taskId;layout.detail=null;layout.view='preview';persist();render();};
    button.oncontextmenu=event=>{event.preventDefault();openTaskMenu(button.dataset.taskId,event.clientX,event.clientY);};
    button.onkeydown=event=>{if(event.key==='ContextMenu'||(event.shiftKey&&event.key==='F10')){event.preventDefault();const r=button.getBoundingClientRect();openTaskMenu(button.dataset.taskId,r.left+15,r.bottom);}};
  });
}

function openTaskMenu(id,x,y) {
  const task=state.tasks.find(t=>t.id===id);
  const menu=$('#taskContextMenu');
  menu.innerHTML=[['pin',task.pinned?'取消置顶':'置顶'],['rename','重命名'],['project','移到项目'],['archive',task.archivedAt?'恢复对话':'归档'],['delete','删除']].map(([action,label])=>`<button role="menuitem" class="menu-button ${action==='delete'?'danger':''}" data-task-action="${action}">${esc(label)}</button>`).join('');
  menu.hidden=false;
  menu.style.left=`${Math.min(x,innerWidth-menu.offsetWidth-8)}px`;
  menu.style.top=`${Math.min(y,innerHeight-menu.offsetHeight-8)}px`;
  $$('[data-task-action]').forEach(button=>button.onclick=()=>{menu.hidden=true;manageTask(task,button.dataset.taskAction);});
  menu.querySelector('button').focus();
}
function manage({title,description,value=null,submit}) {
  $('#manageTitle').textContent=title;$('#manageDescription').textContent=description;
  $('#manageInput').hidden=value===null;$('#manageInput').value=value||'';
  $('#manageForm').onsubmit=async event=>{event.preventDefault();const result=await submit($('#manageInput').value);if(result!==false)$('#manageDialog').close();};
  $('#manageDialog').showModal();
  (value===null?$('#confirmManage'):$('#manageInput')).focus();
}
function manageTask(task,action) {
  if(action==='pin'){task.pinned=!task.pinned;persist(task);renderNav();return;}
  if(action==='rename')return manage({title:'重命名对话',description:'只修改名称，记录与作品保持原样。',value:task.title,submit:value=>{if(!value.trim())return false;task.title=value.trim();task.customTitle=true;persist(task);render();}});
  if(action==='project')return manage({title:'移到项目',description:'输入已有项目名称或新项目名称；留空移回最近。',value:state.settings.projects?.find(p=>p.id===task.projectId)?.name||'',submit:value=>{const name=value.trim();const projects=state.settings.projects||=[];let project=projects.find(p=>p.name===name);if(name&&!project){project={id:crypto.randomUUID(),name};projects.push(project);}task.projectId=project?.id||null;persist(task);renderNav();}});
  if(isBusy(task))return showToast('此对话仍在运行，请先停止再归档或删除。');
  if(action==='archive'){task.archivedAt=task.archivedAt?null:new Date().toISOString();persist(task);render();return;}
  manage({title:'删除这条对话？',description:`“${task.title}”将从导航中移除。已有作品文件和版本记录保留在本机，不连带删除。`,submit:()=>{task.deletedAt=new Date().toISOString();if(state.activeTaskId===task.id)state.activeTaskId=state.tasks.find(t=>!t.deletedAt&&!t.archivedAt)?.id||null;persist();render();}});
}

function confirmDeleteChat(task,turnId){
  if(isBusy(task)||task.archivedAt)return;
  manage({title:'删除这条提问及回答？',description:'这轮提问和回答会从对话及后续答复的上下文中移除。已确认的任务要求和已生成作品不受影响。',submit:async()=>{
    const before=structuredClone(task);
    try{deleteChatTurn(task,turnId);task.updatedAt=new Date().toISOString();await persistNow();renderCurrent(task);}
    catch(error){Object.assign(task,before);$('#manageDescription').textContent=error.message;return false;}
  }});
}

function confirmDeleteDecision(task,index){
  if(isBusy(task)||task.archivedAt)return;
  const flow=task.decisionFlow,flowId=flow?.id;
  const question=index===null?flow?.current:flow?.history?.[index]?.node;
  if(!question)return;
  manage({title:'删除这道选择题？',description:index===null?'当前题目及未提交选择会移除。你可以继续生成下一题，或确认此前已选内容。':`将移除这道题及其之后的选择，相关要求停止生效，需要重新确认制作范围。已生成的作品版本保留。`,submit:async()=>{
    const before=structuredClone(task);
    try{
      if(task.decisionFlow?.id!==flowId)throw new Error('制作流程已变化，请重新选择题目。');
      deleteDecisionQuestion(task,index);task.updatedAt=new Date().toISOString();
      await persistNow();layout.view='preview';layout.detail=null;renderCurrent(task);
    }catch(error){Object.assign(task,before);$('#manageDescription').textContent=error.message;return false;}
  }});
}

function renderTimeline(task) {
  normalizeChatTurns(task);
  const panel=$('#recordPanel');
  const changed=lastRecordTask!==task.id;
  const position=panel.scrollTop;
  $('#timeline').innerHTML=task.timeline.length?task.timeline.map((event,eventIndex)=>`<article class="event ${event.type==='user'?'user':'agent'}">${event.type==='user'&&event.kind==='chat'?`<button type="button" class="text-button delete-question" data-delete-turn="${esc(event.turnId)}" aria-label="删除这条提问及回答" ${isBusy(task)||task.archivedAt?'disabled':''}>删除</button>`:''}${event.meta?.includes('评价')||event.meta?.includes('修改')?`<div class="event-meta">${esc(event.meta)}</div>`:''}<p>${esc(event.text)}</p>${event.type==='agent'&&event.text?`<button type="button" class="text-button" data-adopt-advice="${eventIndex}">采纳并追踪</button>`:''}${event.sources?.length?`<ul class="search-sources">${event.sources.map(source=>`<li><a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">${esc(source.title)}</a>${source.snippet?`<p>${esc(source.snippet)}</p>`:''}</li>`).join('')}</ul>`:''}</article>`).join(''):'<div class="welcome"><strong>从一个想法出发，改变世界</strong><p>描述你的任务目标和交付格式，我们一起确定方向。</p></div>';
  if(task.versions.length||task.requirementLedger?.items?.length)$('#timeline').insertAdjacentHTML('beforeend',`<div class="event-actions">${task.versions.length?`<button id="viewWorkButton" class="text-button">${icon('preview')}查看作品 · ${esc(task.currentVersionId?.toUpperCase())}</button>`:''}<button id="understandingButton" class="text-button">任务要求</button></div>`);
  on('#viewWorkButton','click',()=>{layout.view='preview';setPreview(true);});
  $$('#timeline [data-adopt-advice]').forEach(button=>button.onclick=()=>adviceUi?.adopt(task,task.timeline[Number(button.dataset.adoptAdvice)]));
  $$('#timeline [data-delete-turn]').forEach(button=>button.onclick=()=>confirmDeleteChat(task,button.dataset.deleteTurn));
  if(task.versions.length){
    $('#timeline .event-actions').insertAdjacentHTML('beforeend','<button id="openWorkDirectory" class="text-button">打开目录</button><button id="exportWork" class="text-button">导出作品…</button>');
    const versionId=task.stage==='accepted'?(task.acceptedVersionId||task.currentVersionId):(task.previewVersionId||task.currentVersionId);
    on('#openWorkDirectory','click',async()=>{try{await persistNow();await api.openVersionDirectory({taskId:task.id,versionId});}catch(error){showToast(error.message);}});
    on('#exportWork','click',()=>exportWork(task,versionId));
  }
  on('#understandingButton','click',()=>showRequirements(task));
  if(task.requirementLedger?.items?.length)$('#timeline').insertAdjacentHTML('beforeend',`<details class="event-tools"><summary>有效要求 · ${activeRequirements(task.requirementLedger).length} 项</summary>${activeRequirements(task.requirementLedger).map(item=>`<p><strong>${esc(requirementSourceLabel(item.source))}</strong>：${esc(item.text)}</p>`).join('')}</details>`);
  const events=task.executionEvents.filter(e=>e.type!=='usage');
  if(events.length)$('#timeline').insertAdjacentHTML('beforeend',`<details class="event-tools"><summary>查看记录 · ${events.length} 条</summary>${events.map(e=>`<p>${esc(e.label)}</p>`).join('')}</details>`);
  if(task.operation?.status==='error'||task.operation?.status==='stopped')$('#timeline').insertAdjacentHTML('beforeend',`<p class="error-panel action-error">${esc(task.operation.lastActivity)}</p>`);
  if(task.stage==='revision'&&task.revisionProposal){
    const p=task.revisionProposal;
    if(!p.questions)$('#timeline').insertAdjacentHTML('beforeend',`<article class="event agent"><p><strong>可能原因：</strong>${esc(p.hypothesis)}\n<strong>修改范围：</strong>${esc(p.scope)}\n<strong>保持：</strong>${esc(p.preserve)}</p></article>`);
  }
  lastRecordTask=task.id;
  renderLiveResponse(task);
  if(!changed&&!transcriptFollower?.following)panel.scrollTop=position;
  transcriptFollower?.refresh(changed);
}

function submitButton(id,label,handler,disabled=false,symbol='send') {
  $('#actionSubmitSlot').insertAdjacentHTML('beforeend',`<button id="${id}" class="send-button" aria-label="${esc(label)}" title="${esc(label)}" ${disabled?'disabled':''}>${icon(symbol)}</button>`);
  on(`#${id}`,'click',handler);
}
function footerAction(id,label,handler) { $('#actionSubmitSlot').insertAdjacentHTML('beforeend',`<button id="${id}" class="text-button">${esc(label)}</button>`);on(`#${id}`,'click',handler); }
function showError(message) { $('#actionError').hidden=!message;$('#actionError').textContent=message||''; }
function renderAction(task) {
  const projectSelector=$('#taskProjectSelect');
  projectSelector.innerHTML='<option value="">未分组</option>'+(state.settings.projects||[]).map(p=>`<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('')+'<option value="__new__">新建项目…</option>';
  projectSelector.value=task.projectId||'';projectSelector.disabled=isBusy(task)||Boolean(task.archivedAt);
  projectSelector.onchange=()=>{
    if(projectSelector.value==='__new__'){projectSelector.value=task.projectId||'';manage({title:'新建项目',description:'项目用于分组对话，本地目录单独选择。',value:'',submit:name=>{if(!name.trim())return false;const p={id:crypto.randomUUID(),name:name.trim()};(state.settings.projects||=[]).push(p);task.projectId=p.id;persist(task);render();}});return;}
    task.projectId=projectSelector.value||null;persist(task);renderNav();
  };
  const directoryButton=$('#chooseDeliveryDirectory');directoryButton.textContent=task.deliveryDirectory?`目录：${task.deliveryDirectory.split(/[\\/]/).filter(Boolean).at(-1)}`:'选择本地目录…';directoryButton.title=task.deliveryDirectory||'首次制作前请选择本地交付目录';directoryButton.disabled=isBusy(task)||Boolean(task.archivedAt);directoryButton.onclick=()=>chooseDeliveryDirectory(task);
  const modeSelector=$('#agentModeSelect');modeSelector.value=task.agentMode;modeSelector.disabled=isBusy(task)||Boolean(task.archivedAt);
  modeSelector.onchange=()=>{task.agentMode=modeSelector.value;persist(task);renderAction(task);};
  $('#actionSubmitSlot').replaceChildren();$('#dynamicAction').replaceChildren();showError('');
  $('#actionPanel').setAttribute('aria-busy',String(isBusy(task)));
  $('#decisionTools').hidden=true;
  const selector=$('#artifactTypeSelect');
  selector.hidden=!['input','options'].includes(task.stage)||Boolean(task.archivedAt);
  selector.disabled=isBusy(task)||Boolean(task.versions.length);
  selector.innerHTML='<option value="">自动识别类型</option>'+Object.entries(artifactTypes).map(([id,info])=>`<option value="${id}">${esc(info.label)}</option>`).join('')+'<option value="__other__">其他类型，先讨论…</option>';
  selector.value=task.artifactType||'';
  selector.title=task.deliverySummary||'主产物类型；项目仅用于对话分组';
  selector.onchange=async()=>{
    if(selector.value==='__other__'){selector.value=task.artifactType||'';detectTypeOnDemand();return;}
    task.artifactType=selector.value||null;task.typeConfirmed=Boolean(selector.value);task.clarification=null;
    task.deliverySummary='';task.decisionContext='';task.recommendation=null;
    task.options=[];task.selectedOptionIds=[];task.optionNotes={};task.decisionQuestion='';task.stage='input';persist(task);renderAction(task);
    if(task.requirement.trim())await requestOptions(task,false);
  };
  $('#dialogLauncher').hidden=state.settings.showTemporaryDialog===false;
  $('#dialogLauncher').disabled=isBusy(task)||task.temporaryOpen||Boolean(task.archivedAt);
  $('#webSearchButton').disabled=isBusy(task)||Boolean(task.archivedAt);
  $('#attachButton').disabled=isBusy(task)||!['input','options','decision'].includes(task.stage)||Boolean(task.archivedAt);
  $('#modelButton').disabled=anyBusy();
  renderAttachments(task);
  if(task.archivedAt){$('#actionTitle').textContent='已归档对话';footerAction('restoreConversation','恢复对话',()=>manageTask(task,'archive'));return;}
  if(task.temporaryOpen)return renderTemporary(task);
  if(isBusy(task)){
    $('#actionTitle').textContent='';
    $('#dynamicAction').innerHTML='<textarea class="requirement-input" aria-label="任务处理中" readonly></textarea>';
    submitButton('stopExecution','停止',()=>stopTask(task),Boolean(task.stopRequested),'stop');return;
  }
  if(task.stage==='decision')return renderDecisionFlow(task);
  if(task.stage==='paused'){
    $('#actionTitle').textContent='';footerAction('resumeDecision','继续选择',()=>{task.stage='decision';task.decisionFlow.status='answering';persist(task);render();});footerAction('reviewPausedPath','查看已选',()=>showDecisionPath(task));return;
  }
  if(task.stage==='input'){
    $('#actionTitle').textContent='想聊什么，或想制作什么？';
    $('#dynamicAction').innerHTML=`<textarea id="requirementInput" class="requirement-input" aria-label="消息或任务需求" placeholder="直接聊天；需要制作作品时点击“制作作品”…">${esc(task.requirement)}</textarea>`;
    on('#requirementInput','input',e=>{task.requirement=e.target.value;if(!task.typeConfirmed&&!task.versions.length)task.artifactType=null;persist(task);});
    footerAction('submitRequirement','制作作品',()=>submitRequirement(task));
    submitButton('sendChat','发送消息',()=>sendInitialChat(task));return;
  }
  if(task.stage==='options'){
    $('#actionTitle').textContent=task.decisionQuestion||'选择制作方向';$('#decisionTools').hidden=false;
    $('#dynamicAction').innerHTML=optionsView(task);
    $$('[data-choice]').forEach(input=>input.onchange=()=>{const id=input.dataset.choice;task.selectedOptionIds=input.checked?[...task.selectedOptionIds,id]:task.selectedOptionIds.filter(v=>v!==id);persist(task);renderAction(task);});
    $$('[data-detail]').forEach(button=>button.onclick=()=>showOption(task,button.dataset.detail));
    on('#freeformInput','input',e=>{task.freeform=e.target.value;persist(task);$('#submitDecision').disabled=!hasChoice(task);});
    footerAction('completionSettings','完成条件',()=>editCompletion(task));
    submitButton('submitDecision','提交选择',()=>executeV1(task),!hasChoice(task));return;
  }
  if(task.stage==='rating'){
    const versionId=task.previewVersionId||task.currentVersionId;
    task.ratingDrafts[versionId] ||= {scores:{},comment:''};
    $('#actionTitle').textContent=`评价 ${versionId.toUpperCase()} · 这版符合你的期待吗？`;
    $('#dynamicAction').innerHTML=ratingView(task,versionId);
    footerAction('adjustWithoutRating','调整',()=>beginDecision(task,'adjust',null,versionId));
    const evidence=task.versions.find(v=>v.id===versionId)?.completion;
    if(evidence) {
      footerAction('completionEvidence','查看依据',()=>showCompletion(evidence));
    }
    $$('[data-rating]').forEach(group=>group.querySelectorAll('button').forEach(button=>button.onclick=()=>{task.ratingDrafts[versionId].scores[group.dataset.rating]=Number(button.dataset.score);persist(task);renderAction(task);}));
    on('#ratingComment','input',e=>{task.ratingDrafts[versionId].comment=e.target.value;persist(task);});
    footerAction('skipRating','跳过',()=>{task.stage='accepted';task.status='暂未评价';persist(task);render();});
    $('#dynamicAction').insertAdjacentHTML('beforeend',`<div class="delivery-actions"><button id="acceptWork" class="primary-button">接受 ${esc(versionId.toUpperCase())} 并结束</button><button id="submitRating" class="secondary-button">提交评价，继续改进</button></div>`);
    on('#acceptWork','click',()=>{
      const alreadyAccepted=task.acceptedVersionId===versionId||task.timeline.some(event=>event.type==='user'&&event.text?.startsWith(`${versionId.toUpperCase()} 已接受`));
      task.stage='accepted';task.status='已接受';task.acceptedVersionId=versionId;
      if(task.decisionFlow&&task.decisionFlow.status!=='completed')task.decisionFlow.status='abandoned';
      if(!alreadyAccepted)addRecord(task,'user',`${versionId.toUpperCase()} 已接受，本轮任务结束，不再自动修改。${evidence&&evidence.status!=='passed'?'仍保留未验证条件，不表示全部目标已完成。':''}`);
      persist(task);render();
    });
    on('#submitRating','click',()=>submitRating(task,versionId));return;
  }
  if(task.stage==='revision'){
    $('#actionTitle').textContent='';footerAction('rebuildInterview','继续调整',()=>beginDecision(task,'adjust',null,task.revisionBaseVersionId||task.currentVersionId));return;
  }
  if(task.stage==='accepted'){
    $('#actionTitle').textContent='';
    footerAction('continueRevision','继续评价',()=>{task.stage='rating';persist(task);renderAction(task);});footerAction('adjustWithoutRating','调整',()=>beginDecision(task,'adjust'));return;
  }
  $('#actionTitle').textContent='';
  footerAction('openErrorSettings','模型设置',openSettings);
  footerAction('retryAction','返回重试',()=>{task.stage=task.retryStage||'input';task.error=null;persist(task);render();});
  footerAction('failureDecisions','选择处理方式',()=>beginDecision(task,'failure'));
}

async function beginDecision(task,trigger,evaluation=null,baseVersionId=null){
  if(isBusy(task))return;
  const previous=task.decisionFlow;
  if(trigger==='adjust'&&previous?.status==='parked'&&(previous.baseVersionId||null)===(baseVersionId||task.currentVersionId||null)){
    previous.returnStage=task.stage;task.stage='decision';previous.status='answering';persist(task);renderCurrent(task);return;
  }
  if(trigger==='adjust'&&task.stage==='decision')return;
  const pending=['pause','failure'].includes(trigger)?await api.taskWorkspace(task.id):null;
  if(previous)(task.decisionFlowHistory||=[]).push(structuredClone(previous));
  task.decisionFlow={schemaVersion:3,id:crypto.randomUUID(),trigger,evaluation,baseVersionId:pending?pending.baseVersionId:(baseVersionId||(['pause','failure'].includes(trigger)?previous?.baseVersionId:null)||task.currentVersionId||null),pendingId:pending?.pendingId||null,artifactType:pending?.artifactType||task.artifactType,
    returnStage:['pause','failure'].includes(trigger)?(task.retryStage||task.stage):task.stage,retryPhase:task.operation?.phase,errorMessage:task.error?.message||task.operation?.lastActivity||'',resumeFlow:['pause','failure'].includes(trigger)&&previous?structuredClone(previous):null,
    history:[],invalidated:[],current:localNode(trigger==='pause'?'pause':trigger==='failure'?'failure':'area',pending?.artifactType||task.artifactType),draft:emptyAnswer(),status:'answering',summary:null};
  if(task.versions.length&&['rating','adjust'].includes(trigger)){
    const current=task.previewVersionId||task.currentVersionId;
    addRecord(task,'agent',state.settings.language==='en-US'?`The preview currently shows ${current?.toUpperCase()||'the existing version'}. Your choices will appear there only after you confirm and create a new version. You can finish questions early with “Confirm selected changes and preview”.`:`右侧目前显示 ${current?.toUpperCase()||'现有版本'}。选择方向不会立刻改变预览；确认并制作新版本后才会更新。可随时点“确认已选修改并预览…”提前结束提问。`);
    layout.view='preview';layout.detail=null;setPreview(true);
  }
  task.temporaryOpen=false;task.stage='decision';task.status='待选择';persist(task);renderCurrent(task);
  if(trigger==='rating')await requestDecision(task);
}
function renderDecisionFlow(task){
  const f=task.decisionFlow;if(!f)return;
  if(task.versions.length)footerAction('returnToWork','返回作品',()=>{
    if(isBusy(task))return;
    f.status='parked';task.stage=f.returnStage==='accepted'?'accepted':'rating';task.temporaryOpen=false;
    layout.view='preview';layout.detail=null;persist(task);setPreview(true);renderCurrent(task);
  });
  if((['area','question'].includes(f.current.kind)||f.awaitingNext)&&(f.history.length||f.draft?.selectedOptionIds?.length||f.draft?.freeform?.trim()))footerAction('finishQuestions','确认已选修改并预览…',()=>confirmCurrentChoices(task));
  if(f.awaitingNext){$('#actionTitle').textContent=f.deletedQuestions?.length?'题目已删除，可继续选择':' ';if(f.history.length)footerAction('previousFlowDecision','上一题',()=>{backDecision(f);persist(task);renderCurrent(task);});footerAction('showDecisionPath','查看已选',()=>showDecisionPath(task));submitButton('requestNextDecision','生成下一题',()=>requestDecision(task));return;}
  if(['area','question'].includes(f.current.kind))footerAction('deleteCurrentQuestion','删除这题',()=>confirmDeleteDecision(task,null));
  $('#actionTitle').textContent=f.current.question;
  $('#dynamicAction').innerHTML=optionsView({...f.draft,options:f.current.options});
  $$('[data-choice]').forEach(input=>{
    input.type=f.current.allowMultiple?'checkbox':'radio';input.name='decision-flow';
    input.onchange=()=>{const id=input.dataset.choice;f.draft.selectedOptionIds=f.current.allowMultiple?(input.checked?[...new Set([...f.draft.selectedOptionIds,id])]:f.draft.selectedOptionIds.filter(v=>v!==id)):[id];persist(task);renderAction(task);};
  });
  $$('[data-detail]').forEach(button=>button.onclick=()=>showOption(task,button.dataset.detail));
  const canSubmit=()=>{try{selectedDecision(f.current,f.draft);return true;}catch{return false;}};
  on('#freeformInput','input',event=>{f.draft.freeform=event.target.value;persist(task);$('#submitFlowDecision').disabled=!canSubmit();});
  if(f.history.length)footerAction('previousFlowDecision','上一题',()=>{backDecision(f);persist(task);renderCurrent(task);});
  footerAction('showDecisionPath','查看已选',()=>showDecisionPath(task));
  submitButton('submitFlowDecision',f.current.kind==='confirm'?'提交操作':'提交选择并继续',()=>submitFlowDecision(task),!canSubmit());
}
function showDecisionPath(task){
  const f=task.decisionFlow;
  showExplanation(`<h2>已选路径</h2><p>基线：${esc(f.pendingId||f.baseVersionId||'尚无作品')} ${f.pendingId?'（未完成文件）':''}</p>${f.history.map((item,i)=>`<label>${i+1}. ${esc(item.decision.question)}</label><p>${esc(item.decision.selected.map(o=>o.title+(o.note?`：${o.note}`:'')).join('；'))}\n${esc(item.decision.supplement)}</p>`).join('')}${f.summary?`<h2>待确认范围</h2><p>${esc(f.summary.changes)}</p><label>保持</label><p>${esc(f.summary.preserve)}</p><label>验证</label><p>${esc(f.summary.verification)}</p>`:''}${f.invalidated.length?'<p class="muted">回改后原下游结果已失效，不参与执行。</p>':''}`);
  $$('#explanationView [data-delete-decision]').forEach(button=>button.remove());
  if(!isBusy(task)&&!task.archivedAt&&f.status!=='completed'){
    [...$('#explanationView').querySelectorAll('label')].slice(0,f.history.length).forEach((label,index)=>{
      if(!['area','question'].includes(f.history[index].node?.kind))return;
      const button=document.createElement('button');button.type='button';button.className='text-button';button.dataset.deleteDecision=String(index);button.textContent=ui('删除这题');button.onclick=()=>confirmDeleteDecision(task,index);label.after(button);
    });
  }
}
async function requestDecision(task){
  const f=task.decisionFlow;
  if(previewCheckpointDue(task,f)){
    prepareFlowConfirmation(f,'按已开启的预览节奏，将本轮已提交修改制作为中途预览。');
    f.previewCheckpoint=true;f.status='confirmed';f.draft.selectedOptionIds=['execute'];
    addRecord(task,'agent',`已累计 ${modificationCount(f)-(f.previewStartCount||0)} 次修改选择，按你的预览设置制作一版；完成后先看作品再继续。`);
    await executeDecisionFlow(task);return;
  }
  f.awaitingNext=true;persist(task);
  const shortRevision=['rating','adjust'].includes(f.trigger)&&Number(task.previewEvery||0)===0;
  if((shortRevision&&f.history.length>=2||f.history.length>=50)&&!f.refine){confirmCurrentChoices(task);return;}
  if(!model.configured){renderCurrent(task);openSettings();return;}
  await perform(task,'decision','正在生成下一问题',()=>api.nextDecision({task:modelTask(task),flow:f}),result=>{
    if(result.explanation)addRecord(task,'agent',result.explanation,'决策说明');
    if(result.kind==='ready'){
      f.summary=result.summary;f.current=localNode('confirm',f.artifactType);
      addRecord(task,'agent',`待确认修改：${result.summary.changes}\n保持：${result.summary.preserve}\n验证：${result.summary.verification}\n基线：${f.pendingId||f.baseVersionId||'尚无作品'}。`,'待确认范围');
    }else{f.current={...result,id:crypto.randomUUID(),kind:'question'};f.summary=null;}
    f.awaitingNext=false;f.refine=false;f.draft=emptyAnswer();f.status='answering';task.stage='decision';task.status='待选择';
  });
}
async function submitFlowDecision(task){
  const f=task.decisionFlow;if(isBusy(task))return;
  const command=parseModeCommand(f.draft.freeform);
  if(command){await handleModeCommand(task,command);return;}
  const action=f.draft.selectedOptionIds[0],kind=f.current.kind;
  const localControl=['pause','failure','confirm'].includes(kind)&&['park','back','model'].includes(action);
  if(f.draft.freeform.trim()&&!localControl){
    const intent=await executionIntent(task,f.draft.freeform);if(!intent)return;
    if(intent==='chat'){await answerMessage(task,f.draft.freeform);return;}
    if(intent==='execute'){
      const message=f.draft.freeform;
      if(['area','question'].includes(kind))commitDecision(f);
      await confirmCurrentChoices(task,message);return;
    }
  }
  let decision;try{decision=selectedDecision(f.current,f.draft);}catch(error){showError(error.message);return;}
  if(['pause','failure','confirm'].includes(kind)&&action==='park'){
    f.draft=emptyAnswer();f.status='parked';task.stage='paused';addRecord(task,'user','暂存当前决定，不执行。');persist(task);renderCurrent(task);return;
  }
  if(kind==='confirm'){
    if(action==='back'){backDecision(f);persist(task);renderCurrent(task);return;}
    if(action==='deeper'||!action||f.draft.freeform.trim()){
      commitDecision(f);f.refine=true;await requestDecision(task);return;
    }
    if(action==='execute'){
      f.status='confirmed';confirmedFlow(f);
      addRecord(task,'user',`确认执行：${f.summary.changes}`,'执行确认');
      await executeDecisionFlow(task);return;
    }
  }
  if(kind==='failure'&&action==='model'){f.draft=emptyAnswer();openModelMenu();return;}
  if(['pause','failure'].includes(kind)&&['continue','retry'].includes(action)){
    if(f.resumeFlow&&['decision','chat'].includes(f.retryPhase)){
      task.decisionFlow=f.resumeFlow;task.stage='decision';persist(task);renderCurrent(task);
      if(f.retryPhase==='decision')await requestDecision(task);return;
    }
    if(!f.pendingId&&!f.baseVersionId){task.stage=f.returnStage==='options'?'options':'input';task.error=null;persist(task);renderCurrent(task);return;}
    commitDecision(f);f.resumeOriginal=true;f.summary={changes:'按原来已经提交的要求继续未完成工作，不增加修改方向',preserve:'原任务要求、选择和完成条件',verification:'按原产物协议与完成条件检查'};f.current=localNode('confirm',f.artifactType);
    addRecord(task,'agent',`将按原要求继续，基线：${f.pendingId||f.baseVersionId}。请确认后执行。`);persist(task);renderCurrent(task);return;
  }
  commitDecision(f);
  addRecord(task,'user',`${decision.question}\n${decision.selected.map(o=>o.title+(o.note?`：${o.note}`:'')).join('；')}${decision.supplement?`\n${decision.supplement}`:''}`,'已选决定');
  if(task.versions.length){layout.view='preview';layout.detail=null;renderPreview(task);}
  if(['pause','failure'].includes(kind)&&action==='adjust'){
    f.current=localNode('area',f.artifactType);persist(task);renderCurrent(task);return;
  }
  await requestDecision(task);
}
async function executeDecisionFlow(task){
  if(!model.configured){await persistNow();openSettings();return;}
  if(!await ensureDeliveryDirectory(task))return;
  if(task.agentMode==='goat'){await runGoat(task);return;}
  const f=task.decisionFlow,id=nextVersionId(task);
  await perform(task,'artifact','正在执行确认的修改',()=>api.executeArtifact({task:modelTask(task),versionId:id,versionLabel:id.toUpperCase(),baseVersionId:f.baseVersionId,proposal:f,resumePending:Boolean(f.pendingId),pendingId:f.pendingId}),result=>{
    task.versions.push({id,label:`${id.toUpperCase()} · 决策修改`,sourceVersionId:f.baseVersionId,artifact:result.artifact,verification:result.verification,completion:result.completion,previewUrl:result.previewUrl,createdAt:new Date().toISOString()});
    f.status='completed';task.currentVersionId=id;task.previewVersionId=id;task.artifactType=result.artifact.type;task.stage='rating';task.status='可评价';
    if(f.previewCheckpoint){
      const changes=f.history.filter(item=>['area','question'].includes(item.node?.kind)).map(item=>selectedDecision(item.node,item.answer)).map(d=>[...d.selected.map(o=>o.title+(o.note?`：${o.note}`:'')),d.supplement].filter(Boolean).join('；')).join('\n');
      task.versions.at(-1).changeSummary=changes;task.versions.at(-1).checkpoint=true;
      addRecord(task,'agent',`本轮预览修改范围：\n${changes}\n请结合预览和验证依据检查实际效果。`);
    }
    if(activeTask()?.id===task.id){layout.view='preview';layout.detail=null;setPreview(true);}
    if(result.artifact?.requirementLedger){task.taskRules=result.artifact.taskRules||result.artifact.requirementLedger;task.requirementLedger=task.taskRules;}
    addRecord(task,'agent',`${id.toUpperCase()} 产物已生成。${result.completion?completionLabel(result.completion):'请查看并验收。'}`);
  });
}

async function confirmCurrentChoices(task,message=''){
  if(isBusy(task))return false;
  if(!typeInfo(task.artifactType)){addRecord(task,'agent','请先确定主产物类型，再确认执行。');persist(task);renderCurrent(task);return false;}
  if(!task.decisionFlow||!['decision','paused'].includes(task.stage))await beginDecision(task,'adjust');
  const f=task.decisionFlow;
  if(['area','question'].includes(f.current?.kind)&&(f.draft?.selectedOptionIds?.length||f.draft?.freeform?.trim())){
    try{commitDecision(f);}catch(error){showError(error.message);return false;}
  }
  if(!f.history.length&&!message){showToast('请先选择至少一个修改方向。');return false;}
  if(!f.summary&&f.history.length){
    const choices=f.history.map(item=>item.decision||selectedDecision(item.node,item.answer));
    f.summary={changes:`仅修改已选范围：${choices.map(choice=>[...choice.selected.map(item=>item.title+(item.note?`：${item.note}`:'')),choice.supplement].filter(Boolean).join('；')).filter(Boolean).join('；')}`,preserve:f.artifactType==='website'?'保留未选范围的页面内容、导航、按钮和可用交互。':'保留未选范围的内容及已确认要求。',verification:'制作后打开新版本预览，并检查产物文件与已确认要求。'};
  }
  prepareFlowConfirmation(f,message);task.temporaryOpen=false;task.stage='decision';
  if(message)addRecord(task,'user',message,'你 · 执行要求');
  addRecord(task,'agent',`将按任务目标及 ${f.history.length} 项已提交选择执行。请确认范围后开始；未提交的草稿不作为要求。`,'待确认范围');
  persist(task);renderCurrent(task);
  return true;
}

async function executionIntent(task,message){
  if(isExecutionRequest(message))return 'execute';
  if(!model.configured){openSettings();return null;}
  let intent=null;
  await perform(task,'chat','正在识别请求',()=>api.classifyMessage({task:modelTask(task),message}),result=>{
    intent=result.intent;
    if(intent==='answer'&&!task.temporaryOpen&&result.selectedOptionIds?.length)task.decisionFlow.draft.selectedOptionIds=result.selectedOptionIds;
  });
  if(!intent&&task.operation?.status==='error'){addRecord(task,'agent','请求识别失败，输入已保留，请重试或使用选项按钮继续。','请求未执行');persist(task);renderCurrent(task);}
  return intent;
}

async function answerMessage(task,message,temporary=false){
  const turnId=crypto.randomUUID();
  task.temporaryError='';Object.assign(addRecord(task,'user',message,'你 · 提问'),{turnId,kind:'chat'});
  await perform(task,'chat','正在答复',()=>api.oneShotChat({task:modelTask(task),message}),reply=>{
    Object.assign(addRecord(task,'agent',reply,'完整答复'),{turnId,kind:'chat'});(task.temporaryConversations||=[]).push({id:turnId,message,reply});
    if(temporary){task.temporaryOpen=false;task.temporaryDraft='';}
  });
}

function hasChoice(task) { return task.selectedOptionIds.length>0||Boolean(task.freeform.trim()); }
function completionLabel(evidence) {
  return ({passed:'已配置的自动检查通过；不代表未配置的要求已验证。',needs_review:'产物已生成，仍有条件需要人工确认。',gaps:'存在未满足条件。',stale:'文件已变化，旧验证证据失效。',unreadable:'完成记录不可读取；原始文件已保留，此版本尚未验证。'})[evidence.status]||'尚未验证';
}
function showCompletion(evidence) {
  const audit=evidence.requirementAudit;
  showExplanation(`<h2>交付依据 · ${esc(evidence.versionId)}</h2><p>${esc(completionLabel(evidence))}</p>${evidence.results.map(r=>`<label>${esc(r.text)}</label><p>${esc(r.detail)}</p>`).join('')}${audit?`<h2>要求守护</h2>${audit.results.map(r=>`<label>${esc(({supported:'文件证据支持',conflict:'发现明确冲突',unverified:'待用户确认'})[r.status]||r.status)} · ${esc(r.text)}</label><p>${esc(r.reason)}${r.evidence?.length?`\n证据：${r.evidence.map(e=>`${e.file}：“${e.quote}”`).join('；')}`:''}</p>`).join('')}<p class="muted">这是模型辅助的文件证据审查，不等于确定性验证；无逐字文件证据时不会标为支持或冲突。</p>`:''}<p class="muted">检查时间：${esc(evidence.checkedAt)}。${evidence.attempts?.length||1} 次检查；结果绑定此版本。人工条件不会由模型自动标为通过。</p>`);
}
function editCompletion(task) {
  const conditions=task.completionContract?.conditions||[];
  const sequence=conditions.find(c=>c.kind==='sequence');
  showExplanation(`<h2>完成条件</h2><p>提交制作时确认这些条件。文字条件由你验收；连续整数可以自动逐项检查。</p><label for="completionText">文字条件（每行一项）</label><textarea id="completionText">${esc(conditions.filter(c=>c.kind==='manual').map(c=>c.text).join('\n')||task.requirement)}</textarea><label class="toggle-setting"><input id="sequenceEnabled" type="checkbox" ${sequence?'checked':''}>检查完整连续整数</label><label class="field-label">起点<input id="sequenceStart" type="number" value="${sequence?.start??0}"></label><label class="field-label">终点<input id="sequenceEnd" type="number" value="${sequence?.end??10000}"></label><label class="field-label">序列文件<input id="sequenceFile" value="${esc(sequence?.file||'sequence.txt')}"></label><label class="toggle-setting"><input id="allowCompletionRepair" type="checkbox" ${task.allowCompletionRepair?'checked':''}>允许在当前任务范围内自动补齐一次（额外模型调用）</label><p>不满足自动条件时保留未完成文件。补齐不会安装依赖或执行生成的代码；最多一次，之后停止并报告缺口。</p><button id="saveCompletion" class="primary-button">保存条件</button>`);
  on('#saveCompletion','click',()=>{
    const next=$('#completionText').value.split('\n').map(s=>s.trim()).filter(Boolean).map(text=>({kind:'manual',text}));
    if($('#sequenceEnabled').checked) {
      const start=Number($('#sequenceStart').value),end=Number($('#sequenceEnd').value),file=$('#sequenceFile').value.trim();
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<start||end-start>100000||!file||file.startsWith('/')||file.includes('..')||file.includes('\\'))return showToast('请填写有效范围和相对文件名。');
      next.push({kind:'sequence',start,end,file,text:`${file} 完整列出 ${start} 到 ${end}，无遗漏、重复或省略`});
    }
    task.completionContract={conditions:next};task.allowCompletionRepair=$('#allowCompletionRepair').checked;persist(task);showToast('已保存；提交制作时确认执行');setPreview(false);
  });
}
function addRecord(task,type,text,meta='') { if(type==='user'&&activeTask()?.id===task.id)transcriptFollower?.submit();const event={type,text,meta:meta|| (type==='user'?'你':'Nodus')};if(task.decisionFlow&&['已选决定','待确认范围','执行确认'].includes(meta)){event.flowId=task.decisionFlow.id;event.nodeId=task.decisionFlow.current?.id;}task.timeline.push(event);task.updatedAt=new Date().toISOString();return event; }
function nextVersionId(task) { return `v${Math.max(0,...task.versions.map(v=>Number(v.id.replace(/^v/,''))||0))+1}`; }
function modelTask(task) {
  const copy=structuredClone(task);
  copy.uiLanguage=state.settings.language||'zh-CN';
  if(['decision','paused'].includes(task.stage)&&task.decisionFlow)copy.taskRules=extractTaskRules({...copy,options:[],freeform:'',completionContract:null},copy.decisionFlow,copy.taskRules||copy.requirementLedger);
  copy.requirementLedger=copy.taskRules||copy.requirementLedger;
  return copy;
}
async function perform(task,phase,label,work,commit) {
  if(materialImports.has(task.id))return showToast('材料正在读取，请稍后提交。');
  if(isBusy(task))return;
  task.retryStage=task.stage;task.error=null;task.stopRequested=false;
  liveResponses.delete(task.id);
  task.operation={phase,label,status:'running',startedAt:new Date().toISOString(),lastActivity:'请求已提交'};
  try {
    await persistNow();renderCurrent(task);
    const result=await work();
    if(['artifact','revision'].includes(phase)&&liveResponses.get(task.id))addRecord(task,'agent',liveResponses.get(task.id),'执行输出');
    commit(result);task.operation.status='success';task.operation.lastActivity='操作完成';
    if(['artifact','revision','restore'].includes(phase)){
      const version=task.versions.find(v=>v.id===task.currentVersionId);
      if(version){version.delivery=result.delivery||null;version.deliveryError=result.deliveryError||null;}
      if(result.delivery)addRecord(task,'agent',`作品已保存到：${result.delivery.directory}。可使用“打开目录”访问全部文件。`);
      if(result.deliveryError)addRecord(task,'agent',`作品已保存在应用内，但交付目录导出未完成：${result.deliveryError}。可点击“导出作品”重试。`);
    }
  } catch(error) {
    const stopped=String(error.message).includes('NODUS_STOPPED');
    task.operation.status=stopped?'stopped':'error';task.operation.lastActivity=stopped?'操作已停止，已有作品与部分文件保留。':error.message;
    if(phase==='chat'){task.temporaryError=task.operation.lastActivity;}else{task.stage='error';task.error={title:stopped?'已停止':`${label}失败`,message:task.operation.lastActivity};}
  } finally {
    if(task.operation.status!=='success'&&liveResponses.get(task.id))addRecord(task,'agent',liveResponses.get(task.id),'未完成的回复');
    liveResponses.delete(task.id);
    task.stopRequested=false;task.operation.endedAt=new Date().toISOString();task.updatedAt=task.operation.endedAt;
    if(task.pauseAfterStop){task.pauseAfterStop=false;await beginDecision(task,'pause');}
    else if(task.operation.status==='error'&&phase!=='chat'){
      if(/尚未配置.*模型/.test(task.operation.lastActivity)){
        model.configured=false;task.stage=task.retryStage;task.error=null;
        if(activeTask()?.id===task.id)openSettings();
      }else await beginDecision(task,'failure');
    }
    await persistNow().catch(()=>{});renderCurrent(task);
  }
}
async function submitRequirement(task) {
  if(materialImports.has(task.id))return showToast('材料正在读取，请稍后提交。');
  const command=parseModeCommand(task.requirement);
  if(command){task.agentMode=command.mode;task.requirement=command.message;persist(task);renderCurrent(task);if(!command.message)return;}
  if(!task.requirement.trim())return showError('请先描述任务目标与交付格式。');
  task.originalRequirement=task.requirement;
  task.taskRules=extractTaskRules({...task,options:[],freeform:'',decisionFlow:null,completionContract:null},null,task.taskRules||task.requirementLedger);task.requirementLedger=task.taskRules;
  if(!task.customTitle)task.title=task.requirement.trim().replace(/\s+/g,' ').slice(0,24);
  if(!task.timeline.some(e=>e.meta==='你 · 初始需求'))addRecord(task,'user',task.requirement,'你 · 初始需求');
  await requestOptions(task,false);
  if(task.agentMode==='goat'&&task.operation?.status==='success'&&task.stage==='options')await runGoat(task);
}
async function sendInitialChat(task){
  const message=task.requirement.trim();
  if(!message)return showError('请先输入消息。');
  if(parseModeCommand(message))return submitRequirement(task);
  if(!model.configured){openSettings();return;}
  task.requirement='';
  if(!task.customTitle&&!task.timeline.length)task.title=message.replace(/\s+/g,' ').slice(0,24);
  persist(task);renderCurrent(task);
  await answerMessage(task,message);
}
function detectTypeOnDemand(){
  let task=activeTask();
  if(isBusy(task))return showToast('请先停止当前操作，再识别产物类型。');
  if(task.archivedAt||task.versions.length||task.stage!=='input'){createTask();task=activeTask();}
  if(!model.configured){openSettings();return;}
  manage({title:'识别产物类型',description:'描述你要制作的作品。普通聊天不会自动识别类型；确认后才会生成方案。',value:task.requirement||'',submit:value=>{
    const requirement=value.trim();if(!requirement)return false;
    task.requirement=requirement;task.artifactType=null;task.typeConfirmed=false;task.stage='input';persist(task);renderCurrent(task);
    setTimeout(()=>submitRequirement(task),0);return true;
  }});
}
async function requestOptions(task,regenerate) {
  if(!model.configured){await persistNow();render();openSettings();return;}
  const previous=regenerate?structuredClone(task.options):[];
  await perform(task,'options','正在生成方案',()=>api.generateOptions({task:modelTask(task),previousOptions:previous}),result=>{
    task.artifactType=result.artifactType||task.artifactType||null;
    task.recognizedType=result.recognizedType||null;
    task.deliverySummary=result.deliverySummary||'';
    task.clarification=result.clarification||null;
    if(result.clarification){task.stage='input';task.status='待澄清';task.options=[];task.selectedOptionIds=[];addRecord(task,'agent',result.clarification,'需要补充');return;}
    if(previous.length)(task.decisionHistory||=[]).push({options:previous,selectedOptionIds:[...task.selectedOptionIds],optionNotes:{...task.optionNotes},createdAt:new Date().toISOString()});
    task.options=result.options;task.decisionQuestion=result.question;task.decisionContext=result.context;task.recommendation=result.recommendation;
    if(regenerate){const notes=previous.filter(o=>task.optionNotes[o.id]).map(o=>`${o.title}：${task.optionNotes[o.id]}`);if(notes.length)task.freeform=[task.freeform,...notes].filter(Boolean).join('\n');}
    task.selectedOptionIds=[];task.optionNotes={};task.stage='options';task.status='待选择';
    addRecord(task,'agent',`${result.deliverySummary?`${ui('主产物：')}${ui(typeInfo(task.artifactType)?.label||'')}${state.settings.language==='en-US'?'.':'。'}${result.deliverySummary}\n`:''}${result.context||result.question} ${ui('你可以组合选择，也可以补充自己的想法。')}`);
  });
}
async function executeV1(task) {
  const command=parseModeCommand(task.freeform);if(command){await handleModeCommand(task,command);return;}
  if(task.agentMode==='goat'){await runGoat(task);return;}
  if(!hasChoice(task))return;
  const choices=task.options.filter(o=>task.selectedOptionIds.includes(o.id)).map(o=>`${o.title}${task.optionNotes[o.id]?`（${task.optionNotes[o.id]}）`:''}`);
  if(task.freeform.trim())choices.push(task.freeform.trim());
  task.taskRules=extractTaskRules(task,null,task.taskRules||task.requirementLedger);task.requirementLedger=task.taskRules;
  addRecord(task,'user',`采用：${choices.join('；')}`);
  await runExecution(task,'artifact');
}

function showRequirements(task){
  task.taskRules ||= task.requirementLedger||extractTaskRules({...task,options:[],freeform:'',decisionFlow:null});task.requirementLedger=task.taskRules;
  const items=task.requirementLedger.items;
  showExplanation(`<h2>任务要求</h2><p>${esc(task.requirementLedger.policy)}</p>${items.map(item=>`<div class="requirement-item"><label>${esc(requirementSourceLabel(item.source))} · ${item.status==='retired'?'已停用':'持续生效'}</label><p>${esc(item.text)}</p><button class="text-button" data-toggle-requirement="${esc(item.id)}">${item.status==='retired'?'恢复要求':'停用要求'}</button></div>`).join('')||'<p>尚无已确认要求。</p>'}<p class="muted">未选择方案、草稿和返回后失效的分支不会进入要求清单。停用只影响后续版本，不改写历史证据。</p>`);
  $$('.requirement-item').forEach((node,index)=>{
    const rule=items[index];node.insertAdjacentHTML('beforeend',`<span class="muted">${esc(({goal:'目标',prohibition:'禁止事项',preserve:'保留项',acceptance:'验收条件',constraint:'约束'})[rule.category]||'任务规则')}</span><button class="text-button" data-edit-rule="${esc(rule.id)}">修改规则</button>`);
    node.querySelector('[data-edit-rule]').onclick=()=>manage({title:'修改任务规则',description:'保存后更新后续调用使用的规则，旧文本保留在变更记录中。',value:rule.text,submit:value=>{
      if(isBusy(task)||!value.trim())return false;
      task.taskRules=editTaskRule(task.taskRules,rule.id,value);task.requirementLedger=task.taskRules;persist(task);showRequirements(task);renderTimeline(task);
    }});
  });
  if(task.taskRules.history?.length)$('#explanationView').insertAdjacentHTML('beforeend',`<details><summary>规则变更记录 · ${task.taskRules.history.length} 条</summary>${task.taskRules.history.map(change=>`<p>${esc(change.before?`${change.before} → ${change.after}`:`${change.id} · ${change.action==='retire'?'停用':'恢复'}`)}</p>`).join('')}</details>`);
  $$('[data-edit-rule],[data-toggle-requirement]').forEach(button=>button.disabled=isBusy(task));
  $$('[data-toggle-requirement]').forEach(button=>button.onclick=()=>{
    if(isBusy(task))return;
    const id=button.dataset.toggleRequirement,item=task.requirementLedger.items.find(entry=>entry.id===id);if(!item)return;
    const disabled=new Set(task.disabledRequirementIds||[]);if(item.status==='retired')disabled.delete(id);else disabled.add(id);
    task.disabledRequirementIds=[...disabled];task.taskRules={...task.taskRules,revision:(task.taskRules.revision||0)+1,items:task.taskRules.items.map(entry=>({...entry,status:disabled.has(entry.id)?'retired':'active'})),history:[...(task.taskRules.history||[]),{id,action:disabled.has(id)?'retire':'activate',at:new Date().toISOString()}]};task.requirementLedger=task.taskRules;persist(task);showRequirements(task);renderTimeline(task);
  });
}
async function runExecution(task,kind) {
  if(!model.configured){await persistNow();openSettings();return;}
  if(!await ensureDeliveryDirectory(task))return;
  const id=nextVersionId(task);const baseVersionId=kind==='revision'?task.revisionBaseVersionId:null;
  await perform(task,kind,`${kind==='artifact'?'正在制作':'正在修改'}${typeInfo(task.artifactType)?.label||'产物'}`,()=>kind==='artifact'?api.executeArtifact({task:modelTask(task),versionId:id,versionLabel:id.toUpperCase()}):api.executeRevision({task:modelTask(task),proposal:{...task.revisionProposal,answers:task.revisionAnswers},versionId:id,versionLabel:id.toUpperCase(),baseVersionId}),result=>{
    task.versions.push({id,label:`${id.toUpperCase()} · ${kind==='artifact'?'初始生成':'确认修改'}`,sourceVersionId:baseVersionId,artifact:result.artifact,previewUrl:result.previewUrl,verification:result.verification,completion:result.completion,createdAt:new Date().toISOString()});
    task.artifactType=result.artifact?.type||task.artifactType;task.currentVersionId=id;task.previewVersionId=id;task.stage='rating';task.status='可评价';
    if(result.artifact?.requirementLedger){task.taskRules=result.artifact.taskRules||result.artifact.requirementLedger;task.requirementLedger=task.taskRules;}
    if(activeTask()?.id===task.id){layout.view='preview';layout.detail=null;setPreview(true);}
    addRecord(task,'agent',`${id.toUpperCase()} 产物已生成。${result.completion?completionLabel(result.completion):'文件协议检查通过；尚未逐项验证任务目标。'}`,`${id.toUpperCase()} 交付检查`);
  });
}
async function submitRating(task,versionId) {
  if(isBusy(task))return;
  const draft=task.ratingDrafts[versionId];
  const previous=[...task.evaluations].reverse().find(item=>item.versionId===versionId);
  if(sameEvaluation(previous,draft)){showToast('评价没有变化；可以修改评分或点击“调整”继续已有选择。');return;}
  if(!Object.keys(draft.scores).length&&!draft.comment.trim())return showError('至少填写一项评分或补充意见。');
  const version=task.versions.find(v=>v.id===versionId);
  const evaluation={id:crypto.randomUUID(),versionId,versionLabel:version.label,scores:{...draft.scores},comment:draft.comment,createdAt:new Date().toISOString()};
  task.evaluations.push(evaluation);
  addRecord(task,'user',`${Object.entries(draft.scores).map(([k,v])=>`${k} ${v} 分`).join('，')}。${draft.comment}`,`你 · ${versionId.toUpperCase()} 评价`);
  await beginDecision(task,'rating',evaluation,versionId);
}
async function stopTask(task) {
  if(!isBusy(task)||task.stopRequested)return;
  task.stopRequested=true;task.pauseAfterStop=true;renderCurrent(task);
  try { await api.stopTask({taskId:task.id}); }
  catch(error){task.stopRequested=false;task.pauseAfterStop=false;renderCurrent(task);showError(error.message);}
}

function openTemporaryDialog() {
  const task=activeTask();if(!task||task.archivedAt||isBusy(task))return;
  task.temporaryOpen=true;task.temporaryError='';persist(task);renderAction(task);$('#dialogInput').focus();
}
function renderTemporary(task) {
  $('#actionTitle').textContent=isBusy(task)?'临时对话 · 正在答复':'临时对话';
  $('#dynamicAction').innerHTML=`<textarea id="dialogInput" class="dialog-input" aria-label="临时提问" placeholder="问一个问题，完整答复后返回刚才的操作…" ${isBusy(task)?'readonly':''}>${esc(task.temporaryDraft||'')}</textarea>`;
  on('#dialogInput','input',e=>{task.temporaryDraft=e.target.value;persist(task);});
  if(isBusy(task)){submitButton('stopExecution','停止',()=>stopTask(task),Boolean(task.stopRequested),'stop');return;}
  footerAction('cancelDialog','取消',()=>{task.temporaryOpen=false;task.temporaryError='';persist(task);renderAction(task);});
  submitButton('sendDialog','提交临时对话',async()=>{
    const message=task.temporaryDraft?.trim();if(!message)return showError('请先填写问题。');
    const command=parseModeCommand(message);if(command){await handleModeCommand(task,command);return;}
    const intent=await executionIntent(task,message);if(!intent)return;
    if(intent==='execute'){
      if(!task.artifactType){task.requirement=[task.requirement,message].filter(Boolean).join('\n');task.temporaryOpen=false;task.temporaryDraft='';task.stage='input';await submitRequirement(task);return;}
      if(task.agentMode==='goat'){await runGoat(task,message);return;}
      if(await confirmCurrentChoices(task,message)){task.temporaryDraft='';persist(task);}return;
    }
    await answerMessage(task,message,true);
  });
}

async function handleModeCommand(task,command){
  if(isBusy(task)||materialImports.has(task.id))return;
  task.agentMode=command.mode;task.temporaryOpen=false;task.temporaryDraft='';
  if(command.mode==='plan'){
    delete task.autonomousPlan;
    if(task.decisionFlow?.draft)task.decisionFlow.draft.freeform=command.message;
    else task.freeform=command.message;
    addRecord(task,'user','切换到 /plan：先规划，确认后执行。');persist(task);renderCurrent(task);
    if(command.message){await beginDecision(task,'adjust');task.decisionFlow.draft.freeform=command.message;persist(task);renderCurrent(task);}
    return;
  }
  if(!task.requirement.trim()){task.stage='input';task.requirement=command.message;persist(task);renderCurrent(task);if(command.message)await submitRequirement(task);return;}
  if(task.decisionFlow?.draft?.freeform?.startsWith('/'))task.decisionFlow.draft.freeform='';
  if(task.freeform?.startsWith('/'))task.freeform='';
  if(!task.artifactType||(!task.currentVersionId&&!task.options.length)){
    if(command.message)task.requirement+='\n'+command.message;
    await submitRequirement(task);return;
  }
  await runGoat(task,command.message);
}

async function runGoat(task,message=''){
  if(isBusy(task)||materialImports.has(task.id))return;
  if(!model.configured){persist(task);openSettings();return;}
  if(!await ensureDeliveryDirectory(task))return;
  if(!typeInfo(task.artifactType)){showError('请先规划并确定产物类型。');return;}
  task.agentMode='goat';
  const activeFlow=['decision','paused'].includes(task.stage)?task.decisionFlow:null;
  let proposal,baseVersionId=activeFlow?.baseVersionId||task.currentVersionId||null;
  const pending=await api.taskWorkspace(task.id);
  if(!baseVersionId&&!activeFlow){
    if(task.selectedOptionIds.length){delete task.autonomousPlan;}
    else try{task.autonomousPlan=autonomousPlan(task);}catch(error){addRecord(task,'agent',error.message);persist(task);renderCurrent(task);return;}
  }
  if(baseVersionId||activeFlow||pending){
    proposal=activeFlow?structuredClone(activeFlow):{schemaVersion:3,history:[],invalidated:[],artifactType:task.artifactType};
    prepareFlowConfirmation(proposal,message||'按当前目标、已提交选择和保留项自主完成制作与检查');
    proposal.baseVersionId=pending?pending.baseVersionId:baseVersionId;proposal.pendingId=pending?.pendingId||null;proposal.resumeOriginal=Boolean(pending);
    proposal.status='confirmed';proposal.draft.selectedOptionIds=['execute'];baseVersionId=proposal.baseVersionId;
  }else if(message)task.freeform=[task.freeform,message].filter(Boolean).join('\n');
  addRecord(task,'user',`/goat：授权按当前目标自主规划、制作和检查，单次最多3次尝试；缺材料、需人工判断或达到上限时停止。${message?'\n'+message:''}`);
  if(task.autonomousPlan)addRecord(task,'agent',`自主采用方案：${task.autonomousPlan.options.map(o=>o.title).join('、')}。${task.autonomousPlan.reason}`);
  task.temporaryOpen=false;const id=nextVersionId(task);
  await perform(task,'artifact','自主制作与检查',()=>api.executeGoat({task:modelTask(task),versionId:id,versionLabel:id.toUpperCase(),baseVersionId,proposal,resumePending:Boolean(pending),pendingId:pending?.pendingId,authorization:'goat-submit'}),result=>{
    task.versions.push({id,label:`${id.toUpperCase()} · 自主制作`,sourceVersionId:baseVersionId,artifact:result.artifact,verification:result.verification,completion:result.completion,previewUrl:result.previewUrl,autonomy:result.autonomy,createdAt:new Date().toISOString()});
    task.currentVersionId=id;task.previewVersionId=id;task.stage='rating';task.status='待验收';task.autonomy=result.autonomy;
    if(activeFlow)activeFlow.status='completed';
    if(result.artifact.requirementLedger){task.taskRules=result.artifact.taskRules||result.artifact.requirementLedger;task.requirementLedger=task.taskRules;}
    if(activeTask()?.id===task.id){layout.view='preview';layout.detail=null;setPreview(true);}
    addRecord(task,'agent',`自主制作已结束。${result.completion?completionLabel(result.completion):'仍需人工验收。'} 可继续评分和修改。`);
  });
}

function setPreviewExpanded(expanded){
  layout.previewExpanded=expanded;
  $('#appShell').classList.toggle('preview-expanded',expanded);
  const button=$('#expandPreview');button.innerHTML=icon(expanded?'contract':'expand');
  button.setAttribute('aria-pressed',String(expanded));button.setAttribute('aria-label',expanded?'还原预览':'展开预览');button.title=expanded?'还原预览':'展开预览';
  hideModelMenu();
}
function setPreview(open) { if(!open)setPreviewExpanded(false);layout.previewOpen=open;$('#previewColumn').hidden=!open;$('#appShell').classList.toggle('preview-open',open);$('#togglePreview').setAttribute('aria-expanded',String(open));fitLayout();renderPreview(activeTask()); }
function showExplanation(html) { layout.view='explanation';layout.detail=html;setPreview(true); }
function showOption(task,id) {
  if(task.stage==='decision'){
    const f=task.decisionFlow,o=f.current.options.find(o=>o.id===id);if(!o)return;
    showExplanation(`<h2>${esc(o.title)}</h2><p>${esc(o.description)}</p><label>效果</label><p>${esc(o.effect)}</p><label>取舍</label><p>${esc(o.tradeoff)}</p><label>适用条件</label><p>${esc(o.condition)}</p><textarea id="optionNoteInput" aria-label="选项补充">${esc(f.draft.optionNotes[id]||'')}</textarea>`);
    on('#optionNoteInput','input',event=>{f.draft.optionNotes[id]=event.target.value;persist(task);});return;
  }
  const draft=task;
  const o=task.options.find(o=>o.id===id);if(!o)return;
  showExplanation(`<h2>${esc(o.title)}</h2>${[['具体做法',o.description],['预期效果',o.effect],['主要取舍',o.tradeoff],['适用条件',o.condition]].filter(([,v])=>v).map(([k,v])=>`<label>${k}</label><p>${esc(v)}</p>`).join('')}<label for="optionNoteInput">仅补充“${esc(o.title)}”</label><textarea id="optionNoteInput" data-note="${esc(id)}" placeholder="补充这一项的具体要求…">${esc(task.optionNotes[id]||'')}</textarea><p class="muted">补充会随方案提交；在此编辑不会开始制作。</p>`);
  $('#optionNoteInput').value=draft.optionNotes[id]||'';
  on('#optionNoteInput','input',e=>{draft.optionNotes[id]=e.target.value;persist(task);renderAction(task);});
}
function showRecommendation() {
  const task=activeTask();const r=task.recommendation;
  if(!r)return showExplanation('<h2>暂无推荐</h2><p>当前任务还没有模型返回的推荐理由。</p>');
  showExplanation(`<h2>${esc(task.options.filter(o=>r.optionIds?.includes(o.id)).map(o=>o.title).join(' ＋ ')||'推荐方向')}</h2><p>${esc(r.reason)}</p><p class="muted">推荐供你参考，提交选择后才执行。</p>`);
}
function renderPreview(task,refresh=false) {
  if(!task)return;
  const version=task.versions.find(v=>v.id===task.previewVersionId);
  $$('.device-button').forEach(button=>button.hidden=Boolean(version)&&version.artifact?.type!=='website');
  if(version?.artifact?.type!=='website')$('#sitePreview').classList.remove('mobile');
  $('#sitePreview').title=`${typeInfo(version?.artifact?.type||task.artifactType)?.label||'作品'}预览`;
  $('#versionSelect').innerHTML=task.versions.length?task.versions.map(v=>`<option value="${esc(v.id)}" ${v.id===task.previewVersionId?'selected':''}>${esc(v.label)}</option>`).join(''):'<option>尚未生成</option>';
  $('#versionSelect').disabled=!task.versions.length||isBusy(task);
  $('#restoreVersion').hidden=!version||version.id===task.currentVersionId;$('#restoreVersion').disabled=isBusy(task);
  const explaining=layout.view==='explanation';
  $('#previewToolbar').hidden=explaining;$('#explanationView').hidden=!explaining;
  $('#sitePreview').hidden=explaining||!version?.previewUrl;$('#emptyPreview').hidden=explaining||Boolean(version?.previewUrl);$('#emptyPreview').textContent=version?.previewError?`此版本暂时无法预览：${version.previewError}`:'生成作品后，可在这里查看和比较版本。';
  $('#previewTab').classList.toggle('active',!explaining);$('#explainTab').classList.toggle('active',explaining);
  if(explaining && layout.detail && $('#explanationView').dataset.content!==layout.detail){$('#explanationView').innerHTML=layout.detail;$('#explanationView').dataset.content=layout.detail;}
  if(!version?.previewUrl){$('#sitePreview').removeAttribute('src');delete $('#sitePreview').dataset.url;}
  if(version?.previewUrl && (refresh||$('#sitePreview').dataset.url!==version.previewUrl)){$('#sitePreview').src=`${version.previewUrl}?refresh=${Date.now()}`;$('#sitePreview').dataset.url=version.previewUrl;}
}
async function restoreSelectedVersion() {
  const task=activeTask();if(isBusy(task))return;
  const source=task.versions.find(v=>v.id===task.previewVersionId);if(!source||source.id===task.currentVersionId)return;
  manage({title:`恢复 ${source.id.toUpperCase()}？`,description:'将从此版本创建新的当前版本，保留所有历史和原版评分。',submit:async()=>{
    const id=nextVersionId(task);
    await perform(task,'restore','正在恢复版本',()=>api.restoreVersion({taskId:task.id,sourceVersionId:source.id,versionId:id}),result=>{task.versions.push({id,label:`${id.toUpperCase()} · 恢复自 ${source.id.toUpperCase()}`,sourceVersionId:source.id,artifact:result.artifact,verification:result.verification,completion:result.completion,previewUrl:result.previewUrl,restored:true,createdAt:new Date().toISOString()});task.artifactType=result.artifact?.type||task.artifactType;if(result.artifact?.requirementLedger){task.taskRules=result.artifact.taskRules||result.artifact.requirementLedger;task.requirementLedger=task.taskRules;task.disabledRequirementIds=task.taskRules.items.filter(item=>item.status==='retired').map(item=>item.id);}task.currentVersionId=id;task.previewVersionId=id;task.stage='rating';addRecord(task,'user',`从 ${source.id.toUpperCase()} 恢复为 ${id.toUpperCase()}，其他历史保留。`);});
  }});
}

function renderModel() {
  $('#modelLabel').textContent=model.configured?(model.modelId||providerLabel(model.providerId)):'连接模型';
  $('#accountModelStatus').textContent=model.configured?`${model.modelId} · 已连接`:'尚未连接';
  $('#accountModelStatus').classList.toggle('connected',model.configured);
  $('#connectedModel').textContent=model.configured?`${providerLabel(model.providerId)} / ${model.modelId}`:'尚未连接模型';
  const usage=state.tasks.flatMap(t=>t.executionEvents||[]).filter(e=>e.type==='usage'&&Number.isFinite(e.tokens)&&e.tokens>=0);
  const total=usage.reduce((sum,e)=>sum+e.tokens,0);
  $('#modelUsage').textContent=usage.length?`本机累计用量：${total.toLocaleString('zh-CN')} Token\n${usage.length} 次模型响应（所有任务与模型的已记录用量）`:'本机累计用量：0 Token\n暂无已记录的模型用量';
  $('#disconnectButton').disabled=!model.configured;
}
function hideModelMenu(){const menu=$('#modelPicker');if(menu)menu.hidden=true;$('#modelButton').setAttribute('aria-expanded','false');}
function openModelMenu(){
  if(anyBusy())return;
  let menu=$('#modelPicker');
  if(!menu){document.body.insertAdjacentHTML('beforeend','<div id="modelPicker" class="context-menu model-picker" role="menu" aria-label="选择已接入模型" hidden></div>');menu=$('#modelPicker');}
  if(!menu.hidden){hideModelMenu();return;}
  const items=model.connections||[];
  menu.innerHTML=items.map(c=>`<button class="menu-button" role="menuitemradio" aria-checked="${c.id===model.activeConnectionId}" data-connection-id="${esc(c.id)}"><span>${icon(c.id===model.activeConnectionId?'model':'document')}</span><span class="connection-copy">${esc(c.label)}<small>${esc(c.modelId)} · ${esc(providerLabel(c.providerId))}</small></span></button>`).join('')+(items.length?'':'<p class="muted empty-list">尚未接入模型</p>')+`<button id="manageConnections" class="menu-button" role="menuitem">${icon('settings')}管理模型连接</button>`;
  menu.hidden=false;$('#modelButton').setAttribute('aria-expanded','true');$('#modelButton').setAttribute('aria-haspopup','menu');
  const rect=$('#modelButton').getBoundingClientRect();menu.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-menu.offsetWidth-8))}px`;menu.style.top=`${Math.max(8,rect.top-menu.offsetHeight-8)}px`;
  menu.querySelectorAll('[data-connection-id]').forEach(button=>button.onclick=async()=>{
    hideModelMenu();try{model=await api.activateConnection(button.dataset.connectionId);render();}catch(error){showToast(error.message);}
  });
  on('#manageConnections','click',openSettings);
  menu.onkeydown=event=>{const buttons=[...menu.querySelectorAll('button')];let index=buttons.indexOf(document.activeElement);if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();index=event.key==='Home'?0:event.key==='End'?buttons.length-1:(index+(event.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[index].focus();}if(event.key==='Escape'){hideModelMenu();$('#modelButton').focus();}};
  menu.querySelector('button')?.focus();
}
function renderConnections(){
  const list=$('#savedConnections');if(!list)return;
  list.innerHTML=(model.connections||[]).map(c=>`<div class="connection-row"><span class="connection-copy">${esc(c.label)}<small>${esc(c.modelId)} · ${esc(providerLabel(c.providerId))} · ${c.remembered?'已加密保存':'仅本次使用'}${c.id===model.activeConnectionId?' · 当前':''}</small></span><button class="icon-button" data-remove-connection="${esc(c.id)}" aria-label="移除 ${esc(c.label)}" title="移除此连接">${icon('close')}</button></div>`).join('')||'<p class="muted">尚未接入模型</p>';
  list.querySelectorAll('[data-remove-connection]').forEach(button=>{button.disabled=anyBusy();button.onclick=async()=>{
    if(!window.confirm('移除此模型连接及其已保存凭据？任务和作品保留。'))return;
    try{model=await api.removeConnection(button.dataset.removeConnection);renderConnections();renderModel();}catch(error){$('#settingsError').textContent=error.message;}
  };});
}
function showModelPopover(open) { clearTimeout(popoverTimer);$('#modelPopover').hidden=!open;$('#modelConnectionButton').setAttribute('aria-expanded',String(open));if(open)renderModel(); }
function showOldVersionChoice(show){
  if(api.platform!=='linux')return;
  if(!$('#oldVersionChoice'))$('#updatePanel').insertAdjacentHTML('beforeend','<label id="oldVersionChoice" class="toggle-setting"><input id="removeOldProgram" type="checkbox" checked>安装后删除旧版 AppImage（仅程序文件；任务与作品保留）</label>');
  $('#oldVersionChoice').hidden=!show;
}
async function checkUpdates(){
  const button=$('#checkUpdateButton');button.disabled=true;
  updateInstallMode='guided';
  showOldVersionChoice(false);
  $('#updateStatus').textContent='正在检查 GitHub 最新版本…';
  $('#downloadUpdateButton').hidden=true;$('#openUpdateInstallerButton').hidden=true;$('#updateProgress').hidden=true;
  try{
    const result=await api.checkUpdate();
    updateInstallMode=result.installMode||'guided';
    if(result.available){
      $('#updateStatus').textContent=api.platform==='darwin'?`当前 v${result.currentVersion}，发现新版 v${result.latestVersion}。前往 GitHub 下载 DMG，安装时可选择替换旧应用。`:result.downloadable?`当前 v${result.currentVersion}，发现新版 v${result.latestVersion}。${updateInstallMode==='automatic'?'下载后可在应用内安装并重启。':'可下载并校验安装包，再按安装向导更新。'}`:`发现新版 v${result.latestVersion}，但此平台的安装包或校验文件尚未备齐。`;
    }else{
      $('#updateStatus').textContent=result.downloadable?`当前已是最新版本 v${result.currentVersion}。如本机安装文件损坏，可重新下载安装包；若卸载程序报完整性错误，请先阅读下方“卸载报错怎么办？”。`:`当前已是最新版本 v${result.currentVersion}。`;
    }
    $('#downloadUpdateButton').hidden=api.platform==='darwin'?!result.available&&!result.downloadable:!result.downloadable;
    $('#downloadUpdateButton').textContent=api.platform==='darwin'?'前往 GitHub 下载':result.available?'下载更新':'重新下载安装包';
    showOldVersionChoice(api.platform==='linux'&&result.available&&result.downloadable&&updateInstallMode==='automatic');
  }catch(error){$('#updateStatus').textContent=`检查更新失败：${error.message}`;}
  finally{button.disabled=false;}
}
async function downloadAppUpdate(){
  if(api.platform==='darwin'){
    try{await api.openUpdatePage();$('#updateStatus').textContent='已打开对应版本的 GitHub 发布页。下载 DMG 后，将 Nodus 拖入“应用程序”；选择“替换”会删除旧程序文件，任务与作品数据保留。';}
    catch(error){$('#updateStatus').textContent=`无法打开发布页：${error.message}`;}
    return;
  }
  const button=$('#downloadUpdateButton');button.disabled=true;$('#checkUpdateButton').disabled=true;
  $('#updateProgress').hidden=false;$('#updateProgress').value=0;$('#updateStatus').textContent='正在下载并校验安装包…';
  try{
    const result=await api.downloadUpdate();
    updateInstallMode=result.installMode||'guided';
    $('#updateStatus').textContent=`v${result.version} 安装包已下载并通过 SHA-256 校验。${result.reused?'使用了已校验的本地文件。':''}`;
    $('#openUpdateInstallerButton').hidden=false;
    $('#openUpdateInstallerButton').textContent=updateInstallMode==='automatic'?'安装并重启':api.platform==='linux'?'定位 AppImage':'打开安装包';
    $('#updateProgress').value=100;
  }catch(error){$('#updateStatus').textContent=`下载更新失败：${error.message}`;$('#updateProgress').hidden=true;}
  finally{button.disabled=false;$('#checkUpdateButton').disabled=false;}
}
function openSettings() {
  if(!$('#searchMode')){
    $('#showDialogSetting').insertAdjacentHTML('beforebegin',`<section class="update-panel" aria-label="联网搜索"><strong>联网搜索</strong><label class="field-label">搜索连接方式<select id="searchMode"><option value="off">关闭</option><option value="current">复用当前模型 API Key</option><option value="separate">独立搜索 API Key</option></select></label><label class="field-label">搜索服务<select id="searchProvider"><option value="brave">Brave Search</option><option value="tavily">Tavily</option><option value="qwen">Qwen 百炼</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select></label><label class="field-label">搜索 API Key<input id="searchApiKey" type="password" autocomplete="new-password" spellcheck="false"></label><label class="toggle-setting"><input id="rememberSearch" type="checkbox">在本机加密记住搜索 Key</label><p id="searchStatus" class="muted" role="status"></p><div class="update-actions"><button id="saveSearch" type="button" class="secondary-button">保存搜索设置</button><button id="restoreSearch" type="button" class="text-button">恢复已保存搜索连接</button></div></section>`);
    on('#searchMode','change',showSearchConfig);
    on('#saveSearch','click',saveSearchConfig);
    on('#restoreSearch','click',async()=>{try{searchStatus=await api.restoreSearch();$('#searchMode').value=searchStatus.mode;$('#searchProvider').value=searchStatus.provider;showSearchConfig();}catch(error){$('#searchStatus').textContent=error.message.replace(/^Error invoking remote method '[^']+': Error: /,'');}});
  }
  api.searchStatus().then(status=>{searchStatus=status;$('#searchMode').value=status.mode;$('#searchProvider').value=status.provider||'brave';$('#searchApiKey').value='';$('#rememberSearch').checked=false;showSearchConfig();}).catch(error=>{$('#searchStatus').textContent=error.message;});
  if(!$('#previewEveryInput')){
    $('#settingsModal header').insertAdjacentHTML('afterend','<label class="field-label">当前任务的预览节奏<select id="previewEveryInput"><option value="0">手动确认后生成</option><option value="3">每 3 次修改生成预览</option><option value="5">每 5 次修改生成预览</option><option value="8">每 8 次修改生成预览</option></select></label><p class="muted">选择次数即授权按之后提交的修改自动制作新版本（消耗模型用量）。只用于已有作品的修改；普通答疑不计数，每版完成后停在评分处。可随时改回手动。</p>');
    on('#previewEveryInput','change',event=>{
      const task=activeTask(),interval=Number(event.target.value);if(!task||isBusy(task)||!previewIntervals.includes(interval))return;
      task.previewEvery=interval;if(task.decisionFlow)task.decisionFlow.previewStartCount=modificationCount(task.decisionFlow);
      addRecord(task,'user',interval?`预览节奏：授权每 ${interval} 次已提交修改后自动制作一版。`:'预览节奏：改为手动确认后生成。');persist(task);renderCurrent(task);
    });
  }
  $('#previewEveryInput').value=String(activeTask()?.previewEvery||0);$('#previewEveryInput').disabled=isBusy(activeTask());
  if(!$('#exportBackup')){
    $('#settingsModal').insertAdjacentHTML('beforeend',`<div class="dialog-actions"><button id="exportBackup" class="secondary-button" type="button">${icon('archive')} 备份对话并导出</button></div><p id="backupStatus" class="muted" role="status"></p>`);
    on('#exportBackup','click',async()=>{
      const button=$('#exportBackup');button.disabled=true;$('#backupStatus').textContent='';
      try{
        if(anyBusy()||materialImports.size)throw new Error('请先等待或停止任务及材料读取，再导出备份。');
        await persistNow();$('#backupStatus').textContent='正在导出…';
        const result=await api.exportBackup();
        $('#backupStatus').textContent=result.canceled?'':`已导出 ${result.tasks} 条对话、${result.artifactFiles} 个作品文件。${result.warnings.length?'部分原文件缺失，请查看备份清单。':''}`;
      }catch(error){$('#backupStatus').textContent=error.message.replace(/^Error invoking remote method '[^']+': Error: /,'');}
      finally{button.disabled=anyBusy();}
    });
  }
  $('#exportBackup').disabled=anyBusy()||Boolean(materialImports.size);
  hideModelMenu();
  if(!$('#savedConnections')){
    $('#settingsModal header').insertAdjacentHTML('afterend','<section id="savedConnections" class="connection-list" aria-label="已接入模型"></section>');
    $('#providerInput').closest('label').insertAdjacentHTML('beforebegin','<label class="field-label">连接名称（可选）<input id="connectionName" placeholder="例如：开发用 Qwen"></label>');
  }
  renderConnections();$('#connectionName').value='';$('#connectModel').textContent='添加并验证';
  if(!$('#rememberConnection')){
    $('#apiKeyInput').closest('label').insertAdjacentHTML('beforeend','<button id="pasteApiKey" class="text-button credential-paste" type="button">从剪贴板粘贴</button>');
    on('#pasteApiKey','click',async()=>{try{const text=await api.readClipboard();$('#apiKeyInput').value=text;$('#apiKeyInput').focus();$('#settingsError').textContent='';}catch(error){$('#settingsError').textContent=`无法读取剪贴板：${error.message}`;}});
    $('#apiKeyInput').setAttribute('spellcheck','false');
    $('#apiKeyInput').closest('label').insertAdjacentHTML('afterend','<label class="toggle-setting"><input id="rememberConnection" type="checkbox">在本机记住连接</label><p class="muted">默认仅在本次运行使用，不保存密钥。主动记住或恢复连接可能需要系统授权。</p><button id="restoreSavedConnection" class="text-button" type="button">恢复已保存连接（系统授权）</button>');
    on('#restoreSavedConnection','click',async()=>{
      const button=$('#restoreSavedConnection');button.disabled=true;$('#settingsError').textContent='';
      try{model=await api.restoreCredential();renderConnections();renderModel();}
      catch(error){$('#settingsError').textContent=error.message.replace(/^Error invoking remote method '[^']+': Error: /,'');}
      finally{button.disabled=false;}
    });
  }
  $('#rememberConnection').checked=false;
  $('#restoreSavedConnection').disabled=anyBusy();
  $('#uninstallPanel').hidden=api.platform!=='win32';
  $('#providerInput').innerHTML=(model.providers||[]).map(provider=>`<option value="${esc(provider.id)}">${esc(provider.label)}</option>`).join('')||$('#providerInput').innerHTML;
  showModelPopover(false);$('#providerInput').value=state.settings.provider||model.providerId||'kimi-coding';$('#modelIdInput').value=model.modelId||state.settings.modelId||'';$('#apiKeyInput').value='';$('#settingsError').textContent='';$('#themeSetting').value=state.settings.theme||'light';$('#languageSetting').value=state.settings.language||'zh-CN';$('#showDialogSetting').checked=state.settings.showTemporaryDialog!==false;$('#connectModel').disabled=anyBusy();updateProviderNote();$('#settingsModal').showModal();
}
function updateProviderNote() { $('#providerNote').textContent=({openai:'使用 OpenAI Platform 的 API Key；ChatGPT 订阅不是 API Key。留空优先使用 gpt-4.1，可填写账户可用的完整 GPT 模型 ID。',anthropic:'使用 Anthropic Console 的 API Key；Claude 订阅不是 API Key。留空优先使用 claude-sonnet-4-6，可填写账户可用的完整 Claude 模型 ID。','minimax-cn':'MiniMax 中国站 API Key，接口 api.minimaxi.com/anthropic；模型须在账户权限内。',minimax:'MiniMax 全球站 API Key，接口 api.minimax.io/anthropic。','qwen-api-cn':'阿里云百炼中国北京普通 API Key；不是 Coding Plan。默认 qwen-plus，支持 qwen-turbo、qwen-max，当前只接入文本。','kimi-coding':'仅适用 Kimi Code 订阅凭据。platform.kimi.com 创建的开放平台 Key 请选中国开放平台，不要选此项。','moonshotai-cn':'platform.kimi.com 中国站 Key；使用 api.moonshot.cn/v1 和 Bearer 认证。先查询账户模型列表，留空优先选择列表中的 kimi-k3。','moonshotai':'platform.kimi.ai 国际站 Key；使用 api.moonshot.ai/v1。与中国站账户和 Key 隔离。','zai-coding-cn':'使用智谱中国区 Coding Plan 凭据；入口 open.bigmodel.cn/api/coding/paas/v4。',zai:'使用智谱全球 Coding Plan 凭据；入口 api.z.ai/api/coding/paas/v4。',deepseek:'DeepSeek 普通 API Key，留空默认 deepseek-flash（V4.1 Flash）。'})[$('#providerInput').value]; }
function showSearchConfig(){
  const mode=$('#searchMode').value;
  $('#searchProvider').closest('label').hidden=mode!=='separate';
  $('#searchApiKey').closest('label').hidden=mode!=='separate';
  $('#rememberSearch').closest('label').hidden=mode!=='separate';
  $('#searchStatus').textContent=mode==='current'&&!searchStatus.currentSupported?'当前模型不支持复用 Key 搜索。可连接 OpenAI、Anthropic 或 Qwen 百炼，或选择独立搜索服务。':searchStatus.configured?'搜索服务已连接。':'选择搜索方式后保存。';
}
async function saveSearchConfig(){
  const button=$('#saveSearch');button.disabled=true;$('#searchStatus').textContent='正在保存搜索设置…';
  try{
    const mode=$('#searchMode').value;
    searchStatus=await api.configureSearch({mode,provider:$('#searchProvider').value,apiKey:$('#searchApiKey').value,remember:$('#rememberSearch').checked});
    state.settings.searchMode=mode;await persistNow();$('#searchApiKey').value='';
    $('#searchStatus').textContent=mode==='off'?'联网搜索已关闭。':'联网搜索已配置。';
  }catch(error){$('#searchStatus').textContent=error.message.replace(/^Error invoking remote method '[^']+': Error: /,'');}
  finally{button.disabled=false;}
}
async function searchCurrentMessage(){
  const task=activeTask();if(!task||isBusy(task)||task.archivedAt)return;
  if(!searchStatus.configured){openSettings();$('#searchStatus').textContent='请先配置联网搜索。';return;}
  const query=($('#requirementInput')?.value||'').trim();
  if(!query)return manage({title:'联网搜索',description:'输入要搜索的问题；来源会加入当前对话，供后续答复参考。',value:'',submit:async value=>{
    if(!value.trim())return false;
    return runWebSearch(task,value.trim());
  }});
  await runWebSearch(task,query);
}
async function runWebSearch(task,query){
  if(!searchStatus.configured){openSettings();$('#searchStatus').textContent='请先配置联网搜索。';return;}
  const button=$('#webSearchButton');button.disabled=true;button.textContent='搜索中…';
  try{
    const sources=await api.webSearch(query);
    if(!sources.length)throw new Error('搜索服务没有返回可引用的网页来源。');
    task.webSearchResults=sources;
    task.timeline.push({type:'agent',text:`已搜索「${query}」。以下是外部网页来源，内容尚未独立核实；发送消息后模型可参考这些来源。`,meta:'联网来源',sources});
    persist(task);renderCurrent(task);return true;
  }catch(error){showToast(error.message.replace(/^Error invoking remote method '[^']+': Error: /,''));return false;}
  finally{button.disabled=false;button.textContent='联网搜索';}
}
async function connectModel() {
  if(anyBusy())return;
  const apiKey=$('#apiKeyInput').value.trim();if(!apiKey){$('#settingsError').textContent='请在本机填写此入口的凭据。';return;}
  $('#connectModel').disabled=true;$('#connectModel').textContent='正在验证…';
  try {model=await api.configureModel({label:$('#connectionName').value,providerId:$('#providerInput').value,modelId:$('#modelIdInput').value.trim(),apiKey,remember:$('#rememberConnection').checked});if(model.remembered!==false){state.settings.provider=model.providerId;state.settings.modelId=model.modelId;}await persistNow();$('#apiKeyInput').value='';$('#connectionName').value='';render();renderConnections();showToast('模型已添加，可以继续添加或关闭设置后切换。');}
  catch(error){$('#settingsError').textContent=error.message.replace(/^Error invoking remote method '[^']+': Error: /,'');}
  finally{$('#connectModel').disabled=false;$('#connectModel').textContent='添加并验证';}
}
function disconnectModel() {
  showModelPopover(false);
  manage({title:'移除当前模型连接？',description:'将停止正在运行的任务，移除当前连接及其已保存凭据。其他连接、对话和作品保留。',submit:async()=>{
    try{for(const task of state.tasks.filter(isBusy))await stopTask(task);model=await api.disconnectModel();persist();render();}
    catch(error){$('#manageDescription').textContent=error.message;return false;}
  }});
}
function renderAttachments(task) {
  $('#attachmentList').innerHTML=task.attachments.map((a,i)=>`<button class="attachment-chip" data-attachment="${i}" title="${esc(a.message||'已读取文字；点击移除')}">${esc(a.name)} · ${a.status==='read'?'已读取':a.status==='image'?(model.supportsImages?'图片待发送':'需视觉模型'):'未解析'} ×</button>`).join('');
  $$('[data-attachment]').forEach(button=>{button.disabled=isBusy(task);button.onclick=()=>{task.attachments.splice(Number(button.dataset.attachment),1);persist(task);renderAttachments(task);};});
}
async function attachMaterials() {
  await importMaterials(() => api.selectMaterials());
}
const directorySelections=new Map();
async function chooseDeliveryDirectory(task){
  if(isBusy(task))return false;
  if(directorySelections.has(task.id))return directorySelections.get(task.id);
  const selecting=(async()=>{
    try{const result=await api.chooseDeliveryDirectory(task.id);if(result.canceled)return false;task.deliveryDirectory=result.directory;await persistNow();renderCurrent(task);return true;}
    catch(error){showToast(error.message);return false;}
    finally{directorySelections.delete(task.id);}
  })();directorySelections.set(task.id,selecting);return selecting;
}
async function ensureDeliveryDirectory(task){
  if(task.deliveryDirectory)return true;
  return chooseDeliveryDirectory(task);
}
async function exportWork(task,versionId){
  const button=$('#exportWork');if(button)button.disabled=true;
  try{
    await persistNow();const result=await api.exportVersion({taskId:task.id,versionId});if(result.canceled)return;
    const version=task.versions.find(v=>v.id===versionId);version.delivery=result;version.deliveryError=null;
    addRecord(task,'agent',`${versionId.toUpperCase()} 已导出到：${result.directory}`);await persistNow();renderCurrent(task);
  }catch(error){showToast(error.message);}finally{if(button)button.disabled=false;}
}
async function importMaterials(load) {
  const task=activeTask();
  if(!task||isBusy(task)||materialImports.has(task.id)||!['input','options','decision'].includes(task.stage)||task.archivedAt) {
    showToast('请在需求或方案阶段添加材料，等待当前操作结束。');return;
  }
  materialImports.add(task.id);
  try {
    const files=await load();
    task.attachments.push(...files);persist(task);renderCurrent(task);
    const issues=files.filter(f=>f.status==='unsupported').map(f=>`${f.name}：${f.message}`);
    if(files.some(f=>f.status==='image')&&!model.supportsImages)issues.push('图片已保留；请连接支持视觉的模型，或移除图片后继续。');
    if(activeTask()?.id===task.id&&issues.length)showError(issues.join('\n'));
  } catch(error) { showToast(error.message); }
  finally { materialImports.delete(task.id); }
}
function importTransferredFiles(files) {
  return importMaterials(async()=>{
    const results=[];
    for(const file of files) {
      if(file.size>20*1024*1024)results.push({name:file.name,status:'unsupported',message:'文件超过 20 MB，请选取相关部分后添加。'});
      else results.push(await api.importMaterial({name:file.name,bytes:new Uint8Array(await file.arrayBuffer())}));
    }
    return results;
  });
}

function fitLayout() {
  const rail=layout.railOpen?layout.railWidth:0;
  const preview=layout.previewOpen?Math.min(layout.previewWidth,Math.max(300,innerWidth-rail-520)):0;
  $('#appShell').style.setProperty('--rail-width',`${rail}px`);$('#appShell').style.setProperty('--preview-width',`${preview}px`);
}
function setRail(open) {layout.railOpen=open;$('#taskRail').hidden=!open;$('#restoreRail').hidden=open;$('#appShell').classList.toggle('rail-hidden',!open);fitLayout();}
function bindResizer(selector,side) {
  const handle=$(selector);
  const change=value=>{if(side==='rail')layout.railWidth=Math.max(180,Math.min(280,value,innerWidth-(layout.previewOpen?layout.previewWidth:0)-520));else layout.previewWidth=Math.max(300,Math.min(480,value,innerWidth-(layout.railOpen?layout.railWidth:0)-520));fitLayout();};
  handle.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();handle.setPointerCapture(e.pointerId);$('#appShell').classList.add('dragging');};
  handle.onpointermove=e=>{if(handle.hasPointerCapture(e.pointerId))change(side==='rail'?e.clientX:innerWidth-e.clientX);};
  const finish=e=>{if(handle.hasPointerCapture(e.pointerId))handle.releasePointerCapture(e.pointerId);$('#appShell').classList.remove('dragging');state.settings.panelWidths={rail:layout.railWidth,preview:layout.previewWidth};persist();};
  handle.onpointerup=finish;handle.onpointercancel=finish;
  handle.onkeydown=e=>{if(!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();const delta=e.key==='ArrowRight'?10:-10;change(side==='rail'?layout.railWidth+delta:layout.previewWidth-delta);state.settings.panelWidths={rail:layout.railWidth,preview:layout.previewWidth};persist();};
}
function showToast(message) {clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>{$('#toast').hidden=true;},3500);}

function bindEvents() {
  $('#taskTitle').insertAdjacentHTML('afterend',`<button id="interruptTask" class="icon-button" title="调整任务" aria-label="调整任务">${icon('edit')}</button>`);
  on('#interruptTask','click',()=>{const task=activeTask();if(task.archivedAt)return;return isBusy(task)?stopTask(task):beginDecision(task,'pause');});
  $('#recordPanel').append($('#actionError'));$('#actionError').classList.add('content-column');
  hydrateIcons();
  on('#newTaskButton','click',()=>createTask());on('#collapseRail','click',()=>setRail(false));on('#restoreRail','click',()=>setRail(true));
  on('#togglePreview','click',()=>setPreview(!layout.previewOpen));on('#collapsePreview','click',()=>setPreview(false));
  on('#detectTypeButton','click',detectTypeOnDemand);
  on('#expandPreview','click',()=>setPreviewExpanded(!layout.previewExpanded));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&layout.previewExpanded&&!$('dialog[open]')){setPreviewExpanded(false);$('#expandPreview').focus();}});
  on('#previewTab','click',()=>{layout.view='preview';renderPreview(activeTask());});on('#explainTab','click',showRecommendation);
  on('#refreshPreview','click',()=>renderPreview(activeTask(),true));on('#restoreVersion','click',restoreSelectedVersion);
  on('#versionSelect','change',e=>{const task=activeTask();task.previewVersionId=e.target.value;persist(task);renderPreview(task);renderAction(task);renderTimeline(task);});
  $$('.device-button').forEach(button=>button.onclick=()=>{$$('.device-button').forEach(b=>b.classList.toggle('active',b===button));$('#sitePreview').classList.toggle('mobile',button.dataset.device==='mobile');});
  on('#dialogLauncher','click',openTemporaryDialog);on('#regenerateButton','click',()=>requestOptions(activeTask(),true));on('#recommendButton','click',showRecommendation);
  on('#archiveButton','click',()=>{archiveView=!archiveView;renderNav();});
  on('#taskMenuButton','click',e=>{const r=e.currentTarget.getBoundingClientRect();openTaskMenu(activeTask().id,r.left,r.bottom);});
  on('#pluginButton','click',async()=>{try{await api.openPlugins();}catch(error){showToast(`无法打开插件网页：${error.message}`);}});
  on('#modelConnection','mouseenter',()=>showModelPopover(true));on('#modelConnection','mouseleave',()=>{popoverTimer=setTimeout(()=>showModelPopover(false),200);});
  on('#modelConnectionButton','click',()=>{showModelPopover(true);$('#settingsButton').focus();});on('#modelConnectionButton','keydown',e=>{if(e.key==='ArrowUp'){showModelPopover(true);$('#settingsButton').focus();}});
  on('#modelConnection','focusout',e=>{if(!$('#modelConnection').contains(e.relatedTarget))showModelPopover(false);});
  on('#settingsButton','click',openSettings);on('#modelButton','click',openModelMenu);on('#disconnectButton','click',disconnectModel);
  on('#webSearchButton','click',searchCurrentMessage);
  on('#modelButton','keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();openModelMenu();}});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('#modelPicker,#modelButton'))hideModelMenu();});
  window.addEventListener('resize',hideModelMenu);
  on('#closeSettings','click',()=>$('#settingsModal').close());on('#cancelSettings','click',()=>$('#settingsModal').close());on('#connectModel','click',connectModel);on('#providerInput','change',()=>{$('#modelIdInput').value='';updateProviderNote();});
  on('#showDialogSetting','change',e=>{state.settings.showTemporaryDialog=e.target.checked;persist();renderAction(activeTask());});
  on('#checkUpdateButton','click',checkUpdates);
  on('#downloadUpdateButton','click',downloadAppUpdate);
  on('#openUpdateInstallerButton','click',async()=>{
    if(updateInstallMode==='automatic'){
      const removeOldProgram=api.platform==='linux'?$('#removeOldProgram')?.checked!==false:true;
      const oldVersionNote=api.platform==='linux'?removeOldProgram?'旧版 AppImage 程序文件将被替换；任务与作品保留。':'旧版 AppImage 会先备份在原目录，任务与作品保留。':'';
      manage({title:'安装更新并重启？',description:`将先保存当前对话，再退出 Nodus 并安装已校验的更新。请先完成或停止正在运行的任务。${oldVersionNote}`,submit:async()=>{
        if(anyBusy()){$('#manageDescription').textContent='请先完成或停止正在运行的任务。';return false;}
        try{await persistNow();$('#updateStatus').textContent='正在退出并安装更新…';await api.installUpdate({removeOldProgram});}
        catch(error){$('#manageDescription').textContent=`无法安装更新：${error.message}`;return false;}
      }});return;
    }
    try{const result=await api.openUpdateInstaller();$('#updateStatus').textContent=result.message;}
    catch(error){$('#updateStatus').textContent=`无法打开安装包：${error.message}`;}
  });
  on('#openUpdatePageButton','click',async()=>{try{await api.openUpdatePage();}catch(error){$('#updateStatus').textContent=`无法打开发布页：${error.message}`;}});
  api.onUpdateProgress?.(({received,total})=>{
    if($('#updateProgress').hidden||!total)return;
    const percent=Math.min(100,Math.floor(received/total*100));
    $('#updateProgress').value=percent;
    $('#updateStatus').textContent=`正在下载更新包：${percent}%`;
  });
  on('#uninstallNodusButton','click',async()=>{
    try{
      const result=await api.uninstallNodus();
      if(result.openedSettings)$('#uninstallStatus').textContent='未找到本地卸载程序，已打开 Windows“已安装的应用”。如果卸载程序报完整性错误，请先重新下载并安装相同版本以修复。';
    }catch(error){$('#uninstallStatus').textContent=`无法启动卸载：${error.message}。可重新下载安装包并安装到原目录，再从 Windows“已安装的应用”卸载。`;}
  });
  on('#uninstallHelpButton','click',async()=>{try{await api.openUninstallHelp();}catch(error){$('#uninstallStatus').textContent=`无法打开卸载帮助：${error.message}`;}});
  document.querySelectorAll('[data-theme-choice]').forEach(button=>button.addEventListener('click',()=>{const select=$('#themeSetting');select.value=button.dataset.themeChoice;select.dispatchEvent(new Event('change'));}));
  on('#themeSetting','change',async e=>{
    const theme=e.target.value,previous=state.settings.theme||'light';
    try{applyAppearance(await api.setTheme(theme));state.settings.theme=theme;persist();}
    catch(error){e.target.value=previous;showToast(`切换主题失败：${error.message}`);}
  });
  on('#languageSetting','change',async event=>{
    const next=event.target.value,previous=state.settings.language||'zh-CN';
    state.settings.language=next;translator.set(next);render();translator.refresh();
    try{await api.setLanguage(next);persist();}
    catch(error){state.settings.language=previous;event.target.value=previous;translator.set(previous);render();translator.refresh();showToast(`切换语言失败：${error.message}`);}
  });
  on('#cancelManage','click',()=>$('#manageDialog').close());on('#attachButton','click',attachMaterials);
  document.addEventListener('dragover',event=>{
    if(!Array.from(event.dataTransfer?.types||[]).includes('Files'))return;
    event.preventDefault();event.dataTransfer.dropEffect=event.target.closest('#actionPanel')?'copy':'none';
  });
  document.addEventListener('drop',event=>{
    const files=Array.from(event.dataTransfer?.files||[]);if(!files.length)return;
    event.preventDefault();
    if(event.target.closest('#actionPanel'))void importTransferredFiles(files);
    else showToast('请将文件拖到下方输入框中。');
  });
  on('#actionPanel','paste',event=>{
    const files=Array.from(event.clipboardData?.files||[]);if(!files.length)return;
    event.preventDefault();void importTransferredFiles(files);
  });
  document.addEventListener('pointerdown',e=>{if(!e.target.closest('#taskContextMenu'))$('#taskContextMenu').hidden=true;});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){$('#taskContextMenu').hidden=true;showModelPopover(false);}});
  bindResizer('#railResizer','rail');bindResizer('#previewResizer','preview');window.addEventListener('resize',fitLayout);fitLayout();
}

async function initialize() {
  if(!api)throw new Error('请通过 Nodus 桌面应用打开；此界面需要本机任务与模型接口。');
  const bootstrap=await api.bootstrap();state=bootstrap.state;model=bootstrap.model;searchStatus=bootstrap.search||searchStatus;state.settings ||= {};
  translator.set(state.settings.language||'zh-CN');translator.start();
  $('#saveState').textContent='已保存';
  state.tasks.forEach(normalizeTask);
  if(state.settings.panelWidths){layout.railWidth=Math.min(280,Math.max(180,state.settings.panelWidths.rail||210));layout.previewWidth=Math.min(480,Math.max(300,state.settings.panelWidths.preview||370));}
  adviceUi=createAdviceWatchUi({api,getLanguage:()=>state.settings.language,toast:showToast});
  await adviceUi.initialize();
  bindEvents();
  api.onMenuCommand?.(async command=>{
    try{
      if($('dialog[open]')){showToast('请先完成或关闭当前对话框。');return;}
      if(command==='new-task'){await persistNow();createTask();}
      else if(command==='open-material'){
        const task=activeTask();
        if(!task||task.archivedAt||!['input','options','decision'].includes(task.stage)){
          await persistNow();createTask();
        }
        await attachMaterials();
      }
      else if(command==='save-task'){await persistNow();showToast('对话已保存');}
      else if(command==='export-work'){
        const task=activeTask();if(!task?.versions.length){showToast('尚未生成作品');return;}await exportWork(task,task.previewVersionId||task.currentVersionId);
      }
      else if(command==='open-work-directory'){
        const task=activeTask();if(!task?.versions.length){showToast('尚未生成作品');return;}await persistNow();await api.openVersionDirectory({taskId:task.id,versionId:task.previewVersionId||task.currentVersionId});
      }
      else if(command==='settings')openSettings();
      else if(command==='export-backup'){openSettings();$('#exportBackup').click();}
      else if(command==='preview')setPreview(!layout.previewOpen);
      else if(command==='open-task'){
        const tasks=state.tasks.filter(task=>!task.deletedAt);
        showExplanation(`<h2>打开已有对话</h2>${tasks.map(task=>`<p><button class="text-button" data-open-saved-task="${esc(task.id)}">${esc(task.title||'未命名对话')}${task.archivedAt?'（已归档）':''}</button></p>`).join('')||'<p>没有已保存的对话。</p>'}`);
        $$('[data-open-saved-task]').forEach(button=>button.onclick=async()=>{
          state.activeTaskId=button.dataset.openSavedTask;layout.detail=null;layout.view='preview';await persistNow();render();
        });
      }
    }catch(error){showToast(error.message);}
  });
  transcriptFollower=createTranscriptFollower($('#recordPanel'),$('#timeline'),$('#jumpToLatest'));
  api.onExecutionEvent(({taskId,event})=>{
    const task=state.tasks.find(t=>t.id===taskId);if(!task)return;
    if(event.type==='text_snapshot'){
      if(!isBusy(task))return;
      if(event.phase==='requirement-audit'||event.phase==='intent'){
        liveResponses.delete(taskId);
        if(event.phase==='requirement-audit')task.operation.lastActivity='正在核对作品是否符合已确认要求';
        if(activeTask()?.id===taskId)renderLiveResponse(task);
        return;
      }
      liveResponses.set(taskId,event.text);
      if(liveFrame===null)liveFrame=requestAnimationFrame(()=>{liveFrame=null;const current=activeTask();if(current)renderLiveResponse(current);});
      return;
    }
    task.executionEvents.push(event);
    if(isBusy(task)){task.operation.lastActivity=event.label;task.operation.lastActivityAt=new Date().toISOString();if(activeTask()?.id===taskId)renderLiveResponse(task);}
    persist();if(event.type==='usage')renderModel();
  });
  render();
}
initialize().catch(error=>{document.body.textContent=`应用启动失败：${error.message}`;});
