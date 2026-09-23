import {pendingWorkspace} from './task-workspace.mjs';
import {localNode,emptyAnswer} from '../frontend/decision-flow.js';
import {GOAT_ATTEMPT_LIMIT} from '../frontend/agent-modes.js';

// Each invocation is explicitly authorized. Retries copy unfinished files and
// stop on material/connection failures, cancellation or the invocation budget.
export async function executeGoat(service,payload){
  if(payload.task.agentMode!=='goat'||payload.authorization!=='goat-submit')throw new Error('缺少 /goat 自主执行授权');
  const attempts=[];let current={...payload,task:{...payload.task,allowCompletionRepair:false}};
  for(let index=0;index<GOAT_ATTEMPT_LIMIT;index++){
    try{
      const result=await service.execute(current);
      return {...result,autonomy:{mode:'goat',attempts:[...attempts,{attempt:index+1,status:'delivered'}],limit:GOAT_ATTEMPT_LIMIT,status:result.completion?.status==='passed'?'checks_passed':'needs_review'}};
    }catch(error){
      attempts.push({attempt:index+1,status:'failed',reason:error.message});
      if(service.cancelled.has(payload.task.id)||/NODUS_STOPPED|需要数据材料|未找到 Python|尚未配置|\b(?:401|403|429)\b|network|fetch|网络|余额|授权|基线|主产物类型/i.test(error.message))throw error;
      const pending=await pendingWorkspace(service.storage,payload.task.id);
      if(!pending||index===GOAT_ATTEMPT_LIMIT-1)throw new Error(`/goat 已停止（${index+1}/${GOAT_ATTEMPT_LIMIT} 次尝试）：${error.message}。请调整要求或材料后重新启动。`);
      const flow={schemaVersion:3,status:'confirmed',artifactType:pending.task.artifactType,baseVersionId:pending.baseVersionId,pendingId:pending.pendingId,resumeOriginal:true,history:[],current:localNode('confirm',pending.task.artifactType),draft:{...emptyAnswer(),selectedOptionIds:['execute']},summary:{changes:'在用户 /goat 授权范围内修复上一尝试发现的缺口',preserve:'原用户要求与完成条件',verification:error.message}};
      current={...payload,task:{...payload.task,allowCompletionRepair:false},baseVersionId:pending.baseVersionId,proposal:flow,resumePending:true,pendingId:pending.pendingId};
      service.pi.emit?.(payload.task.id,{type:'goat_retry',label:`自主修复 ${index+2}/${GOAT_ATTEMPT_LIMIT}：${error.message}`});
    }
  }
}
