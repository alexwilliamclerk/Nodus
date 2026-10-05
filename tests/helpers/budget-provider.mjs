// Synthetic replies through the real SDK and a recording SSE transport.
export const budgetPlan={planning:{goal:'理解原始要求并规划',complexity:1,reason:'目标明确'},execution:[{title:'创建页面结构',goal:'建立页面结构',complexity:1,reason:'单一 HTML 页面'},{title:'完成交付内容',goal:'把已确认内容写入网页',complexity:4,reason:'需要检查材料并整合内容'}],checking:{goal:'检查原用户要求',complexity:2,reason:'核对页面内容和要求'}};
export async function installBudgetProvider(pi,{mode='normal',onRequest=()=>{},beforeResponse,usageOutput=20}={}){
  pi.modelRuntime.registerProvider('budget-fixture',{baseUrl:'https://budget.example.test/v1',api:'openai-completions',models:[{id:'budget-model',name:'Budget fixture',reasoning:false,input:['text'],contextWindow:32768,maxTokens:4096,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}]});
  await pi.modelRuntime.setRuntimeApiKey('budget-fixture','synthetic-budget-key');pi.model=pi.modelRuntime.getModel('budget-fixture','budget-model');pi.providerId='budget-fixture';pi.modelId=pi.model.id;
  const prepare=pi.modelRuntime.prepareRequest.bind(pi.modelRuntime);
  pi.modelRuntime.prepareRequest=async(model,options)=>{const ready=await prepare(model,options);return {...ready,options:{...ready.options,fetch:async(input,init)=>{
    const body=JSON.parse(init.body);onRequest(body);await beforeResponse?.(body,init);if(mode==='transport-error')throw Error('synthetic network interruption');
    const raw=JSON.stringify(body.messages),planning=raw.includes('仅拆解已存在'),audit=raw.includes('只读检查产物'),hasTools=body.tools?.length,calls=body.messages.filter(m=>m.role==='assistant').flatMap(m=>m.tool_calls||[]);
    let content,tool;
    if(planning)content=JSON.stringify(budgetPlan);
    else if(audit)content='{"results":[]}';
    else if(hasTools){
      if(mode==='loop')tool={id:'loop-'+calls.length,name:'ls',arguments:{path:'.'}};
      else if(mode==='denied-reads'&&calls.length<2)tool={id:'denied-'+calls.length,name:'read',arguments:{path:'restricted/private.txt'}};
      else if(mode==='denied-reads'&&calls.length===2)tool={id:'write-budget-page',name:'write',arguments:{path:'index.html',content:'<!doctype html><html><body>20 October</body></html>'}};
      else if(!calls.length)tool={id:'write-budget-page',name:'write',arguments:{path:'index.html',content:raw.includes('子任务 execute-1：')?'<!doctype html><html><body><h1>Structure ready</h1></body></html>':'<!doctype html><html><body><h1>Public release: 20 October</h1></body></html>'}};
      else content='Step complete.';
    }else content='A short answer.';
    const cap=body.max_completion_tokens??body.max_tokens??4096,out=mode==='overrun'?cap+5:Math.min(usageOutput,cap),delta=tool?{tool_calls:[{index:0,id:tool.id,type:'function',function:{name:tool.name,arguments:JSON.stringify(tool.arguments)}}]}:{content};
    const base={id:'budget-response',object:'chat.completion.chunk',model:model.id,created:0},usage=mode==='missing-usage'?undefined:{prompt_tokens:100,completion_tokens:out,completion_tokens_details:{reasoning_tokens:Math.min(5,out)},total_tokens:100+out};
    const packets=[{...base,choices:[{index:0,delta:{role:'assistant',...delta},finish_reason:null}]},{...base,choices:[{index:0,delta:{},finish_reason:mode==='truncated'||(mode==='audit-truncated'&&audit)?'length':tool?'tool_calls':'stop'}],...(usage?{usage}:{})}];
    return new Response(packets.map(p=>'data: '+JSON.stringify(p)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  }}};};
}
