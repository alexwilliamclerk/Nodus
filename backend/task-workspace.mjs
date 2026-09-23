import {readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileList,safePath} from './artifacts.mjs';
export async function saveWorkspace(storage,task,versionId,workDir,baseVersionId,proposal=null){
  const pendingId=path.basename(workDir);
  await writeFile(path.join(storage.taskDir(task.id),'.workspace.json'),JSON.stringify({pendingId,versionId,baseVersionId:baseVersionId||null,task,proposal,createdAt:new Date().toISOString()}));
}
export async function pendingWorkspace(storage,taskId){
  let saved;
  try{saved=JSON.parse(await readFile(path.join(storage.taskDir(taskId),'.workspace.json'),'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
  if(typeof saved.pendingId!=='string'||!/^\.pending-[a-zA-Z0-9-]+$/.test(saved.pendingId))throw new Error('未完成工作目录无效');
  const dir=safePath(storage.taskDir(taskId),saved.pendingId);
  try{
    if(!(await lstat(dir)).isDirectory()||await realpath(dir)!==path.join(await realpath(storage.taskDir(taskId)),saved.pendingId))throw new Error('未完成目录必须属于当前任务');
  }catch(error){if(error.code==='ENOENT')return null;throw error;}
  return {...saved,dir};
}
export async function pendingContext(storage,task){
  const saved=await pendingWorkspace(storage,task.id);if(!saved)return task;
  const files=await fileList(saved.dir);let remaining=48000;const texts=[];
  for(const file of files.filter(f=>/\.(md|txt|py|json|html|css|js)$/.test(f)&&!['artifact.json','.nodus-preview.html'].includes(f))){if(remaining<=0)break;const value=(await readFile(safePath(saved.dir,file),'utf8')).slice(0,remaining);texts.push(`${file}\n${value}`);remaining-=value.length;}
  return {...task,artifactType:saved.task.artifactType,versionContext:`未完成目录 ${saved.pendingId}，不代表可用版本。\n文件：${files.join('、')}\n${texts.join('\n\n')}`};
}
