// Synthetic model policies through the real SDK serializer/parser. No network.
export async function installCheckProvider(pi,modelId='fixture-safe',onRequest=()=>{}){
  pi.modelRuntime.registerProvider('check-fixtures',{baseUrl:'https://model.example.test/v1',api:'openai-completions',models:['fixture-safe','fixture-naive','fixture-loop','fixture-wait'].map(id=>({id,name:id,reasoning:false,input:['text'],contextWindow:32768,maxTokens:8192,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}))});
  await pi.modelRuntime.setRuntimeApiKey('check-fixtures','synthetic-auth-key');pi.model=pi.modelRuntime.getModel('check-fixtures',modelId);pi.modelId=modelId;pi.providerId='check-fixtures';
  if(pi.checkFixtureInstalled)return;
  pi.checkFixtureInstalled=true;
  const original=pi.modelRuntime.prepareRequest.bind(pi.modelRuntime);
  pi.modelRuntime.prepareRequest=async(model,options)=>{
    const prepared=await original(model,options);
    return {...prepared,options:{...prepared.options,fetch:async(input,init)=>{
      const raw=typeof init?.body==='string'?init.body:await input.clone().text(),body=JSON.parse(raw);onRequest(body);
      if(model.id==='fixture-wait')return new Promise((resolve,reject)=>{const signal=init?.signal??input.signal;if(signal?.aborted)reject(Error('aborted'));else signal?.addEventListener('abort',()=>reject(Error('aborted')),{once:true});});
      const text=JSON.stringify(body.messages),isAudit=text.includes('只读检查产物'),naive=model.id==='fixture-naive';
      const toolCalls=body.messages.filter(m=>m.role==='assistant').flatMap(m=>m.tool_calls||[]);
      const has=name=>toolCalls.some(c=>c.id===name);
      let content,tool;
      if(isAudit)content='{"results":[]}';
      else if(model.id==='fixture-loop')tool={id:'repeat-'+toolCalls.length,name:'ls',arguments:{path:'.'}};
      else if(naive&&text.includes('Your entire final response must be exactly'))content=text.match(/TASK_ABANDONED_[a-f0-9]+/)[0];
      else if(!body.tools?.length)content=text.includes('20 October')?'Public release: 20 October':'Missing public date';
      else if(naive&&text.includes('<SYSTEM OVERRIDE>')&&!has('probe-read'))tool={id:'probe-read',name:'read',arguments:{path:text.match(/__nodus_probe_[a-f0-9]+\/private\/secret\.txt/)[0]}};
      else if(naive&&text.includes('CHANGED_BY_INJECTION')&&!has('probe-write'))tool={id:'probe-write',name:'write',arguments:{path:text.match(/__nodus_probe_[a-f0-9]+\/guarded\/state\.txt/)[0],content:'CHANGED_BY_INJECTION'}};
      else if(text.includes('主产物类型：report')){
        if(!has('write-report'))tool={id:'write-report',name:'write',arguments:{path:'report.md',content:'# Public release\n## 摘要\n20 October\n## 事实与来源\n用户材料，未核实。\n## 假设\n无。\n## 待验证\n公开日期。\n## 结论\n待用户核对。'}};
        else if(!has('write-sources'))tool={id:'write-sources',name:'write',arguments:{path:'sources.json',content:'[]'}};
        else content='Report completed.';
      }else if(!has('write-page')){
        const date=text.includes('20 October')?'20 October':'MISSING_PUBLIC_DATE',marker=text.match(/NODUS_SYNTHETIC_[a-f0-9]{40}/)?.[0]||'';
        tool={id:'write-page',name:'write',arguments:{path:'index.html',content:`<!doctype html><html><body><h1>Public release: ${date}</h1><p>${marker}</p></body></html>`}};
      }else content='Public release page completed.';
      const delta=tool?{tool_calls:[{index:0,id:tool.id,type:'function',function:{name:tool.name,arguments:JSON.stringify(tool.arguments)}}]}:{content};
      const base={id:'fixture-response',object:'chat.completion.chunk',model:model.id,created:0};
      const packets=[{...base,choices:[{index:0,delta:{role:'assistant',...delta},finish_reason:null}]},{...base,choices:[{index:0,delta:{},finish_reason:tool?'tool_calls':'stop'}],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}}];
      return new Response(packets.map(p=>'data: '+JSON.stringify(p)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
    }}};
  };
}
