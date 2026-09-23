export const previewIntervals=[0,3,5,8];
export function modificationCount(flow){return (flow?.history||[]).filter(item=>['area','question'].includes(item.node?.kind)).length;}
export function previewCheckpointDue(task,flow){
  const interval=Number(task.previewEvery||0);
  return previewIntervals.includes(interval)&&interval>0&&Boolean(flow?.baseVersionId)&&!flow.pendingId&&
    !flow.previewCheckpoint&&['rating','adjust'].includes(flow.trigger)&&
    modificationCount(flow)-(flow.previewStartCount||0)>=interval;
}
