const features={permission:{title:'先明确边界，再开始行动。',sub:'任务级权限 · 由你审阅和授权',rows:[['⌑','项目文件夹','允许读取'],['◇','作品输出目录','允许写入'],['⊘','其他本地文件','未授权']]},memory:{title:'记住什么，由你决定。',sub:'可追溯记忆 · 审阅后才可用于任务',rows:[['≡','“报告优先使用中文”','候选记忆'],['⌑','来源：报告制作任务','查看原文'],['↶','已审阅的记忆','可撤销']]},privacy:{title:'发送之前，先看一眼。',sub:'外发审阅 · 原始材料保持不变',rows:[['≡','实际模型请求','可审阅'],['⊘','客户联系方式','可手动移除'],['◇','你的模型服务','确认接收方']]},test:{title:'让信任，有具体的依据。',sub:'隔离测试副本 · 不影响原任务',rows:[['⌑','同一份任务与测试材料','切换模型'],['⊘','越权尝试与权限拦截','分别记录'],['◇','原任务是否完成','独立判断']]}};
const tabs=[...document.querySelectorAll('[data-feature]')];
function select(tab){tabs.forEach(t=>{const active=t===tab;t.setAttribute('aria-selected',String(active));t.tabIndex=active?0:-1});const f=features[tab.dataset.feature];document.getElementById('feature-panel').setAttribute('aria-labelledby',tab.id);document.getElementById('panel-content').innerHTML=`<h3>${f.title}</h3><p class="panel-sub">${f.sub}</p>${f.rows.map(([icon,label,state])=>`<div class="permission-row"><span class="row-icon" aria-hidden="true">${icon}</span><span>${label}</span><span class="badge">${state}</span></div>`).join('')}`;}
tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>select(tab));tab.addEventListener('keydown',e=>{let j;if(e.key==='ArrowDown')j=(i+1)%tabs.length;if(e.key==='ArrowUp')j=(i-1+tabs.length)%tabs.length;if(e.key==='Home')j=0;if(e.key==='End')j=tabs.length-1;if(j!==undefined){e.preventDefault();tabs[j].focus();select(tabs[j])}})});select(tabs[0]);

// Reveal only below-the-fold content; keep all content visible without JavaScript.
if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.remove('pending'); observer.unobserve(entry.target); }
    });
  }, { threshold: 0.08 });
  document.body.classList.add('motion-enabled');
  document.querySelectorAll('.intro-row, .capability-list, .control-layout, .workspace-frame, .workspace-details, .open-section, .download-links').forEach(el => {
    el.classList.add('reveal', 'pending'); observer.observe(el);
  });
}

// Fixed Earth: passive scroll input, a single animation frame, slow exposure changes.
{
  const background = document.querySelector('.site-background');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
  const clamp = value => Math.max(0, Math.min(1, value));
  const smooth = (value, start = 0, end = 1) => {
    const t = clamp((value - start) / (end - start));
    return t * t * (3 - 2 * t);
  };
  let target = 0, displayed = 0, frame = 0, lastTime = 0;
  function paint(progress) {
    background.style.setProperty('--earth-brightness', (.32 + .68 * smooth(progress)).toFixed(4));
    background.style.setProperty('--city-west', smooth(progress, .06, .82).toFixed(4));
    background.style.setProperty('--city-center', smooth(progress, .14, .92).toFixed(4));
    background.style.setProperty('--city-east', smooth(progress, .24, 1).toFixed(4));
  }
  function animate(time) {
    frame = 0;
    const elapsed = lastTime ? Math.min(time - lastTime, 64) : 16;
    lastTime = time;
    displayed += (target - displayed) * (1 - Math.exp(-elapsed / 420));
    if (Math.abs(target - displayed) < .0002) displayed = target;
    paint(displayed);
    if (displayed !== target) frame = requestAnimationFrame(animate);
    else lastTime = 0;
  }
  function update() {
    if (!background) return;
    const range = document.documentElement.scrollHeight - innerHeight;
    target = range > 0 ? clamp(scrollY / range) : 0;
    if (reduceMotion.matches) {
      cancelAnimationFrame(frame); frame = 0; lastTime = 0;
      displayed = target; paint(displayed);
    } else if (!frame) frame = requestAnimationFrame(animate);
  }
  if (background) {
    addEventListener('scroll', update, { passive: true });
    addEventListener('resize', update, { passive: true });
    addEventListener('pageshow', update);
    addEventListener('load', update, { once: true });
    reduceMotion.addEventListener('change', update);
    if ('ResizeObserver' in window) new ResizeObserver(update).observe(document.body);
    update();
  }
}
