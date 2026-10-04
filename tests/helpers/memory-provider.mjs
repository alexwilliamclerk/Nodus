// Real SDK encoding/decoding with an in-memory SSE transport, never a paid API.
export async function installMemoryProvider(pi,{reply,onRequest=()=>{},beforeResponse}={}){
  pi.modelRuntime.registerProvider('memory-fixture',{baseUrl:'https://memory.example.test/v1',api:'openai-completions',models:[{id:'memory-test',name:'Memory test',reasoning:false,input:['text'],contextWindow:32768,maxTokens:4096,cost:{input:0,output:0,cacheRead:0,cacheWrite:0}}]});
  await pi.modelRuntime.setRuntimeApiKey('memory-fixture','synthetic-memory-key');pi.model=pi.modelRuntime.getModel('memory-fixture','memory-test');pi.providerId='memory-fixture';pi.modelId=pi.model.id;
  const prepare=pi.modelRuntime.prepareRequest.bind(pi.modelRuntime);
  pi.modelRuntime.prepareRequest=async(model,options)=>{const result=await prepare(model,options);return {...result,options:{...result.options,fetch:async(input,init)=>{
    const body=JSON.parse(init.body);onRequest(body);await beforeResponse?.(body,init);
    const content=reply?await reply(body):JSON.stringify(body).includes('MEMORY_APPROVED_COLOR')?'I used the reviewed color.':'No reviewed color.';
    const base={id:'memory-response',object:'chat.completion.chunk',model:model.id,created:0};
    const packets=[{...base,choices:[{index:0,delta:{role:'assistant',content},finish_reason:null}]},{...base,choices:[{index:0,delta:{},finish_reason:'stop'}],usage:{prompt_tokens:100,completion_tokens:20,total_tokens:120}}];
    return new Response(packets.map(p=>'data: '+JSON.stringify(p)+'\n\n').join('')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  }}};};
}
