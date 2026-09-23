import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileList, safePath } from './artifacts.mjs';

export function completionContract(task) {
  const raw=task.completionContract?.conditions?.length?task.completionContract.conditions:task.requirement?.trim()?[{kind:'manual',text:task.requirement}]:[];
  const conditions=raw.map((item,index)=>{
    if(typeof item.text!=='string'||!item.text.trim())throw new Error('完成条件不能为空');
    if(!['manual','sequence'].includes(item.kind))throw new Error('未知完成条件');
    const condition={id:`condition-${index+1}`,text:item.text.trim(),kind:item.kind};
    if(item.kind==='sequence') {
      const {start,end,file}=item;
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<start||end-start>100000)throw new Error('整数范围无效，最多检查 100001 个整数');
      safePath('/artifact',file);Object.assign(condition,{start,end,file});
    }
    return condition;
  });
  return conditions.length?{schemaVersion:1,requirement:task.requirement,conditions}:null;
}
export async function assessCompletion(dir,contract,versionId) {
  const results=[];
  for(const condition of contract.conditions) {
    let status='needs_review',detail='需要人工判断；文件格式通过不能证明这项要求已满足。';
    if(condition.kind==='sequence') {
      try {
        const values=(await readFile(safePath(dir,condition.file),'utf8')).trim().split(/[\s,，]+/);
        const count=condition.end-condition.start+1;
        const mismatch=values.findIndex((value,index)=>!/^[-+]?\d+$/.test(value)||Number(value)!==condition.start+index);
        status=values.length===count&&mismatch<0?'passed':'failed';
        detail=status==='passed'?`完整检查 ${count} 个整数，顺序及端点正确。`:`需要 ${count} 个连续整数，实际 ${values.length} 项${mismatch>=0?`；第 ${mismatch+1} 项不匹配`:''}。`;
      } catch(error) {status='failed';detail=error.code==='ENOENT'?`未生成 ${condition.file}`:error.message;}
    }
    results.push({...condition,status,detail});
  }
  const hashes={};
  for(const file of await fileList(dir))if(!['artifact.json','.nodus-preview.html'].includes(file))hashes[file]=createHash('sha256').update(await readFile(safePath(dir,file))).digest('hex');
  return {schemaVersion:1,versionId,checkedAt:new Date().toISOString(),status:results.some(r=>r.status==='failed')?'gaps':results.some(r=>r.status==='needs_review')?'needs_review':'passed',contract,results,hashes};
}
export async function saveCompletion(storage,taskId,versionId,evidence) {
  const dir=path.join(storage.taskDir(taskId),'.completion');await mkdir(dir,{recursive:true});
  await writeFile(safePath(dir,`${versionId}.json`),JSON.stringify(evidence,null,2));
}
export async function loadCompletion(storage,taskId,versionId) {
  let evidence;
  try {evidence=JSON.parse(await readFile(safePath(path.join(storage.taskDir(taskId),'.completion'),`${versionId}.json`),'utf8'));}
  catch(error){if(error.code==='ENOENT')return null;throw error;}
  const dir=storage.versionDir(taskId,versionId);
  try {
    const files=(await fileList(dir)).filter(f=>!['artifact.json','.nodus-preview.html'].includes(f));
    if(files.length!==Object.keys(evidence.hashes).length)throw new Error('changed');
    for(const file of files)if(createHash('sha256').update(await readFile(safePath(dir,file))).digest('hex')!==evidence.hashes[file])throw new Error('changed');
  }catch {return {...evidence,status:'stale',results:evidence.results.map(r=>({...r,status:'unverified',detail:'产物变化，原证据已失效，需要重新验证。'})),requirementAudit:evidence.requirementAudit?{...evidence.requirementAudit,status:'needs_review',results:evidence.requirementAudit.results.map(r=>({...r,status:'unverified',reason:'产物变化，原要求审查证据已失效。',evidence:[]}))}:null};}
  return evidence;
}
