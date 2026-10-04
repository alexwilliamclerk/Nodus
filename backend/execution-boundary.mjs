import path from 'node:path';
import {lstat} from 'node:fs/promises';
import {sourceDescription} from './safety-service.mjs';
// Match the pinned SDK's path semantics (including @, ~, file URLs and read
// fallbacks). Checking a different spelling than the tool uses is unsafe.
const sdkPathUtils=import(new URL('./core/tools/path-utils.js',import.meta.resolve('@earendil-works/pi-coding-agent')));

// Tool access, rather than a prompt, protects task-level completion records.
export async function checkToolBoundary(root,event,{safety=null,taskId=null,onReadAuthorized}={}) {
  let result;
  try{result=await inspectToolBoundary(root,event,{safety,taskId,onReadAuthorized});}
  catch(error){result={block:true,reason:error.message};}
  if(result?.block&&!result.recorded&&safety&&taskId){
    try{const action={kind:['write','edit'].includes(event.toolName)?'write':'read',target:String(event.input?.path||event.toolName),payload:event.input};await safety.record(taskId,{kind:action.kind,target:action.target,outcome:'blocked',reason:result.reason,explanation:safety.evidence.explain(taskId,action,safety.snapshot(taskId).sources)});}catch{}
  }
  if(result){const {recorded,...decision}=result;return decision;}
}

async function inspectToolBoundary(root,event,{safety,taskId,onReadAuthorized}) {
  if(!['read','write','edit','ls'].includes(event.toolName))return {block:true,reason:'此制作阶段仅允许本地文件工具'};
  const file=event.input?.path??'.';
  if(typeof file!=='string'||file.includes('\0')||(process.platform!=='win32'&&file.includes('\\')))return {block:true,reason:'无效文件路径 / Invalid path'};
  const {resolveToCwd,resolveReadPathAsync}=await sdkPathUtils;
  const target=event.toolName==='read'?await resolveReadPathAsync(file,root):resolveToCwd(file,root),relative=path.relative(root,target);
  if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))return {block:true,reason:'文件访问超出当前产物目录'};
  let current=root;
  for(const part of relative.split(path.sep).filter(Boolean)) {
    current=path.join(current,part);
    try {const stat=await lstat(current);if(stat.isSymbolicLink()||(stat.isFile()&&stat.nlink>1))return {block:true,reason:'不能通过文件链接访问其他目录 / File links are not allowed'};}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  if(relative.split(path.sep).some(part=>/^(?:\.env(?:\..*)?|\.git|credentials\.json|auth\.json)$/i.test(part)))return {block:true,reason:'凭据与 Git 内部文件不向模型开放 / Credential and Git files are protected'};
  if(['write','edit'].includes(event.toolName)&&['artifact.json','.nodus-preview.html','results.json','reproduce.py','inputs'].includes(relative.split(path.sep)[0].toLowerCase()))return {block:true,reason:'此文件由应用维护，模型不能修改'};
  if(safety&&taskId){
    let grant;
    try{grant=await safety.authorize(taskId,{kind:['write','edit'].includes(event.toolName)?'write':'read',target:relative.split(path.sep).join('/')||'.',proposedTarget:file,payload:event.input,detail:'当前任务工作副本 / Current task working copy'});}
    catch(error){return {block:true,reason:error.message,recorded:true,recoverableRead:event.toolName==='read'&&error.recoverableRead===true};}
    if(event.toolName==='read'){
      try{const stat=await lstat(target);await safety.registerSources(taskId,[sourceDescription('workspace',relative,{size:stat.size,modified:stat.mtimeMs},'任务工作副本 / Task working copy')]);}
      catch(error){return {block:true,reason:error.message};}
    }
    grant.assertCurrent({payload:event.input});
    if(event.toolName==='read')onReadAuthorized?.(relative.split(path.sep).join('/'));
  }
}
