import {readFile} from 'node:fs/promises';
import {activeRequirements} from '../frontend/requirements.js';
import {safePath} from './artifacts.mjs';

export async function artifactTextSnapshot(dir,artifact,limit=64000){
  const names=[...new Set([artifact.entry,...artifact.files])].filter(file=>/\.(?:html|css|js|mjs|md|txt|json|py|xml|yaml|yml)$/i.test(file)&&!['artifact.json','.nodus-preview.html'].includes(file));
  const files=[];let remaining=limit;
  for(const file of names){
    if(remaining<=0)break;
    const source=await readFile(safePath(dir,file),'utf8');const content=source.slice(0,remaining);
    files.push({file,content,truncated:content.length<source.length});remaining-=content.length;
  }
  return {files,truncated:remaining<=0||files.some(file=>file.truncated)};
}

export function validateRequirementAudit(value,ledger,snapshot){
  if(!value||!Array.isArray(value.results))throw new Error('要求审查结果格式无效');
  const active=activeRequirements(ledger),known=new Map(snapshot.files.map(file=>[file.file,file.content])),seen=new Set(),results=[];
  for(const requirement of active){
    const raw=value.results.find(result=>result?.id===requirement.id);
    if(!raw||seen.has(raw.id)){results.push({...requirement,status:'unverified',reason:'审查模型没有返回唯一结果。',evidence:[]});continue;}
    seen.add(raw.id);
    let status=['supported','conflict','unverified'].includes(raw.status)?raw.status:'unverified';
    const evidence=(Array.isArray(raw.evidence)?raw.evidence:[]).slice(0,3).filter(entry=>typeof entry?.file==='string'&&typeof entry?.quote==='string'&&entry.quote.length>0&&entry.quote.length<=500&&known.get(entry.file)?.includes(entry.quote));
    if(status!=='unverified'&&!evidence.length)status='unverified';
    results.push({...requirement,status,reason:typeof raw.reason==='string'&&raw.reason.trim()?raw.reason.trim():'没有提供判断理由。',evidence});
  }
  return {schemaVersion:1,reviewer:'model-assisted-grounded-review',checkedAt:new Date().toISOString(),status:results.some(result=>result.status==='conflict')?'conflict':results.some(result=>result.status==='unverified')?'needs_review':'supported',results,scope:{files:snapshot.files.map(file=>file.file),truncated:snapshot.truncated}};
}

export function unavailableRequirementAudit(ledger,snapshot,error){
  return {schemaVersion:1,reviewer:'model-assisted-grounded-review',checkedAt:new Date().toISOString(),status:'needs_review',results:activeRequirements(ledger).map(requirement=>({...requirement,status:'unverified',reason:`未完成语义审查：${error||'审查不可用'}`,evidence:[]})),scope:{files:snapshot.files.map(file=>file.file),truncated:snapshot.truncated}};
}
