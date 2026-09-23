import path from 'node:path';
import {lstat} from 'node:fs/promises';

// Tool access, rather than a prompt, protects task-level completion records.
export async function checkToolBoundary(root,event) {
  if(!['read','write','edit','ls'].includes(event.toolName))return {block:true,reason:'此制作阶段仅允许本地文件工具'};
  const file=event.input?.path??'.';
  const target=path.resolve(root,file),relative=path.relative(root,target);
  if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative))return {block:true,reason:'文件访问超出当前产物目录'};
  let current=root;
  for(const part of relative.split(path.sep).filter(Boolean)) {
    current=path.join(current,part);
    try {if((await lstat(current)).isSymbolicLink())return {block:true,reason:'不能通过符号链接访问其他目录'};}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  if(['write','edit'].includes(event.toolName)&&['artifact.json','.nodus-preview.html','results.json','reproduce.py','inputs'].includes(relative.split(path.sep)[0]))return {block:true,reason:'此文件由应用维护，模型不能修改'};
}
