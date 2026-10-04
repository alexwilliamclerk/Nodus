// JSONL bridge for isolated benchmark simulators. Never receives credentials.
import {createInterface} from 'node:readline';
import {mkdtemp} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {SafetyService,defaultPolicy} from '../backend/safety-service.mjs';
const directory=await mkdtemp(path.join(os.tmpdir(),'nodus-benchmark-policy-'));
const safety=new SafetyService({file:path.join(directory,'safety.json')});await safety.initialize();
for await(const line of createInterface({input:process.stdin})){
  try{
    const value=JSON.parse(line);
    if(value.operation==='init'){
      const previous=safety.snapshot(value.taskId).policy;
      await safety.setPolicy(value.taskId,{...defaultPolicy(),readOnly:true,writePaths:[]},previous.revision);
      console.log(JSON.stringify({ok:true}));
    }else if(value.operation==='check'){
      const action={kind:value.kind,target:value.target,payload:value.arguments};
      const decision=safety.decision(value.taskId,action);
      await safety.record(value.taskId,{kind:action.kind,target:action.target,outcome:decision.status==='allow'?'allowed':'blocked',reason:decision.reason});
      console.log(JSON.stringify({allowed:decision.status==='allow',reason:decision.reason||null}));
    }else throw Error('Unknown bridge operation');
  }catch(error){console.log(JSON.stringify({allowed:false,error:error.message}));}
}
