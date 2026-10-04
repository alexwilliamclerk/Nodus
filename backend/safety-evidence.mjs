// Observations of source text and operations, never model explanations or authority.
// Full source text stays in bounded process memory. Only short matched excerpts
// enter the local permission history. No extra model call is needed.
import {fileURLToPath} from 'node:url';
export const sourceText = Symbol('sourceText');
const MAX_TEXT = 64000, MAX_TOTAL = 1000000;
export const displayText = (value, limit = 240) => String(value ?? '')
  .replace(/[\u0000-\u001f]/g, ' ')
  .replace(/[\u202a-\u202e\u2066-\u2069]/g, c => `[U+${c.codePointAt(0).toString(16).toUpperCase()}]`)
  .replace(/\b(?:sk-|sk_|ghp_|github_pat_)[a-zA-Z0-9_-]{12,}/g, '[redacted]')
  .replace(/((?:api[_ -]?key|token|password|secret|authorization)\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
  .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/g, '$1[parameters hidden]')
  .slice(0, limit);

function strings(value, out = [], depth = 0) {
  if (depth > 12 || out.length > 5000) return out;
  if (typeof value === 'string') out.push(value);
  else if (Array.isArray(value)) for (const item of value) strings(item, out, depth + 1);
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    if (!/^(?:image|data|apiKey|headers|systemPrompt)$/i.test(key)) strings(item, out, depth + 1);
  }
  return out;
}

