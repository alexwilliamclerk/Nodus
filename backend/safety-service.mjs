import {createHash, randomUUID} from 'node:crypto';
import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import path from 'node:path';
import {SafetyEvidence,sourceText} from './safety-evidence.mjs';
import {SafetyMaterials} from './safety-materials.mjs';
import {MinimalDisclosure} from './minimal-disclosure.mjs';

export const fingerprint=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const classes=new Set(['normal','private','blocked']);
const kinds=new Set(['model','search','web','read','write']);
const clean=value=>String(value??'').replace(/[\u0000-\u001f]/g,' ').replace(/[\u202a-\u202e\u2066-\u2069]/g,c=>`[U+${c.codePointAt(0).toString(16).toUpperCase()}]`).slice(0,240);
export class SafetyError extends Error {
  constructor(reason,{reasonCode='SAFETY_DENIAL',recoverableRead=false}={}){super(`NODUS_SAFETY: ${reason}`);this.name='SafetyError';this.code='NODUS_SAFETY';this.reasonCode=reasonCode;this.recoverableRead=recoverableRead;}
}
export function relativeScope(value){
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.includes('\0')||value.includes('\\')||value.includes(':')||value.includes('*')||path.posix.isAbsolute(value))throw new SafetyError('请使用工作副本内的相对路径 / Use relative workspace paths');
  const parts=value.trim().split('/');
  if(parts.includes('..'))throw new SafetyError('路径不能越出工作副本 / Path escapes workspace');
  const result=path.posix.normalize(value).replace(/\/$/,'');
  return result||'.';
}
export function covers(scopes,file){return scopes.some(scope=>scope==='.'||file===scope||file.startsWith(scope+'/'));}
export function protectedPath(file){return file.split('/').some(part=>/^(?:\.env(?:\..*)?|\.git|credentials\.json|auth\.json)$/i.test(part));}
export function recipient(value){
  let url;try{url=new URL(value);}catch{throw new SafetyError('接收方地址无效 / Invalid recipient');}
  if(url.protocol!=='https:'||url.username||url.password)throw new SafetyError('接收方必须使用 HTTPS / Recipient must use HTTPS');
  return url.origin;
}
export function defaultPolicy(){return {schemaVersion:1,revision:0,readPaths:['.'],writePaths:['.'],deniedPaths:[],readOnly:false,destinations:[]};}
export function normalizePolicy(input){
  if(!input||typeof input!=='object')throw new SafetyError('权限格式无效 / Invalid policy');
  const out=defaultPolicy();
  for(const key of ['readPaths','writePaths','deniedPaths']){
    if(!Array.isArray(input[key])||input[key].length>64)throw new SafetyError('路径列表无效 / Invalid path list');
    out[key]=[...new Set(input[key].map(relativeScope))];
  }
  out.readOnly=input.readOnly===true;
  if(!Array.isArray(input.destinations)||input.destinations.length>64)throw new SafetyError('接收方列表无效 / Invalid recipients');
  out.destinations=[...new Set(input.destinations.map(entry=>{
    if(typeof entry!=='string')throw new SafetyError('接收方格式无效 / Invalid recipient');
    const split=entry.indexOf('|'),kind=entry.slice(0,split);
    if(!['model','search','web'].includes(kind))throw new SafetyError('接收方类型无效 / Invalid recipient kind');
    return `${kind}|${recipient(entry.slice(split+1))}`;
  }))];
  return out;
}
export function sourceDescription(kind,name,content,origin=''){
  const digest=fingerprint(content??'');
  return {id:fingerprint([kind,String(name),digest]),kind:clean(kind),name:clean(name),origin:clean(origin),digest,[sourceText]:typeof content==='string'?content:''};
}
export function taskSources(task){
  const sources=(task.attachments||[]).filter(a=>a.status==='read'||a.status==='image'||a.image).map(a=>({...sourceDescription('attachment',a.name||'Material',a.text||a.image||a.data||JSON.stringify(a)),[sourceText]:a.text||''}));
  if(task.versionContext)sources.push(sourceDescription('workspace','作品与修改上下文 / Work context',task.versionContext));
  for(const s of task.webSearchResults||[])sources.push(sourceDescription('web',s.title||s.url,s.snippet||s.content||'',s.url||''));
  // Conversation carries prior source-derived answers; provenance is cumulative per task.
  return sources;
}

