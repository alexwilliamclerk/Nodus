import {demoScenarios} from './demo-scenarios.js';
import {escapeHtml as esc} from './components.js';

// Deliberately has no model, storage, network or permission API dependency.
export function mountDemo(root,{getLanguage=()=> 'zh-CN',onTry,onClose}={}) {
  let selected=demoScenarios[0],step=0;
  const text=pair=>pair[getLanguage()==='en-US'?1:0];
  function render(){
    const t=(zh,en)=>text([zh,en]);
    root.innerHTML=`<div class="demo-shell" data-localized><header class="demo-header"><div><small>NODUS / ${t('交互演示','INTERACTIVE DEMO')}</small><h2>${t('先体验，再连接模型','Explore before connecting a model')}</h2></div>${onClose?`<button type="button" id="closeDemo" class="secondary-button">${t('关闭','Close')}</button>`:''}</header>
    <p class="demo-notice">${t('离线脚本演示 · 无需 API Key · 不调用模型。以下结果均为虚构教学案例，不代表实测安全性、质量或节省。','Offline scripted demo · No API key · No model calls. All outcomes are fictional teaching examples, not measured safety, quality or savings.')}</p>
    <nav class="demo-cases" aria-label="${t('选择案例','Choose a case')}">${demoScenarios.map(s=>`<button type="button" data-demo-case="${s.id}" aria-pressed="${s===selected}">${esc(text(s.title))}</button>`).join('')}</nav>
    <p>${esc(text(selected.intro))}</p>
    <details><summary>${t('查看完整示例任务与材料','View the example request and source')}</summary><h3>${t('用户任务','User request')}</h3><p>${esc(text(selected.request))}</p><h3>${t('虚构外部材料（不可信）','Fictional external material (untrusted)')}</h3><pre>${esc(text(selected.material))}</pre></details>
    <section class="demo-stage" aria-live="polite" aria-atomic="true"><small>${t('步骤','Step')} ${step+1} / ${selected.steps.length} · ${t('预设情景','Scripted scenario')}</small><h3>${esc(text(selected.steps[step][0]))}</h3><p>${esc(text(selected.steps[step][1]))}</p></section>
    <div class="demo-controls"><button type="button" id="demoBack" ${step===0?'disabled':''}>${t('上一步','Back')}</button><progress value="${step+1}" max="${selected.steps.length}" aria-label="${t('演示进度','Demo progress')}"></progress><button type="button" id="demoNext" ${step===selected.steps.length-1?'disabled':''}>${t('下一步','Next')}</button><button type="button" id="demoReset">${t('重新播放','Replay')}</button></div>
    <footer><h3>${t('使用自己的模型验证','Verify with your own model')}</h3><p>${t('1. 创建独立示例任务；2. 连接模型并检查授权；3. 手动提交，再核对实际结果。真实运行会发送示例材料，可能产生费用，不会沿用演示结果。','1. Create a separate example task; 2. connect a model and review permissions; 3. submit manually and inspect actual results. Real runs send the example material and may incur charges; scripted outcomes are not imported.')}</p>${onTry?`<button type="button" id="demoTry">${t('创建真实试用任务（不运行）','Create a real trial task (does not run)')}</button>`:`<a href="https://github.com/alexwilliamclerk/Nodus/releases/latest">${t('下载 Nodus，在应用内创建示例任务','Download Nodus to create an example task')}</a>`}<p id="demoError" role="alert"></p><p class="demo-support">${t('有帮助的话，欢迎 Star 支持后续开发。','If this is useful, star the project to support its development.')} <a href="https://github.com/alexwilliamclerk/Nodus" target="_blank" rel="noopener noreferrer">GitHub ↗</a></p></footer></div>`;
    root.querySelectorAll('[data-demo-case]').forEach(b=>b.onclick=()=>{selected=demoScenarios.find(s=>s.id===b.dataset.demoCase);step=0;render();root.querySelector(`[data-demo-case="${selected.id}"]`).focus();});
    const move=(n,focus)=>{step=n;render();root.querySelector(focus).focus();};
    root.querySelector('#demoBack').onclick=()=>move(Math.max(0,step-1),'#demoNext');
    root.querySelector('#demoNext').onclick=()=>move(Math.min(selected.steps.length-1,step+1),step+1===selected.steps.length-1?'#demoReset':'#demoNext');
    root.querySelector('#demoReset').onclick=()=>move(0,'#demoNext');
    if(onClose)root.querySelector('#closeDemo').onclick=onClose;
    if(onTry)root.querySelector('#demoTry').onclick=async()=>{const b=root.querySelector('#demoTry');b.disabled=true;try{await onTry(selected,getLanguage());}catch(e){root.querySelector('#demoError').textContent=e.message;b.disabled=false;}};
  }
  render();return {reset(){selected=demoScenarios[0];step=0;render();},render};
}
export function createDemoUi({getLanguage,onTry}){
  const dialog=document.createElement('dialog');dialog.id='demoDialog';dialog.className='demo-dialog';dialog.setAttribute('aria-label','Nodus demo');document.body.append(dialog);
  const ui=mountDemo(dialog,{getLanguage,onTry:async(...args)=>{await onTry(...args);dialog.close();},onClose:()=>dialog.close()});
  return {open(){ui.reset();dialog.showModal();}};
}