function tokens(text) {
  // Match complete paths/URLs, not loose substrings such as "private" in prose.
  return [...text.matchAll(/(?:https?:\/\/|file:\/\/|@?\.?\.?\/)?[^\s<>"'`()[\]{},;，；。]+/g)]
    .filter(m => m[0].includes('/') || /^[\w.-]+\.[a-zA-Z0-9]{1,10}$/.test(m[0]));
}
function normalized(value) {
  let v = value.replace(/^@/, '');
  if (/^file:/i.test(v)) {try {v=fileURLToPath(v);} catch {return v;}}
  if (/^https?:/i.test(v)) {try {return new URL(v).href;} catch {return v;}}
  const parts = [];
  for (const part of v.split('/')) {if (part === '..') {if (parts.length && parts.at(-1) !== '..') parts.pop(); else parts.push(part);} else if (part && part !== '.') parts.push(part);}
  return (v.startsWith('/') ? '/' : '') + parts.join('/');
}
function targetMatch(token, action) {
  const a = normalized(token), b = normalized(action.proposedTarget || action.target || '');
  if (!a || !b) return false;
  if (a === b || a === normalized(action.target || '')) return true;
  if (['model','search','web'].includes(action.kind)) {
    try {return new URL(a).origin === new URL(action.target).origin;} catch {}
  }
  return false;
}
function fragment(text, index, length) {
  const start = Math.max(text.lastIndexOf('\n', index) + 1, index - 90);
  const end = Math.min(text.indexOf('\n', index + length) < 0 ? text.length : text.indexOf('\n', index + length), index + length + 130);
  return {line: text.slice(0, index).split('\n').length, excerpt: displayText(text.slice(start, end), 260)};
}
function occurrence(text, payload) {
  // Require a substantial verbatim segment. This is evidence of overlap, not
  // an inference about the model's hidden reasoning or semantic influence.
  for (const line of text.split('\n')) {
    const sample = line.trim().slice(0, 120);
    if (sample.length >= 24 && payload.some(value => value.includes(sample))) return {index:text.indexOf(sample),length:sample.length};
  }
  return null;
}

function visibleSpans(text, values) {
  if(text.length>=8&&values.some(v=>v.includes(text)))return [{start:0,end:text.length}];
  const spans=[];
  // A prompt may contain only the beginning of a long file. Track the exact
  // matching region; never attribute an unseen tail from the registered copy.
  for(let start=0;start<text.length&&spans.length<64;start+=120){
    const sample=text.slice(start,start+120);if(sample.length<24)continue;
    for(const value of values){
      const at=value.indexOf(sample);if(at<0)continue;
      let left=0,right=sample.length;
      while(start-left>0&&at-left>0&&text[start-left-1]===value[at-left-1])left++;
      while(start+right<text.length&&at+right<value.length&&text[start+right]===value[at+right])right++;
      spans.push({start:start-left,end:start+right});start+=right-120;break;
    }
  }
  return spans;
}
function mergeSpans(spans){
  const out=[];
  for(const span of [...spans].sort((a,b)=>a.start-b.start)){
    const last=out.at(-1);if(last&&span.start<=last.end)last.end=Math.max(last.end,span.end);else out.push({...span});
  }
  return out.slice(0,64);
}

export class SafetyEvidence {
  constructor(){this.catalog = new Map();this.runs = new Map();}
  register(taskId, sources) {
    let catalog = this.catalog.get(taskId);
    if (!catalog) {catalog = new Map();this.catalog.set(taskId,catalog);}
    for (const source of sources) if (typeof source[sourceText] === 'string' && source[sourceText]) {
      catalog.delete(source.id);
      catalog.set(source.id, {text:source[sourceText].slice(0,MAX_TEXT),truncated:source[sourceText].length>MAX_TEXT});
    }
    let size = [...catalog.values()].reduce((n,v)=>n+v.text.length,0);
    for (const [id,value] of catalog) {if (size<=MAX_TOTAL)break;catalog.delete(id);size-=value.text.length;}
    // Avoid retaining every task ever opened for the life of the desktop app.
    while (this.catalog.size > 12) this.catalog.delete(this.catalog.keys().next().value);
  }
  begin(taskId, intent='') {this.runs.set(taskId,{intent:displayText(intent,320),seen:new Map()});}
  end(taskId) {this.runs.delete(taskId);this.catalog.delete(taskId);}
  clear() {this.runs.clear();this.catalog.clear();}
  included(taskId, payload) {
    const values=strings(payload),ids=new Map();
    for(const [id,{text}] of this.catalog.get(taskId)||[]) {
      const spans=visibleSpans(text,values);if(spans.length)ids.set(id,spans);
    }
    return ids;
  }
  observe(taskId, context) {
    const run=this.runs.get(taskId);if(!run)return;
    // System prompts and tool schemas are not evidence that a material was read.
    const messages=Array.isArray(context.messages)?context.messages.filter(m=>m.role==='user'||m.role==='toolResult'):context;
    for(const [id,spans] of this.included(taskId,messages))run.seen.set(id,mergeSpans([...(run.seen.get(id)||[]),...spans]));
  }
  explain(taskId, action, sources) {
    const run=this.runs.get(taskId),catalog=this.catalog.get(taskId)||new Map();
    const payload=strings(action.payload),included=action.kind==='model'?this.included(taskId,action.payload):new Map();
    const links=[];let unavailable=0;
    for(const source of sources) {
      const entry=catalog.get(source.id),seen=run?.seen.get(source.id),inRequest=included.get(source.id);
      if(!entry || (!seen&&!inRequest)) {unavailable++;continue;}
      let match=null;
      for(const span of seen||[]){
        const visible=entry.text.slice(span.start,span.end),quote=(index,length)=>({...fragment(visible,index,length),line:entry.text.slice(0,span.start+index).split('\n').length});
        for(const token of tokens(visible))if(targetMatch(token[0],action)){match={relation:'target',targetType:['model','search','web'].includes(action.kind)?'recipient':'file',...quote(token.index,token[0].length),matched:displayText(token[0]),normalized:normalized(token[0])!==token[0]};break;}
        if(!match&&action.kind!=='model') {
          const overlap=occurrence(visible,payload);
          if(overlap)match={relation:'content',...quote(overlap.index,overlap.length)};
        }
        if(match)break;
      }
      // A workspace aggregate may contain bytes from a separately classified
      // source. Do not save excerpts from any part of such a task.
      const privateText=sources.some(s=>s.classification!=='normal');
      links.push({sourceId:source.id,name:displayText(source.name),kind:source.kind,origin:displayText(source.origin),
        classification:source.classification,exposure:seen?'earlier-context':'this-request',
        ...(match||{relation:'context'}),...(privateText?{excerpt:null,matched:null}:{}),
        excerptHidden:privateText,truncated:entry.truncated||(seen||inRequest).reduce((n,s)=>n+s.end-s.start,0)<entry.text.length});
    }
    links.sort((a,b)=>(a.relation==='context')-(b.relation==='context'));
    const represented=new Set(links.map(link=>link.kind+'|'+link.name));
    unavailable=sources.filter(source=>!links.some(link=>link.sourceId===source.id)&&!represented.has(source.kind+'|'+displayText(source.name))).length;
    return {version:1,intent:run?.intent||'',links:links.slice(0,6),omitted:Math.max(0,links.length-6),unavailable,
      proposedTarget:displayText(action.proposedTarget||action.target),
      limitation:'Observed references and text overlap do not establish causation. Missing matches do not establish safety.'};
  }
}