/** A main-process reference monitor. No policy or approval comes from model text. */
export class SafetyService {
  constructor({file,onChange=()=>{},onRecord=()=>{},onDisclosure=()=>{},timeoutMs=300000,now=()=>Date.now()}){
    Object.assign(this,{file,onChange,onRecord,timeoutMs,now});this.tasks={};this.pending=new Map();this.queue=Promise.resolve();this.epochs=new Map();this.closed=false;this.evidence=new SafetyEvidence();
    this.materials=new SafetyMaterials(path.join(path.dirname(file),'safety-materials'));
    this.disclosure=new MinimalDisclosure({enabled:id=>this.task(id).minimalDisclosure===true,onChange:onDisclosure,record:(id,event)=>this.record(id,event),timeoutMs});
  }
  async initialize(){
    await mkdir(path.dirname(this.file),{recursive:true});
    try{
      const data=JSON.parse(await readFile(this.file,'utf8'));
      if(data.schemaVersion!==1||!data.tasks||typeof data.tasks!=='object'||Array.isArray(data.tasks))throw new Error('Invalid safety store');
      for(const [id,value] of Object.entries(data.tasks)){
        this.validateId(id);
        value.policy={...normalizePolicy(value.policy),revision:Number(value.policy.revision)||0};
        if(value.minimalDisclosure!==undefined&&typeof value.minimalDisclosure!=='boolean')throw new Error('Invalid disclosure setting');
        if(!Array.isArray(value.sources)||!Array.isArray(value.events)||value.sources.some(s=>!classes.has(s.classification)||typeof s.id!=='string'))throw new Error('Invalid safety sources');
      }
      this.tasks=data.tasks;
    }catch(error){if(error.code!=='ENOENT')throw new SafetyError('权限记录无法读取；未启动模型或工具 / Safety store unavailable');}
  }
  validateId(id){if(typeof id!=='string'||! /^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,180}$/.test(id))throw new SafetyError('任务标识无效 / Invalid task');}
  task(id){this.validateId(id);if(!Object.hasOwn(this.tasks,id))this.tasks[id]={policy:defaultPolicy(),sources:[],events:[]};return this.tasks[id];}
  snapshot(id){const t=this.task(id);return structuredClone({...t,pending:[...this.pending.values()].filter(p=>p.taskId===id).map(p=>p.public)});}
  allPending(){return [...this.pending.values()].map(p=>structuredClone(p.public));}
  async persist(){
    const data=JSON.stringify({schemaVersion:1,tasks:this.tasks},null,2);
    const save=async()=>{await writeFile(this.file+'.pending',data,{mode:0o600});await rename(this.file+'.pending',this.file);};
    this.queue=this.queue.catch(()=>{}).then(save);await this.queue;
  }
  notify(){this.onChange(this.allPending());}
  async registerSources(id,sources){
    const t=this.task(id);let changed=false;
    await this.materials.capture(id,sources);
    this.evidence.register(id,sources);
    for(const s of sources){
      const actualMaterial=Boolean(s[sourceText])||s.kind!=='workspace';
      const sourceOrder=actualMaterial?(t.sourceSequence=(t.sourceSequence||0)+1):0;
      const existing=t.sources.find(v=>v.id===s.id);
      if(existing){if(actualMaterial){existing.sourceOrder=sourceOrder;changed=true;}continue;}
      if(t.sources.length>=500)throw new SafetyError('来源过多，请新建任务 / Too many sources; start a new task');
      const predecessors=t.sources.filter(v=>v.kind===s.kind&&v.name===s.name);
      const classification=predecessors.some(v=>v.classification==='blocked')?'blocked':predecessors.some(v=>v.classification==='private')?'private':'normal';
      // Keep the content-bearing symbol out of snapshots and persisted state.
      const {id:sourceId,kind,name,origin,digest}=s;
      t.sources.push({id:sourceId,kind,name,origin,digest,classification,sourceOrder});changed=true;
    }
    if(changed)await this.persist();
    return t.sources;
  }
  async setPolicy(id,input,expectedRevision){
    const t=this.task(id);
    if(t.policy.revision!==expectedRevision)throw new SafetyError('权限已更新，请重新打开 / Policy changed; reopen');
    const policy=normalizePolicy(input);policy.revision=t.policy.revision+1;
    this.cancel(id,'权限已变更，请重新提交 / Permissions changed; retry');
    t.policy=policy;await this.record(id,{kind:'policy',outcome:'updated'});return this.snapshot(id);
  }
  async setMinimalDisclosure(id,enabled){
    if(typeof enabled!=='boolean')throw new SafetyError('外发设置无效 / Invalid disclosure setting');
    this.cancel(id);const task=this.task(id);task.minimalDisclosure=enabled;task.policy.revision++;
    await this.record(id,{kind:'disclosure',outcome:'updated',enabled});return this.snapshot(id);
  }
  async setSourceClass(id,sourceId,classification){
    if(!classes.has(classification))throw new SafetyError('来源分类无效 / Invalid source classification');
    const t=this.task(id),s=t.sources.find(s=>s.id===sourceId);
    if(!s)throw new SafetyError('来源不存在 / Source missing');
    this.cancel(id,'来源权限已变更 / Source permissions changed');
    // All versions of this source inherit the choice; no bypass by replacing its bytes.
    for(const v of t.sources)if(v.kind===s.kind&&v.name===s.name)v.classification=classification;
    if(classification!=='normal')for(const event of t.events)for(const link of event.explanation?.links||[]){
      link.excerpt=null;link.matched=null;link.excerptHidden=true;
    }
    t.policy.revision++;
    await this.record(id,{kind:'source',outcome:classification,sources:[sourceId]});return this.snapshot(id);
  }
  async record(id,event){
    const t=this.task(id),entry={id:randomUUID(),at:new Date(this.now()).toISOString(),...event};t.events.push(entry);
    t.events=t.events.slice(-200);await this.persist();this.onRecord({taskId:id,event:structuredClone(entry)});
  }
  decision(id,action){
    const t=this.task(id),p=t.policy;
    if(!kinds.has(action.kind))return {status:'deny',reason:'不支持的操作 / Unsupported operation'};
    if(['read','write'].includes(action.kind)){
      const file=relativeScope(action.target);
      if(protectedPath(file))return {status:'deny',reason:'凭据与 Git 内部文件不向模型开放 / Credential and Git files are protected'};
      if(covers(p.deniedPaths.map(p=>p.normalize('NFC').toLowerCase()),file.normalize('NFC').toLowerCase()))return {status:'deny',reason:'该路径已明确禁止 / Path explicitly denied',reasonCode:'DENIED_PATH',recoverableRead:action.kind==='read'};
      if(action.kind==='write'&&p.readOnly)return {status:'deny',reason:'当前任务为只读 / Task is read-only'};
      if(covers(p[action.kind==='read'?'readPaths':'writePaths'],file))return {status:'allow'};
      return {status:'ask',reason:'操作超出当前路径授权 / Path is outside current authorization',canRemember:false};
    }
    const origin=recipient(action.target),sources=t.sources;
    if(sources.some(s=>s.classification==='blocked'))return {status:'deny',reason:'任务含禁止外发的来源；请在安全与授权中处理 / Task contains a blocked source'};
    if(sources.some(s=>s.classification==='private'))return {status:'ask',reason:'任务含私密来源，每次外发需确认 / Private sources require approval for each transfer',canRemember:false};
    if(p.destinations.includes(`${action.kind}|${origin}`))return {status:'allow'};
    return {status:'ask',reason:'尚未授权此接收方 / Recipient is not authorized',canRemember:true};
  }
  grantFor(id,action){
    const t=this.task(id),revision=t.policy.revision,epoch=this.epochs.get(id)||0;
    const payload=fingerprint(action.payload??''),kind=action.kind,target=action.target;
    const network=['model','search','web'].includes(kind);
    const sources=fingerprint(t.sources.map(s=>[s.id,s.classification]));
    // An in-process closure, not an approval that model/renderer JSON can forge.
    return Object.freeze({assertCurrent:(actual={})=>{
      const now=this.task(id);
      if(this.closed||now.policy.revision!==revision||(this.epochs.get(id)||0)!==epoch||
          (network&&fingerprint(now.sources.map(s=>[s.id,s.classification]))!==sources))throw new SafetyError('授权已撤回或上下文已变化 / Authorization revoked or context changed',{reasonCode:'STALE_GRANT'});
      if((actual.kind!==undefined&&actual.kind!==kind)||(actual.target!==undefined&&actual.target!==target)||
          (Object.hasOwn(actual,'payload')&&fingerprint(actual.payload??'')!==payload))throw new SafetyError('本次授权不适用于变化后的操作 / Grant does not cover the changed operation',{reasonCode:'CHANGED_ACTION'});
      return true;
    }});
  }
  contextCheckpoint(id){
    const revision=this.task(id).policy.revision,epoch=this.epochs.get(id)||0;
    return ()=>{if(this.closed||this.task(id).policy.revision!==revision||(this.epochs.get(id)||0)!==epoch)throw new SafetyError('读取上下文后权限已变化，请重新读取 / Context permissions changed; reread required',{reasonCode:'STALE_CONTEXT'});};
  }
  async authorize(id,action,{interactive=true}={}){
    if(this.closed)throw new SafetyError('应用正在退出 / App is closing');
    // SDK contexts include executable tool handlers; only the serialized request
    // data belongs to an authorization, never those trusted implementation objects.
    action=JSON.parse(JSON.stringify(action));
    if(['model','search','web'].includes(action.kind))action.target=recipient(action.target);
    const t=this.task(id),decision=this.decision(id,action),epoch=this.epochs.get(id)||0;
    const grant=this.grantFor(id,action);
    const explanation=this.evidence.explain(id,action,t.sources);
    const summary={kind:action.kind,target:clean(action.target),sources:t.sources.map(s=>s.id),explanation,requestDigest:fingerprint([action.kind,action.target,action.payload??'',t.policy.revision])};
    if(decision.status==='allow'){await this.record(id,{...summary,outcome:'allowed'});grant.assertCurrent();return grant;}
    if(decision.status==='deny'||!interactive){await this.record(id,{...summary,outcome:'blocked',reason:decision.reason});throw new SafetyError(decision.reason,{reasonCode:decision.reasonCode,recoverableRead:decision.recoverableRead===true});}
    const requestId=randomUUID(),revision=t.policy.revision;
    const preview=String(action.preview??(['read','write'].includes(action.kind)?JSON.stringify(action.payload||{}):''));
    const display={explanation,preview:preview.slice(0,12000),previewTruncated:preview.length>12000,id:requestId,taskId:id,kind:action.kind,target:clean(action.target),detail:clean(action.detail),reason:decision.reason,canRemember:decision.canRemember===true,revision,expiresAt:this.now()+this.timeoutMs,sources:t.sources.map(({id,name,kind,origin,classification})=>({id,name,kind,origin,classification}))};
    await this.record(id,{...summary,outcome:'requested',requestId});
    if(epoch!==(this.epochs.get(id)||0)||revision!==this.task(id).policy.revision)throw new SafetyError('请求已取消 / Request cancelled');
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>this.reject(requestId,'授权已超时 / Approval expired'),this.timeoutMs);timer.unref?.();
      this.pending.set(requestId,{taskId:id,revision,grant,action:structuredClone(action),summary,public:display,resolve,reject,timer});this.notify();
    });
  }
  async resolve(requestId,choice){
    const p=this.pending.get(requestId);
    if(!p)throw new SafetyError('请求已结束，请重新提交 / Request no longer pending');
    if(!['once','remember','deny'].includes(choice))throw new SafetyError('无效决定 / Invalid decision');
    if(p.revision!==this.task(p.taskId).policy.revision||p.public.expiresAt<=this.now()){this.reject(requestId,'权限已变化或请求已过期 / Stale approval');throw new SafetyError('请求已过期 / Stale approval');}
    if(choice==='remember'&&!p.public.canRemember)throw new SafetyError('只能批准本次操作 / Only this operation can be approved');
    this.pending.delete(requestId);clearTimeout(p.timer);this.notify();
    if(choice==='deny'){
      try{await this.record(p.taskId,{...p.summary,outcome:'denied',requestId});}finally{p.reject(new SafetyError('用户拒绝了本次操作 / User denied this operation'));}return;
    }
    try{
      if(choice==='remember'){
        const policy=this.task(p.taskId).policy;
        policy.destinations=[...new Set([...policy.destinations,`${p.action.kind}|${recipient(p.action.target)}`])];
      }
      await this.record(p.taskId,{...p.summary,outcome:'approved',choice,requestId});
      if(p.revision!==this.task(p.taskId).policy.revision)throw new SafetyError('权限已变化 / Policy changed');
      p.grant.assertCurrent();p.resolve(p.grant);
    }catch(error){p.reject(error);throw error;}
  }
  reject(id,reason){const p=this.pending.get(id);if(!p)return;this.pending.delete(id);clearTimeout(p.timer);p.reject(new SafetyError(reason));this.notify();void this.record(p.taskId,{...p.summary,outcome:'cancelled',reason,requestId:id}).catch(()=>{});}
  cancel(taskId,reason='操作已停止 / Operation stopped'){this.epochs.set(taskId,(this.epochs.get(taskId)||0)+1);this.disclosure.cancel(taskId);for(const [id,p] of this.pending)if(p.taskId===taskId)this.reject(id,reason);}
  close(){this.closed=true;this.evidence.clear();this.disclosure.close();for(const id of this.pending.keys())this.reject(id,'应用正在退出 / App is closing');}
  async assertContextPaths(id,files){
    for(const file of files){const decision=this.decision(id,{kind:'read',target:file});if(decision.status!=='allow'){await this.record(id,{kind:'read',target:file,outcome:'blocked',reason:decision.reason||'Context outside authorized paths'});throw new SafetyError(`上下文文件未获读取授权 / Context file not authorized: ${file}`);}}
  }
}
