import {mkdir,mkdtemp,copyFile,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {readArtifact} from './artifact-service.mjs';
import {fileList,safePath} from './artifacts.mjs';

export async function validateDeliveryDirectory(storage,directory){
  const root=await realpath(directory),internal=await realpath(storage.dataDir);
  if(!(await lstat(root)).isDirectory())throw new Error('请选择文件夹');
  const relative=path.relative(internal,root);
  if(!relative||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative)))throw new Error('交付目录不能位于应用数据目录内，请选择其他文件夹');
  return root;
}
export async function exportVersion(storage,{taskId,versionId,directory}){
  if(!/^[a-zA-Z0-9_-]+$/.test(taskId)||!/^v\d+$/.test(versionId))throw new Error('无效任务或版本');
  const source=storage.versionDir(taskId,versionId);
  const artifact=await readArtifact(source);
  const files=(await fileList(source)).filter(file=>!['artifact.json','.nodus-preview.html'].includes(file));
  const root=await validateDeliveryDirectory(storage,directory);
  // Unique folder per export, no merge into user files or previous exports.
  const destination=await mkdtemp(path.join(root,`Nodus-${taskId}-${versionId}-`));
  try{
    for(const file of files){const target=safePath(destination,file);await mkdir(path.dirname(target),{recursive:true});await copyFile(safePath(source,file),target);}
  }catch(error){throw new Error(`导出未完成，部分副本位于 ${destination}；应用内原作品保留。${error.message}`);}
  return {directory:destination,entry:path.join(destination,artifact.entry),files,type:artifact.type};
}
