import JSZip from 'jszip';
import {readFile,rename,unlink,stat,lstat,realpath} from 'node:fs/promises';
import {createWriteStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileList,safePath} from './artifacts.mjs';

const secretKeys=new Set(['apikey','searchapikey','encryptedkey','authorization','accesstoken','refreshtoken','password']);
export function backupState(value){
  if(Array.isArray(value))return value.map(backupState);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).filter(([key])=>!secretKeys.has(key.toLowerCase())&&!['previewUrl','previewError'].includes(key)).map(([key,item])=>[key,backupState(item)]));
}
export async function exportBackup(storage,destination,{version='unknown'}={}){
  const target=path.resolve(destination),root=await realpath(storage.dataDir);
  const actualTarget=path.join(await realpath(path.dirname(target)),path.basename(target));
  if(actualTarget===root||actualTarget.startsWith(root+path.sep))throw new Error('请选择应用数据目录之外的位置保存备份');
  const state=await storage.loadState();
  if(state.tasks.some(t=>t.operation?.status==='running'))throw new Error('请先停止正在运行的任务，再导出备份');
  const zip=new JSZip(),warnings=[],excluded=[];let files=0;
  zip.file('state.json',JSON.stringify(backupState(state),null,2));
  const watchPath=path.join(storage.dataDir,'advice-watch.json');
  try{if((await lstat(watchPath)).isSymbolicLink())throw new Error('建议追踪文件不能是符号链接');zip.file('advice-watch.json',JSON.stringify(backupState(JSON.parse(await readFile(watchPath,'utf8'))),null,2));}catch(error){if(error.code!=='ENOENT')throw error;}
  const ids=[...new Set(state.tasks.map(t=>t.id))];
  for(const id of ids){
    if(typeof id!=='string'||!id||id==='.'||id==='..'||/[\\/]/.test(id))throw new Error('任务标识无效，无法导出');
    const dir=safePath(storage.artifactRoot,id);let names;
    try{if((await lstat(dir)).isSymbolicLink())throw new Error('作品目录不能是符号链接');names=await fileList(dir);}catch(error){if(error.code==='ENOENT'){if(state.tasks.find(t=>t.id===id)?.versions?.length)warnings.push(`任务 ${id} 的作品目录缺失`);continue;}throw error;}
    for(const name of names){
      if(/(^|\/)(credentials\.json|auth\.json|\.env(?:\..*)?)$/i.test(name)){excluded.push(`artifacts/${id}/${name}`);continue;}
      let bytes=await readFile(safePath(dir,name));
      if(name==='.workspace.json')bytes=Buffer.from(JSON.stringify(backupState(JSON.parse(bytes.toString('utf8'))),null,2));
      zip.file(`artifacts/${id}/${name}`,bytes);files++;
    }
    for(const v of state.tasks.find(t=>t.id===id)?.versions||[])if(!names.some(n=>n.startsWith(`${v.id}/`)))warnings.push(`任务 ${id} 的版本 ${v.id} 文件缺失`);
  }
  const manifest={format:'nodus-backup',schemaVersion:1,appVersion:version,createdAt:new Date().toISOString(),tasks:state.tasks.length,artifactFiles:files,includes:['对话与草稿','选项与决策路径','评分与版本','任务附件','未完成文件与检查证据','已采纳建议与追踪记录'],excludes:['模型凭据','Pi 认证配置','应用缓存'],excludedFiles:excluded,warnings};
  zip.file('backup.json',JSON.stringify(manifest,null,2));
  zip.file('恢复说明.txt','Nodus 对话备份\n\n此包含私人对话、附件和作品，不适合公开分享。已排除应用保存的模型凭据；用户自行粘贴在对话或作品中的敏感文本不会被自动识别或删除。\n\n恢复：先退出 Nodus，将目标数据目录另行备份；解压到新目录，使用 NODUS_DATA_DIR 指向其中包含 state.json 的目录后启动，或在备份原数据后将 state.json、advice-watch.json（如有）与 artifacts 复制到应用数据目录。不要合并覆盖正在使用的目录。模型连接需重新添加。预览地址启动后重新生成。\n\nbackup.json 中 warnings 非空时，源数据已有缺失，不能将本包视为完整作品备份。本版本尚无应用内导入功能。\n');
  const temporary=path.join(path.dirname(target),`.nodus-backup-${randomUUID()}.tmp`);
  try{
    await pipeline(zip.generateNodeStream({type:'nodebuffer',streamFiles:true,compression:'DEFLATE',compressionOptions:{level:3}}),createWriteStream(temporary,{flags:'wx',mode:0o600}));
    await rename(temporary,target);
  }catch(error){await unlink(temporary).catch(()=>{});throw error;}
  return {canceled:false,filePath:target,tasks:state.tasks.length,artifactFiles:files,warnings,bytes:(await stat(target)).size};
}
