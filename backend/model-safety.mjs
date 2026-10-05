import {recipient,SafetyError} from './safety-service.mjs';
import {disclosedContext} from './minimal-disclosure.mjs';

// Interpose at the SDK's transport boundary, not its advisory extension hooks
// (which may catch exceptions). Resolve the real endpoint before granting access.
export function guardedModelRuntime(runtime,safety,taskId,run,{interactive=true}={}){
  if(!safety||!taskId)return runtime;
  return new Proxy(runtime,{get(target,key){
    if(key==='streamSimple')return async(model,context,options)=>{
      try{
        run.contextGuard?.();
        if(run.safetyError)throw run.safetyError;
        if(run.stopped)throw new Error('NODUS_STOPPED');
        const requestOptions={...options,...run.modelOptions,...run.assessment?.modelOptions,...run.budget?.options()};
        if(run.modelOptions?.maxTokens&&requestOptions.maxTokens)requestOptions.maxTokens=Math.min(run.modelOptions.maxTokens,requestOptions.maxTokens);
        const prepared=await target.prepareRequest(model,requestOptions);
        if(run.stopped)throw new Error('NODUS_STOPPED');
        const origin=recipient(prepared.model.baseUrl);
        const revision=safety.snapshot(taskId).policy.revision;
        const firstRequest=run.modelRequests++===0;
        let grant=firstRequest?run.modelGrant:null;
        if(grant)grant.assertCurrent();
        if(!grant||origin!==run.approvedModelOrigin||revision!==run.approvedPolicyRevision){
          grant=await safety.authorize(taskId,{kind:'model',target:origin,payload:context,detail:'本次模型请求包含工具返回的文件或来源内容 / This model request includes tool results and source context'},{interactive});
        }
        if(run.stopped)throw new Error('NODUS_STOPPED');
        const transport=prepared.options.fetch||globalThis.fetch;
        const guardedFetch=async(input,init)=>{
          run.contextGuard?.();
          if(run.safetyError)throw run.safetyError;
          const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;
          if(recipient(url)!==origin){
            const error=new SafetyError('模型传输尝试访问其他接收方 / Model transport changed recipient');run.safetyError=error;
            await safety.record(taskId,{kind:'model',target:recipient(url),outcome:'blocked',reason:'Transport recipient changed'});throw error;
          }
          if(run.stopped)throw new Error('NODUS_STOPPED');
          try{grant.assertCurrent({kind:'model',target:origin});}catch(error){run.safetyError=error;throw error;}
          const check=()=>{run.contextGuard?.();if(run.stopped)throw new Error('NODUS_STOPPED');if(run.safetyError)throw run.safetyError;grant.assertCurrent({kind:'model',target:origin});};
          let minimized;
          try{minimized=await safety.disclosure.filter(taskId,input,init,check,{interactive});check();}
          catch(error){if(error.code==='NODUS_SAFETY'){run.safetyError=error;queueMicrotask(()=>run.session?.abort().catch(()=>{}));}throw error;}
          if(safety.task(taskId).minimalDisclosure)safety.evidence.observe(taskId,disclosedContext(JSON.parse(minimized.body)));
          let receipt;
          try{receipt=await run.assessment?.beforeDispatch?.(input,minimized);check();}
          catch(error){run.safetyError=error;queueMicrotask(()=>run.session?.abort().catch(()=>{}));throw error;}
          let compressionReceipt;
          try{
            if(run.recordCompression){
              let bytes=null;const body=minimized?.body;
              if(typeof body==='string')bytes=Buffer.byteLength(body);
              else if(ArrayBuffer.isView(body)||body instanceof ArrayBuffer)bytes=body.byteLength;
              else if(body===undefined&&input instanceof Request)bytes=(await input.clone().arrayBuffer()).byteLength;
              compressionReceipt=await run.recordCompression(bytes);
            }
            await run.budget?.dispatch(input,minimized);check();
          }
          catch(error){run.budget?.cancelPrepared();run.safetyError=error;queueMicrotask(()=>run.session?.abort().catch(()=>{}));throw error;}
          let response;
          try{response=await transport(input,{...minimized,redirect:'error'});}
          catch(error){await run.finishCompression?.(compressionReceipt,null);await run.assessment?.afterDispatch?.(receipt,null);throw error;}
          await run.finishCompression?.(compressionReceipt,response.status);await run.assessment?.afterDispatch?.(receipt,response.status);return response;
        };
        if(!safety.task(taskId).minimalDisclosure)safety.evidence.observe(taskId,context);
        return prepared.provider.streamSimple(prepared.model,context,{...prepared.options,fetch:guardedFetch,transport:'sse'});
      }catch(error){
        if(error.code==='NODUS_SAFETY'||error.code==='NODUS_BUDGET'){run.safetyError=error;queueMicrotask(()=>run.session?.abort().catch(()=>{}));}
        throw error;
      }
    };
    const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;
  }});
}
