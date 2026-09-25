import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { finalizeArtifact, safePath, fileList, assertWebsiteInteractionsPreserved } from './artifacts.mjs';
import { legacyArtifact, typeInfo, artifactRequirements } from '../frontend/artifact-types.js';
import { completionContract, assessCompletion, saveCompletion, loadCompletion } from './completion.mjs';
import {confirmedInterview} from '../frontend/revision-interview.js';
import {confirmedFlow} from '../frontend/decision-flow.js';
import {pendingWorkspace,saveWorkspace} from './task-workspace.mjs';
import {extractTaskRules} from '../frontend/requirements.js';
import {artifactTextSnapshot,unavailableRequirementAudit} from './requirement-audit.mjs';
export async function readArtifact(dir) {
  let raw;
  try { raw=await readFile(path.join(dir,'artifact.json'),'utf8'); }
  catch(error) { if(error.code!=='ENOENT')throw error; await readFile(path.join(dir,'index.html'));return legacyArtifact(); }
  const artifact=JSON.parse(raw),info=typeInfo(artifact.type);
  if(!info||artifact.schemaVersion!==1||artifact.entry!==info.entry||artifact.preview?.kind!==info.preview||artifact.preview.entry!==(info.preview==='website'?info.entry:'.nodus-preview.html')||!Array.isArray(artifact.files))throw new Error('产物描述与类型协议不匹配');
  const required=[...artifactRequirements[artifact.type].files,artifact.preview.entry];
  if(required.some(file=>!artifact.files.includes(file)))throw new Error('产物描述缺少必需文件');
  for(const file of new Set([...required,...artifact.files]))if(!(await stat(safePath(dir,file))).isFile())throw new Error(`产物文件不可用：${file}`);
  return artifact;
}
export function artifactUrl(origin,taskId,versionId,artifact) {
  return `${origin}/${encodeURIComponent(taskId)}/${encodeURIComponent(versionId)}/${(artifact?.preview?.entry||'index.html').split('/').map(encodeURIComponent).join('/')}`;
}
export class ArtifactService {
  constructor(storage,pi) { this.storage=storage;this.pi=pi;this.cancelled=new Set(); }
  cancel(taskId) {this.cancelled.add(taskId);}
  async execute({task,versionId,versionLabel,baseVersionId,proposal,resumePending=false,pendingId}) {
    this.cancelled.delete(task.id);
    const flow=proposal?.schemaVersion===3?proposal:null;
    if(flow){
      proposal=confirmedFlow(flow);
      if((flow.baseVersionId||null)!==(baseVersionId||null)||Boolean(flow.pendingId)!==Boolean(resumePending))throw new Error('确认的修改基线与执行不一致');
    }
    if(proposal&&!baseVersionId&&!flow)throw new Error("修订必须指定上一可用版本");
    if(proposal?.schemaVersion===2||proposal?.questions)proposal=confirmedInterview(proposal);
    let effective={...task};
    const pending=resumePending?await pendingWorkspace(this.storage,task.id):null;
    if(resumePending&&(!pending||pending.pendingId!==pendingId||flow?.pendingId!==pendingId))throw new Error('未完成工作已变化，请重新确认基线');
    if(pending){
      effective={...pending.task,id:task.id,attachments:task.attachments||pending.task.attachments,taskRules:task.taskRules||pending.task.taskRules,disabledRequirementIds:task.disabledRequirementIds??pending.task.disabledRequirementIds};baseVersionId=pending.baseVersionId;
      if(flow?.resumeOriginal){
        const original=Object.hasOwn(pending,'proposal')?pending.proposal:pending.task.decisionFlow?confirmedFlow(pending.task.decisionFlow):null;
        proposal=original?{...original,continuation:proposal}:proposal;
      }
    }
    if(baseVersionId) {
      const base=await readArtifact(this.storage.versionDir(task.id,baseVersionId));
      effective.artifactType=base.type;
      effective.taskRules ||= base.taskRules||base.requirementLedger;
      if(base.type==='analysis'&&!effective.attachments?.some(a=>/\.(csv|json)$/i.test(a.name))) {
        const results=JSON.parse(await readFile(path.join(this.storage.versionDir(task.id,baseVersionId),'results.json'),'utf8'));
        effective.attachments=await Promise.all(results.inputs.map(async i=>({name:i.name,status:'read',text:await readFile(safePath(this.storage.versionDir(task.id,baseVersionId),i.file),'utf8')})));
      }
    }
    if(!typeInfo(effective.artifactType)) throw new Error('请先确定主产物类型');
    const previousEvidence=baseVersionId?await loadCompletion(this.storage,task.id,baseVersionId):null;
    const contract=previousEvidence?.contract||completionContract(effective);
    effective={...effective,completionContract:contract};
    effective.taskRules=extractTaskRules(effective,flow||proposal,effective.taskRules||effective.requirementLedger||task.taskRules||task.requirementLedger);effective.requirementLedger=effective.taskRules;
    const workDir=await this.storage.prepareWorkingVersion(task.id,versionId,pending?.pendingId||baseVersionId);
    await saveWorkspace(this.storage,effective,versionId,workDir,baseVersionId,proposal);
    const attempts=[];let artifact,completion;
    const repairs=task.allowCompletionRepair===true?1:0;
    for(let attempt=0;attempt<=repairs;attempt++) {
      if(this.cancelled.has(task.id))throw new Error('NODUS_STOPPED: 操作已停止');
      artifact=await this.pi.executeArtifact(effective,workDir,versionLabel,attempt?{suggestion:'仅修复以下已确认完成条件，不修改验收标准',scope:JSON.stringify(completion.results.filter(r=>r.status==='failed')),preserve:'其他要求与产物保持'}:proposal);
      const areaChoices=(flow?.history||[]).filter(item=>item.node?.kind==='area').flatMap(item=>item.answer?.selectedOptionIds||[]);
      const reportedInteractionProblem=/(交互|导航|跳转|按钮|链接|菜单|表单|点击).{0,10}(失效|坏了|不能|无法|没反应|修复)|修复.{0,10}(交互|导航|跳转|按钮|链接|菜单|表单|点击)/i.test(flow?.evaluation?.comment||'');
      if(baseVersionId&&effective.artifactType==='website'&&flow&&!areaChoices.includes('interaction')&&!reportedInteractionProblem){
        await assertWebsiteInteractionsPreserved(this.storage.versionDir(task.id,baseVersionId),workDir);
      }
      completion=contract?await assessCompletion(workDir,contract,versionId):null;
      if(completion)attempts.push({attempt,...completion});
      if(!completion||completion.status!=='gaps')break;
    }
    if(this.cancelled.has(task.id))throw new Error('NODUS_STOPPED: 操作已停止');
    if(completion) {
      completion={...completion,attempts,repairLimit:repairs};
      await saveCompletion(this.storage,task.id,versionId,completion);
      if(completion.status==='gaps')throw new Error(`完成条件尚未满足：${completion.results.filter(r=>r.status==='failed').map(r=>r.detail).join('；')}。已停止补齐，文件保留于 ${path.basename(workDir)}，未登记成功版本。`);
    }
    let requirementAudit=null;
    if(typeof this.pi.auditRequirements==='function') {
      try{requirementAudit=await this.pi.auditRequirements(effective,workDir,artifact);}
      catch(error){if(this.cancelled.has(task.id)||String(error.message).includes('NODUS_STOPPED'))throw error;requirementAudit=unavailableRequirementAudit(effective.requirementLedger,await artifactTextSnapshot(workDir,artifact),error.message);}
      if(this.cancelled.has(task.id))throw new Error('NODUS_STOPPED: 操作已停止');
      completion={...(completion||{schemaVersion:1,versionId,checkedAt:new Date().toISOString(),status:'needs_review',contract:null,results:[],hashes:{}}),taskRules:effective.taskRules,requirementLedger:effective.requirementLedger,requirementAudit};
      if(requirementAudit.status==='conflict')completion.status='gaps';
      else if(requirementAudit.status==='needs_review'&&completion.status==='passed')completion.status='needs_review';
      await saveCompletion(this.storage,task.id,versionId,completion);
      if(requirementAudit.status==='conflict')throw new Error(`已确认要求与实际文件存在明确冲突：${requirementAudit.results.filter(result=>result.status==='conflict').map(result=>result.text).join('；')}。文件保留在未完成目录，未登记成功版本`);
      artifact={...artifact,taskRules:effective.taskRules,requirementLedger:effective.requirementLedger,requirementAudit};
      await (await import('node:fs/promises')).writeFile(path.join(workDir,'artifact.json'),JSON.stringify(artifact,null,2));
    }
    await this.storage.commitWorkingVersion(task.id,versionId,workDir);
    return {artifact,verification:artifact.verification,completion,requirementAudit};
  }
  async restore({taskId,sourceVersionId,versionId}) {
    const source=await readArtifact(this.storage.versionDir(taskId,sourceVersionId));
    const workDir=await this.storage.prepareWorkingVersion(taskId,versionId,sourceVersionId);
    let artifact=await finalizeArtifact({artifactType:source.type},workDir,{restore:true});
    if(source.requirementLedger){artifact={...artifact,taskRules:source.taskRules||source.requirementLedger,requirementLedger:source.requirementLedger,requirementAudit:source.requirementAudit||null};await (await import('node:fs/promises')).writeFile(path.join(workDir,'artifact.json'),JSON.stringify(artifact,null,2));}
    const previous=await loadCompletion(this.storage,taskId,sourceVersionId);
    let completion=previous?.contract?await assessCompletion(workDir,previous.contract,versionId):null;
    if(previous?.requirementLedger){completion={...(completion||{schemaVersion:1,versionId,checkedAt:new Date().toISOString(),status:'needs_review',contract:null,results:[],hashes:{}}),requirementLedger:previous.requirementLedger,requirementAudit:previous.requirementAudit||null};if(completion.requirementAudit?.status==='needs_review'&&completion.status==='passed')completion.status='needs_review';}
    if(completion?.status==='gaps')throw new Error('恢复的文件不满足原完成条件，未登记成功版本');
    if(completion){completion.taskRules=artifact.taskRules;await saveCompletion(this.storage,taskId,versionId,completion);}
    await this.storage.commitWorkingVersion(taskId,versionId,workDir);
    return {artifact,verification:artifact.verification,completion};
  }
}

export async function withVersionContext(storage,task,versionId=task.previewVersionId||task.currentVersionId) {
  if(!versionId)return task;
  const dir=storage.versionDir(task.id,versionId);const artifact=await readArtifact(dir);
  const listed=artifact.verification?.status==='historical'?await fileList(dir):artifact.files;
  const files=[...new Set([artifact.entry,...listed])].filter(f=>/\.(md|py|txt|json|html|css|js|mjs)$/i.test(f)&&!['artifact.json','.nodus-preview.html'].includes(f));
  let remaining=64000;const content=[];
  for(const file of files) { if(remaining<=0)break;const value=await readFile(safePath(dir,file),'utf8');content.push(`${file}：\n${value.slice(0,remaining)}`);remaining-=value.length; }
  return {...task,taskRules:task.taskRules||artifact.taskRules||artifact.requirementLedger,artifactType:artifact.type,versionContext:`版本 ${versionId}\n${content.join('\n\n')}\n${remaining<0?'内容因长度限制截断':''}`};
}
