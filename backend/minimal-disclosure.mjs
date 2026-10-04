import {createHash,randomUUID} from 'node:crypto';

const digest=text=>createHash('sha256').update(text).digest('hex');
const error=message=>Object.assign(new Error(`NODUS_SAFETY: ${message}`),{code:'NODUS_SAFETY'});
const escape=value=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const defaults=['api_key','apikey','access_token','token','password','secret','authorization','email','phone','customer_name','customer_id','bank_account','姓名','客户姓名','邮箱','电话','手机号','身份证号','银行账号'];
const protocolPath=path=>/^\/[^/]+$/.test(path)&&!['/system','/prompt','/input'].includes(path)||
  /\/(?:messages|contents)\/\d+\/(?:role|name|tool_call_id)$/.test(path)||
  /\/(?:tool_calls|tools)\/\d+\/(?:id|type)$/.test(path)||
  /\/(?:function|functionCall|functionResponse)\/name$/.test(path)||
  /\/content\/\d+\/(?:type|id|name|tool_use_id)$/.test(path);
const marker='[HIDDEN]';
function decodedView(text){
  const regex=/\\(?:u[0-9a-fA-F]{4}|["\\/bfnrt])/g,starts=new Uint32Array(text.length),ends=new Uint32Array(text.length),parts=[];
  let source=0,index=0;
  for(const match of text.matchAll(regex)){
    parts.push(text.slice(source,match.index));for(let i=source;i<match.index;i++){starts[index]=i;ends[index++]=i+1;}
    const value=JSON.parse('"'+match[0]+'"');parts.push(value);for(let i=0;i<value.length;i++){starts[index]=match.index;ends[index++]=match.index+match[0].length;}source=match.index+match[0].length;
  }
  parts.push(text.slice(source));for(let i=source;i<text.length;i++){starts[index]=i;ends[index++]=i+1;}
  return {text:parts.join(''),starts,ends};
}
const binary=value=>value&&typeof value==='object'&&!Array.isArray(value)&&(
  /^(image|image_url|input_image|input_file|document)$/.test(value.type||'')||value.inlineData||value.fileData);

export function disclosedContext(body){
  const messages=body.messages||body.contents||(Array.isArray(body.input)?body.input:[]);
  return {messages:messages.flatMap(m=>{
    if(['user','tool','toolResult'].includes(m.role))return [{role:m.role==='user'?'user':'toolResult',content:m.content??m.parts}];
    if(m.type==='function_call_output')return [{role:'toolResult',content:m.output}];
    return [];
  })};
}

function leaves(value,path='',out=[]){
  if(typeof value==='string'||typeof value==='number')out.push({path,text:String(value),valueType:typeof value,editable:!protocolPath(path)});
  else if(Array.isArray(value))value.forEach((v,i)=>leaves(v,path+'/'+i,out));
  else if(value&&typeof value==='object'&&!binary(value))for(const [key,v] of Object.entries(value))leaves(v,path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1'),out);
  return out;
}
function images(value,path='',out=[]){
  if(binary(value)){
    const data=value.image_url?.url||value.url||(value.source?.data?`data:${value.source.media_type};base64,${value.source.data}`:value.inlineData?.data?`data:${value.inlineData.mimeType};base64,${value.inlineData.data}`:'');
    out.push({path,type:value.type||'inlineData',thumbnail:data.length<700000&&/^data:image\/(png|jpeg|webp|gif);base64,/i.test(data)?data:null});return out;
  }
  if(Array.isArray(value))value.forEach((v,i)=>images(v,path+'/'+i,out));
  else if(value&&typeof value==='object')for(const [key,v] of Object.entries(value))images(v,path+'/'+key.replace(/~/g,'~0').replace(/\//g,'~1'),out);
  return out;
}
function textViews(body){return leaves(body).filter(l=>l.editable).map(l=>{
  const m=/^\/(messages|contents|input)\/(\d+)\//.exec(l.path),entry=m?body[m[1]]?.[Number(m[2])]:null;
  return {...l,role:entry?.role||(entry?.type==='function_call_output'?'tool':l.path.startsWith('/system')?'system':'other')};
});}
export function disclosureCandidates(body,fields=[]){
  const found=new Map();
  const add=(value,kind,path)=>{
    value=String(value).trim();if(!value||value===marker||value.length>2000)return;
    const key=digest(value),item=found.get(key)||{id:key,value,kinds:[],paths:[]};
    if(!item.kinds.includes(kind))item.kinds.push(kind);if(!item.paths.includes(path))item.paths.push(path);found.set(key,item);
  };
  const keys=[...new Set([...defaults,...fields])];
  for(const leaf of leaves(body).filter(l=>l.editable)){
    const key=leaf.path.split('/').at(-1).replace(/~1/g,'/').replace(/~0/g,'~');
    if(/\/(?:input|args)\//.test(leaf.path)&&keys.some(k=>k.toLowerCase()===key.toLowerCase()))add(leaf.text,key,leaf.path);
    for(const m of leaf.text.matchAll(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi))add(m[0],'email',leaf.path);
    for(const m of leaf.text.matchAll(/\b(?:sk-|sk_|ghp_|github_pat_)[a-zA-Z0-9_-]{12,}\b/g))add(m[0],'credential',leaf.path);
    for(const m of leaf.text.matchAll(/(?<!\d)(?:\+?86[- ]?)?1[3-9]\d{9}(?!\d)/g))add(m[0],'phone',leaf.path);
    for(const field of keys){
      const pattern=new RegExp(`(?:"${escape(field)}"|(?:^|["'\\s,{;；])${escape(field)})\\s*[:=：]\\s*(?:"((?:\\\\.|[^"\\\\])*)"|'([^']*)'|([^\\r\\n,;；}"\\\\]+))`,'gim');
      for(const m of leaf.text.matchAll(pattern)){
        let value=m[1]??m[2]??m[3];if(m[1]!==undefined){try{value=JSON.parse('"'+value+'"');}catch{}}
        if(value?.trim())add(value,field,leaf.path);
      }
    }
  }
  return [...found.values()];
}

export function minimizeBody(body,{values=[],omitPaths=[],keepBinary=[]}={}){
  if(!Array.isArray(values)||values.length>5000||values.some(v=>typeof v!=='string'||!v||v.length>4000)||!Array.isArray(omitPaths)||!Array.isArray(keepBinary))throw error('隐藏项无效或超过 5000 项，请省略整段或分批处理 / Invalid choices or more than 5000 hidden values');
  const textLeaves=leaves(body),knownPaths=new Set(textLeaves.filter(l=>l.editable).map(l=>l.path)),imagePaths=new Set(images(body).map(i=>i.path));
  if(omitPaths.some(p=>!knownPaths.has(p))||keepBinary.some(p=>!imagePaths.has(p)))throw error('请求已变化或字段无效 / Invalid request field');
  const hidden=[...new Set(values)].sort((a,b)=>b.length-a.length),omitted=new Set(omitPaths),retained=new Set(keepBinary);
  const variants=[...new Set(hidden.flatMap(value=>[value,value.replace(/\r\n?/g,'\n'),value.replace(/\r?\n/g,'\r\n')]).flatMap(value=>[value,JSON.stringify(value).slice(1,-1)]))].sort((a,b)=>b.length-a.length);
  const literal=value=>/^\d{1,6}$/.test(value)?`(?<![A-Za-z0-9_])${escape(value)}(?![A-Za-z0-9_])`:escape(value);
  const pattern=variants.length?new RegExp(variants.map(literal).join('|'),'g'):null;
  const protocolVariants=variants.filter(value=>!/^\d{1,6}$/.test(value));
  const protocolPattern=protocolVariants.length?new RegExp(protocolVariants.map(escape).join('|'),'g'):null;
  function scrub(text){
    // A single literal matcher also handles large logs without rescanning the
    // full text separately for every selected field value.
    if(!pattern)return text;
    if(!/\\(?:u[0-9a-fA-F]{4}|["\\/bfnrt])/.test(text))return text.replace(pattern,()=>marker);
    const view=decodedView(text),ranges=[];
    pattern.lastIndex=0;for(const m of text.matchAll(pattern))ranges.push([m.index,m.index+m[0].length]);
    pattern.lastIndex=0;for(const m of view.text.matchAll(pattern))ranges.push([view.starts[m.index],view.ends[m.index+m[0].length-1]]);
    ranges.sort((a,b)=>a[0]-b[0]);const merged=[];
    for(const range of ranges){const last=merged.at(-1);if(last&&range[0]<=last[1])last[1]=Math.max(last[1],range[1]);else merged.push([...range]);}
    let end=0,result='';for(const range of merged){result+=text.slice(end,range[0])+marker;end=range[1];}return result+text.slice(end);
  }
  function walk(value,path=''){
    if(binary(value))return retained.has(path)?value:undefined;
    if(typeof value==='string'||typeof value==='number'){
      if(omitted.has(path))return '[OMITTED BY USER]';
      if(protocolPath(path))return value;
      if(typeof value==='number')return hidden.includes(String(value))?marker:value;
      // Tool arguments often encode a JSON object inside a string. Keep it
      // syntactically valid when hiding numeric values or escaped strings.
      if(/^[\s]*[\[{]/.test(value)){try{const parsed=JSON.parse(value);return scrub(JSON.stringify(walkData(parsed)));}catch{}}
      return scrub(value);
    }
    if(Array.isArray(value))return value.map((v,i)=>walk(v,path+'/'+i)).filter(v=>v!==undefined);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,walk(v,path+'/'+k.replace(/~/g,'~0').replace(/\//g,'~1'))]).filter(([,v])=>v!==undefined));
    return value;
  }
  function walkData(value){
    if(typeof value==='string')return scrub(value);
    if(typeof value==='number'&&hidden.includes(String(value)))return marker;
    if(Array.isArray(value))return value.map(walkData);
    if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,walkData(v)]));
    return value;
  }
  const result=walk(body);
  // Protocol identifiers cannot be redacted silently. Refuse a request if a
  // chosen literal remains there, rather than sending a misleading preview.
  const residual=pattern&&leaves(result).some(l=>{
    // A token limit or model version coinciding with a short customer number
    // is protocol metadata, not another copy of that customer's data.
    if(!l.editable&&l.valueType==='number')return false;
    const matcher=l.editable?pattern:protocolPattern;if(!matcher)return false;
    matcher.lastIndex=0;if(matcher.test(l.text))return true;if(!l.text.includes('\\'))return false;matcher.lastIndex=0;return matcher.test(decodedView(l.text).text);
  });
  if(residual)throw error('隐藏项仍出现在必要接口字段中，无法安全发送；请调整选择或停止 / Hidden value remains in a protocol field');
  return {body:result,text:JSON.stringify(result,null,2),hiddenCount:hidden.length,omittedCount:omitted.size,removedBinary:imagePaths.size-retained.size};
}

export class MinimalDisclosure {
  constructor({enabled,onChange=()=>{},record=async()=>{},timeoutMs=300000}){Object.assign(this,{enabled,onChange,record,timeoutMs});this.pending=new Map();this.hidden=new Map();this.fields=new Map();}
  list(){return [...this.pending.values()].map(p=>({id:p.id,taskId:p.taskId,target:p.target,candidates:p.candidates,sections:p.sections,images:p.images,defaultHidden:p.defaultHidden,fields:p.fields,choices:p.preview?.choices,expiresAt:p.expiresAt}));}
  notify(){this.onChange(this.list());}
  prune(){while(this.hidden.size>12){const oldest=this.hidden.keys().next().value;this.hidden.delete(oldest);this.fields.delete(oldest);}}
  inherit(from,to){if(this.hidden.has(from))this.hidden.set(to,[...this.hidden.get(from)]);if(this.fields.has(from))this.fields.set(to,[...this.fields.get(from)]);this.prune();}
  cancel(taskId){for(const p of [...this.pending.values()])if(p.taskId===taskId)this.reject(p.id,'已停止或权限已变化 / Stopped or permissions changed');}
  close(){for(const p of [...this.pending.values()])this.reject(p.id,'应用退出 / App closing');this.hidden.clear();this.fields.clear();}
  reject(id,message){const p=this.pending.get(id);if(!p)return;clearTimeout(p.timer);this.pending.delete(id);p.reject(error(message));this.notify();}
  async filter(taskId,input,init,assertCurrent,{interactive=true}={}){
    if(!this.enabled(taskId))return init;
    if(!interactive)throw error('此任务需要核对最小信息外发，请手动执行 / Disclosure review requires an interactive run');
    const raw=typeof init?.body==='string'?init.body:input instanceof Request&&!Object.hasOwn(init||{},'body')?await input.clone().text():null;
    if(raw===null||raw.length>4000000)throw error('此请求格式或大小不支持外发预览，已停止发送 / Request cannot be previewed safely');
    let body;try{body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw Error();}catch{throw error('仅支持 JSON 模型请求预览，已停止发送 / Unsupported request body');}
    assertCurrent();
    const signal=init?.signal??(input instanceof Request?input.signal:null);
    if(signal?.aborted)throw error('外发请求已取消 / Transfer cancelled');
    const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url),id=randomUUID(),fields=this.fields.get(taskId)||[],candidates=disclosureCandidates(body,fields),prior=this.hidden.get(taskId)||[];
    const views=leaves(body).filter(l=>l.editable).map(l=>({...l,decoded:l.text.includes('\\')?decodedView(l.text).text:l.text}));
    for(const value of prior){const matches=views.filter(l=>l.text.includes(value)||l.decoded.includes(value));if(matches.length&&!candidates.some(c=>c.value===value))candidates.push({id:digest(value),value,kinds:['previously-hidden'],paths:matches.map(l=>l.path)});}
    const sections=leaves(body).filter(l=>l.editable).map(l=>({path:l.path,text:l.text})),binaryParts=images(body);
    let abort;
    const text=await new Promise((resolve,reject)=>{
      const p={id,taskId,target:url.origin+url.pathname,body,candidates,sections,images:binaryParts,defaultHidden:candidates.map(c=>c.id),fields,resolve,reject,assertCurrent,expiresAt:Date.now()+this.timeoutMs};
      p.timer=setTimeout(()=>this.reject(id,'外发预览已超时 / Disclosure review expired'),this.timeoutMs);p.timer.unref?.();this.pending.set(id,p);
      abort=()=>this.reject(id,'外发请求已取消 / Transfer cancelled');signal?.addEventListener('abort',abort,{once:true});this.notify();
    }).finally(()=>signal?.removeEventListener('abort',abort));
    assertCurrent();
    const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));headers.delete('content-length');
    return {...init,body:text,headers};
  }
  get(id){const p=this.pending.get(id);if(!p||Date.now()>=p.expiresAt)throw error('外发请求已结束 / Disclosure request expired');p.assertCurrent();return p;}
  preview({id,selected=[],manual=[],omitPaths=[],keepBinary=[],fields=[]}){
    const p=this.get(id);
    if(!Array.isArray(fields)||fields.length>32||fields.some(f=>typeof f!=='string'||!f.trim()||f.length>80))throw error('字段名无效 / Invalid field name');
    if(!Array.isArray(manual))throw error('手动隐藏项无效 / Invalid custom value');
    p.fields=fields;if(fields.length){const found=disclosureCandidates(p.body,fields);p.candidates=[...p.candidates,...found.filter(c=>!p.candidates.some(old=>old.id===c.id))];}
    if(!Array.isArray(selected)||selected.some(id=>!p.candidates.some(c=>c.id===id)))throw error('隐藏项已变化，请重新核对 / Hidden choices changed');
    const values=[...p.candidates.filter(c=>selected.includes(c.id)).map(c=>c.value),...manual];
    const result=minimizeBody(p.body,{values,omitPaths,keepBinary});
    p.preview={...result,token:randomUUID(),values,choices:{selected,manual,omitPaths,keepBinary,fields}};
    return {text:result.text,sections:textViews(result.body),token:p.preview.token,hiddenCount:result.hiddenCount,omittedCount:result.omittedCount,removedBinary:result.removedBinary,candidates:p.candidates};
  }
  async approve(id,token){
    const p=this.get(id);if(!p.preview||p.preview.token!==token)throw error('请核对最新预览后再发送 / Review the latest preview');
    this.pending.delete(id);clearTimeout(p.timer);this.notify();
    try{
      p.assertCurrent();await this.record(p.taskId,{kind:'disclosure',outcome:'approved',target:p.target,requestDigest:digest(p.preview.text),hiddenCount:p.preview.hiddenCount,omittedCount:p.preview.omittedCount,removedBinary:p.preview.removedBinary});
      p.assertCurrent();this.hidden.set(p.taskId,[...new Set([...(this.hidden.get(p.taskId)||[]),...p.preview.values])].slice(-500));this.fields.set(p.taskId,p.fields);this.prune();p.resolve(p.preview.text);
    }catch(e){p.reject(e);throw e;}
  }
}
