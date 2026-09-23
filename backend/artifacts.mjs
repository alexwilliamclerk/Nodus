import { readFile, writeFile, readdir, lstat, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import PptxGenJS from 'pptxgenjs';
import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';
import JSZip from 'jszip';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { parse } from 'csv-parse/sync';
import { parse as parseHtml } from 'parse5';
import { typeInfo, artifactRequirements } from '../frontend/artifact-types.js';
const exec=promisify(execFile);
const esc=x=>String(x).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const text=(dir,file)=>readFile(safePath(dir,file),'utf8');
export function safePath(dir,file) {
  if(typeof file!=='string'||!file||file.includes('\\')||path.isAbsolute(file)) throw new Error('无效产物路径');
  const resolved=path.resolve(dir,file);
  if(!resolved.startsWith(path.resolve(dir)+path.sep)) throw new Error('产物路径越界');
  return resolved;
}
export async function fileList(dir,prefix='') {
  const result=[];
  for(const entry of await readdir(prefix?safePath(dir,prefix):dir,{withFileTypes:true})) {
    const name=prefix?`${prefix}/${entry.name}`:entry.name;
    if(entry.isSymbolicLink()) throw new Error('产物不能包含符号链接');
    if(entry.isDirectory()) result.push(...await fileList(dir,name)); else if(entry.isFile()) result.push(name);
  }
  return result.sort();
}
function requireSections(value,sections) {
  if(!/^#\s+\S/m.test(value)) throw new Error('文档缺少一级标题');
  for(const section of sections) if(!new RegExp(`^##\\s+${section}\\s*$`,'m').test(value)) throw new Error(`文档缺少章节：${section}`);
}
export function dataInputs(task) {
  const items=(task.attachments||[]).filter(a=>a.status==='read'&&/\.(csv|json)$/i.test(a.name));
  if(!items.length) throw new Error('需要数据材料：请添加 CSV 或 JSON 记录数组后重新提交；尚未进行分析。');
  return items.map((item,i)=>{
    const rows=/\.csv$/i.test(item.name)?parse(item.text,{columns:true,skip_empty_lines:true,bom:true}):JSON.parse(item.text);
    if(!Array.isArray(rows)||!rows.length||rows.some(r=>!r||typeof r!=='object'||Array.isArray(r))) throw new Error(`${item.name} 必须包含非空的表格记录`);
    const columns=[...new Set(rows.flatMap(r=>Object.keys(r)))];
    const numeric={};
    for(const key of columns) {
      const values=rows.map(r=>r[key]).filter(v=>v!==null&&v!==undefined&&v!=='');
      if(values.length&&values.every(v=>(typeof v==='number'||(typeof v==='string'&&v.trim()!==''&&/^[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(v.trim())))&&Number.isFinite(Number(v)))) {
        const numbers=values.map(Number);
        numeric[key]={count:numbers.length,min:Math.min(...numbers),max:Math.max(...numbers),mean:numbers.reduce((a,b)=>a+b,0)/numbers.length};
      }
    }
    return {file:`inputs/${i+1}${path.extname(item.name).toLowerCase()}`,name:item.name,text:item.text,sha256:createHash('sha256').update(item.text).digest('hex'),rows:rows.length,columns,numeric};
  });
}
export async function prepareAnalysis(task,dir) {
  const inputs=dataInputs(task); await mkdir(path.join(dir,'inputs'),{recursive:true});
  // Only replace application-owned input copies in the unfinished version.
  for(const file of await fileList(dir,'inputs'))await unlink(safePath(dir,file));
  for(const item of inputs) await writeFile(safePath(dir,item.file),item.text);
  const results={method:'Nodus descriptive statistics v1',execution:'应用内固定统计器；不执行模型代码',inputs:inputs.map(({text,...item})=>item)};
  await writeFile(path.join(dir,'results.json'),JSON.stringify(results,null,2));
  await writeFile(path.join(dir,'reproduce.py'),await readFile(new URL('./analysis-reproduce.py.txt',import.meta.url)));
  return results;
}
async function checkPython(dir,files) {
  const sources=files.filter(f=>f.endsWith('.py')); if(!sources.length) throw new Error('Python 产物缺少 .py 源文件');
  // Only this fixed AST parser runs. Generated modules are never imported or executed.
  const program='import ast,json,sys\ncount=0\nfor p in sys.argv[1:]:\n with open(p,encoding="utf-8-sig") as f: count+=len(ast.parse(f.read(),filename=p).body)\nif count==0: raise ValueError("No Python statements")\nprint(json.dumps({"syntax":"passed","python":sys.version.split()[0]}))';
  const candidates=process.platform==='win32'?['python','py','python3']:['python3','python'];
  for(const command of candidates) {
    try { const {stdout}=await exec(command,[...(command==='py'?['-3']:[]),'-I','-c',program,...sources.map(f=>safePath(dir,f))],{timeout:15000,maxBuffer:256*1024}); return {...JSON.parse(stdout),runtime:'未运行生成代码',dependencies:'未安装、未验证'}; }
    catch(error) { if(error.code==='ENOENT') continue; throw new Error(`Python 语法检查失败：${error.stderr||error.message}`); }
  }
  throw new Error('未找到 Python 3，无法进行语法检查；请安装 Python 3 并加入 PATH 后重试。文件保留在未完成目录。');
}
async function checkWebsite(dir,files) {
  const html=await text(dir,'index.html');
  if(!/<html[\s>]/i.test(html)||!/<body[\s>]/i.test(html)) throw new Error('index.html 不是完整 HTML 页面');
  const check=async(file,ref,navigation=false)=>{
    if(!ref||/^(#|data:|mailto:|tel:)/i.test(ref))return;
    if(/^(https?:|\/\/)/i.test(ref)) { if(navigation)return; throw new Error(`资源必须本地可用：${ref}`); }
    const pathname=decodeURIComponent(ref.split(/[?#]/)[0]);
    if(!pathname)return;
    if(pathname.startsWith('/'))throw new Error(`本地资源请使用相对路径：${ref}`);
    const name=path.posix.normalize(path.posix.join(path.posix.dirname(file),pathname));
    const resolved=safePath(dir,name);
    if(!(await lstat(resolved)).isFile()) throw new Error(`资源不是文件：${name}`);
  };
  const cssRefs=source=>[...source.matchAll(/url\(\s*["']?([^\s"')]+)["']?\s*\)|@import\s+["']([^"']+)/gi)].map(m=>m[1]||m[2]);
  const moduleRefs=source=>[...source.matchAll(/(?:from\s*|import\s*\(?)["'](\.[^"']+)["']/g)].map(m=>m[1]);
  for(const file of files.filter(f=>/\.(html|css|js)$/i.test(f)&&f!=='.nodus-preview.html')) {
    const source=await text(dir,file);let refs=[],links=[];
    if(file.endsWith('.css'))refs=cssRefs(source);
    else if(file.endsWith('.js'))refs=moduleRefs(source);
    else {
      const walk=node=>{
        const attrs=Object.fromEntries((node.attrs||[]).map(a=>[a.name,a.value]));
        for(const key of ['src','poster','data'])if(attrs[key])refs.push(attrs[key]);
        if(node.tagName==='link'&&attrs.href)refs.push(attrs.href);
        if(node.tagName==='a'&&attrs.href)links.push(attrs.href);
        if(node.tagName==='script'&&attrs.type==='module')refs.push(...moduleRefs((node.childNodes||[]).map(n=>n.value||'').join('')));
        if(attrs.srcset&&!attrs.srcset.startsWith('data:'))refs.push(...attrs.srcset.split(',').map(v=>v.trim().split(/\s+/)[0]));
        if(attrs.style)refs.push(...cssRefs(attrs.style));
        if(node.tagName==='style')refs.push(...cssRefs((node.childNodes||[]).map(n=>n.value||'').join('')));
        for(const child of node.childNodes||[])walk(child);
      };walk(parseHtml(source));
    }
    for(const ref of refs) await check(file,ref);
    for(const ref of links) await check(file,ref,true);
  }
  return {html:'passed',localResources:'passed',runtime:'未执行交互测试'};
}
async function compileSlides(dir) {
  const deck=JSON.parse(await text(dir,'slides.json'));
  if(!deck.title||!Array.isArray(deck.slides)||!deck.slides.length||deck.slides.length>80) throw new Error('slides.json 必须有标题及 1–80 张幻灯片');
  const pptx=new PptxGenJS();pptx.layout='LAYOUT_WIDE';pptx.title=String(deck.title);pptx.author='Nodus';
  for(const item of deck.slides) {
    if(typeof item.title!=='string'||!item.title.trim()||item.title.length>100||!Array.isArray(item.bullets)||!item.bullets.length||item.bullets.length>8||item.bullets.some(b=>typeof b!=='string'||!b.trim()||b.length>160)) throw new Error('幻灯片标题或要点无效/过长');
    const slide=pptx.addSlide();slide.background={color:'FFFCFA'};
    slide.addText(item.title,{x:.6,y:.4,w:12.1,h:.8,fontSize:28,color:'332A25',breakLine:false});
    slide.addText(item.bullets.map(b=>({text:b,options:{bullet:true,breakLine:true}})),{x:.8,y:1.55,w:11.7,h:5.4,fontSize:20,color:'443C36',paraSpaceAfter:14,fit:'shrink'});
    if(item.notes) slide.addNotes(String(item.notes));
  }
  await pptx.writeFile({fileName:path.join(dir,'presentation.pptx')});
  return deck;
}
export async function validatePptx(dir,expectedDeck) {
  const zip=await JSZip.loadAsync(await readFile(path.join(dir,'presentation.pptx')));
  const parser=new XMLParser({ignoreAttributes:false,parseTagValue:false});
  for(const name of ['[Content_Types].xml','ppt/presentation.xml','ppt/_rels/presentation.xml.rels']) {
    const file=zip.file(name);if(!file) throw new Error(`PPTX 缺少 ${name}`);
    const xml=await file.async('string');if(XMLValidator.validate(xml)!==true) throw new Error('无效 PPTX XML');parser.parse(xml);
  }
  const slides=Object.keys(zip.files).filter(f=>/^ppt\/slides\/slide\d+\.xml$/.test(f)).sort((a,b)=>Number(a.match(/slide(\d+)\.xml/)[1])-Number(b.match(/slide(\d+)\.xml/)[1]));
  if(!slides.length) throw new Error('PPTX 没有实际幻灯片');
  const asArray=value=>value==null?[]:Array.isArray(value)?value:[value];
  const presentation=parser.parse(await zip.file('ppt/presentation.xml').async('string'));
  const relations=asArray(parser.parse(await zip.file('ppt/_rels/presentation.xml.rels').async('string')).Relationships?.Relationship);
  const ids=asArray(presentation['p:presentation']?.['p:sldIdLst']?.['p:sldId']);
  const ordered=ids.map(id=>{
    const relation=relations.find(r=>r['@_Id']===id['@_r:id']);
    if(!relation||!relation['@_Type']?.endsWith('/slide')||relation['@_TargetMode']==='External')throw new Error('PPTX 幻灯片关系无效');
    const target=relation['@_Target'];
    return path.posix.normalize(target.startsWith('/')?target.slice(1):path.posix.join('ppt',target));
  });
  if(!ordered.length||new Set(ordered).size!==ordered.length||ordered.length!==slides.length||ordered.some(name=>!slides.includes(name)))throw new Error('PPTX 幻灯片未被文稿正确引用');
  slides.splice(0,slides.length,...ordered);
  for(const [index,name] of slides.entries()) {
    const xml=await zip.file(name).async('string');
    if(XMLValidator.validate(xml)!==true||!parser.parse(xml)['p:sld']||!/<a:t>[^<]+<\/a:t>/.test(xml)) throw new Error('PPTX 幻灯片无内容或不可解析');
    if(expectedDeck) {
      const texts=[];
      const collect=value=>{if(!value||typeof value!=='object')return;for(const [key,child] of Object.entries(value)){if(key==='a:t')texts.push(String(child));else if(Array.isArray(child))child.forEach(collect);else collect(child);}};
      collect(parser.parse(xml));
      const expected=expectedDeck.slides[index];
      if(!expected||JSON.stringify(texts)!==JSON.stringify([expected.title,...expected.bullets]))throw new Error('PPTX 与幻灯片预览内容不一致');
    }
  }
  return {pptx:'parsed',slides:slides.length,parser:'JSZip + fast-xml-parser',office:'未通过 PowerPoint/Keynote 实机打开验证'};
}
function markdown(value) {
  return sanitizeHtml(marked.parse(value),{allowedTags:sanitizeHtml.defaults.allowedTags,allowedAttributes:{a:['href','title']},allowedSchemes:['http','https','mailto']});
}

async function preview(dir,type,files,verification,deck) {
  const info=typeInfo(type);let body='';
  if(type==='presentation') body=deck.slides.map((s,i)=>`<section class="slide"><small>${i+1} / ${deck.slides.length}</small><h2>${esc(s.title)}</h2><ul>${s.bullets.map(b=>`<li>${esc(b)}</li>`).join('')}</ul><details><summary>演讲备注</summary>${esc(s.notes||'无')}</details></section>`).join('');
  else body=markdown(await text(dir,info.entry));
  const links=files.filter(f=>!['artifact.json','.nodus-preview.html'].includes(f)).map(f=>`<li><a download href="${f.split('/').map(encodeURIComponent).join('/')}">${esc(f)}</a>${/\.(py|txt|json|md)$/.test(f)?`<details><summary>查看源码 / 内容</summary><pre>${esc('')}</pre></details>`:''}</li>`);
  // Source views are static escaped text, never evaluated in the renderer.
  for(let i=0;i<links.length;i++) if(links[i].includes('<pre>')) { const f=files.filter(f=>!['artifact.json','.nodus-preview.html'].includes(f))[i];links[i]=links[i].replace('<pre></pre>',`<pre>${esc(await text(dir,f))}</pre>`); }
  await writeFile(path.join(dir,'.nodus-preview.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>${esc(info.label)}</title><style>body{font:15px/1.65 system-ui;background:#fffcfa;color:#332a25;margin:24px;overflow-wrap:anywhere}h1{font-size:24px}h2{font-size:20px}.line{white-space:pre-wrap}pre{white-space:pre-wrap;font-size:12px}.slide{padding:24px;border:1px solid #eaded4;border-radius:14px;margin:18px 0;background:white;min-height:230px}li{margin:10px 0}a{color:#8b593c}details{margin:10px 0}small{color:#78695e}table{border-collapse:collapse;font-size:13px}th,td{border:1px solid #eaded4;padding:6px}blockquote{margin:12px 0;padding:10px;border-left:3px solid #c9a28a;background:#f8f1eb}ul{padding-left:20px}</style><body><p>${esc(info.label)} · <a download href="${info.entry}">下载主文件</a></p>${body}<h2>文件</h2><ul>${links.join('')}</ul><h2>验证范围</h2><pre>${esc(JSON.stringify(verification,null,2))}</pre></body></html>`);
}
// Every registered delivery contract must have an explicit finalizer. Unknown types fail closed.
export const artifactAdapters = Object.freeze({
  website: async (_task,dir,files)=>({checks:await checkWebsite(dir,files)}),
  report: async (_task,dir)=>{
    const report=await text(dir,'report.md');
    const sources=JSON.parse(await text(dir,'sources.json'));
    if(!Array.isArray(sources)||sources.some(s=>!s.claim||!s.source||s.status!=='unverified')) throw new Error('报告来源必须逐项声明 unverified，当前没有联网核实能力');
    if(report.split(/[。；;\n]/).some(sentence=>{
      const index=sentence.search(/已核实|已验证的事实|经联网核实/);
      if(index<0)return false;
      const prefix=sentence.slice(0,index);
      const future=/后[，,]?\s*(?:将|再|才|方可)|→\s*逐条核实\s*→\s*将/.test(prefix);
      return !future&&!/(未|不|非|没有|无)/.test(prefix);
    })) throw new Error('报告不能声称已联网核实');
    return {checks:{structure:'passed',sources:'全部未联网核实',accuracy:'未独立核实事实与引用'}};
  },
  presentation: async (_task,dir,_files,{restore})=>{
    const deck=restore?JSON.parse(await text(dir,'slides.json')):await compileSlides(dir);
    const checks=await validatePptx(dir,deck);
    if(checks.slides!==deck.slides.length) throw new Error('PPTX 与预览页数不一致');
    return {checks,deck};
  },
  python: async (_task,dir,files)=>({checks:await checkPython(dir,files)}),
  analysis: async (_task,dir,files,{restore})=>{
    const checks=await checkPython(dir,files);
    if(await text(dir,'reproduce.py')!==await readFile(new URL('./analysis-reproduce.py.txt',import.meta.url),'utf8')) throw new Error('可信复现代码被修改');
    const results=JSON.parse(await text(dir,'results.json'));
    const inputFiles=await fileList(dir,'inputs');
    const snapshot={attachments:await Promise.all(inputFiles.map(async f=>({name:f,status:'read',text:await text(dir,f)})))};
    const computed=dataInputs(snapshot);
    if(results.method!=='Nodus descriptive statistics v1'||computed.length!==results.inputs?.length)throw new Error('分析输入与结果不匹配');
    for(let i=0;i<computed.length;i++) {
      const a=computed[i], b=results.inputs.find(r=>r.file===inputFiles[i]);
      if(!b||a.sha256!==b.sha256||a.rows!==b.rows||JSON.stringify(a.numeric)!==JSON.stringify(b.numeric)) throw new Error('分析输入与统计结果不匹配');
    }
    // Preserve model commentary separately; only trusted numeric output is presented as a computed result.
    if(!restore) {
      await writeFile(path.join(dir,'analysis-notes.md'),await text(dir,'analysis.md'));
      await writeFile(path.join(dir,'analysis.md'),`# 数据描述统计\n\n## 输入\n${results.inputs.map(i=>`${i.name}：${i.rows} 行；SHA256 ${i.sha256}`).join('\n')}\n\n## 方法\n应用内固定描述统计器。忽略数值列空值；仅当非空值均为数字时统计。\n\n## 结果\n${JSON.stringify(results.inputs.map(({name,rows,numeric})=>({name,rows,numeric})),null,2)}\n\n## 限制\n分析代码仅语法检查，未执行，未验证依赖。模型说明在 analysis-notes.md，未经统计器验证，不作为已计算结论。仅支持描述统计，不代表因果、预测或推断。`);
    }
    return {checks:{...checks,inputResultCorrespondence:'passed',results:'应用内固定描述统计器已运行',generatedCode:'仅语法检查，未运行'}};
  },
});
export async function finalizeArtifact(task,dir,{restore=false}={}) {
  const info=typeInfo(task.artifactType),adapter=artifactAdapters[task.artifactType];
  if(!info||!adapter)throw new Error('未知产物类型或缺少验证器，请先澄清');
  let files=await fileList(dir);
  const requirements=artifactRequirements[task.artifactType];
  if(!requirements)throw new Error('产物类型缺少文件协议');
  for(const [file,sections] of Object.entries(requirements.sections)) requireSections(await text(dir,file),sections);
  const {checks,deck}=await adapter(task,dir,files,{restore});
  files=await fileList(dir);
  for(const file of requirements.files)if(!files.includes(file))throw new Error(`产物缺少必需文件：${file}`);
  const verification={status:'passed',checkedAt:new Date().toISOString(),...checks};
  if(info.preview!=='website') await preview(dir,task.artifactType,files,verification,deck);
  const artifact={schemaVersion:1,type:task.artifactType,entry:info.entry,files:(await fileList(dir)).filter(f=>f!=='artifact.json'),preview:{kind:info.preview,entry:info.preview==='website'?info.entry:'.nodus-preview.html'},verification};
  await writeFile(path.join(dir,'artifact.json'),JSON.stringify(artifact,null,2));return artifact;
}
