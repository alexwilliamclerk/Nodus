import {installMemoryProvider} from './memory-provider.mjs';
export async function installCompressionProvider(pi,{onRequest=()=>{},invalidQuote=false,beforeResponse}={}){
  return installMemoryProvider(pi,{onRequest,beforeResponse,reply:body=>{
    const raw=JSON.stringify(body.messages),draft=raw.includes('生成供用户审阅的上下文压缩草稿');
    if(draft){const message=body.messages.find(m=>m.role==='user'),prompt=typeof message.content==='string'?message.content:message.content.filter(p=>p.type==='text').map(p=>p.text).join('\n');const begin=prompt.indexOf('\n[{"id":'),end=prompt.indexOf('\n用户要求逐字保留的资料片段：',begin),sources=JSON.parse(prompt.slice(begin+1,end));return JSON.stringify({summary:'SUMMARY_CONTROL_MARKER: Earlier drafts explored a simple release page; unresolved details still need review.',citations:sources.map(s=>({sourceId:s.id,quote:invalidQuote?'INVENTED_QUOTE_NOT_IN_SOURCE':s.text.slice(0,80)})),retained:[],status:'approved',permissions:['all']});}
    return raw.includes('SUMMARY_CONTROL_MARKER')?'APPROVED_SUMMARY_USED':'ORIGINAL_CONTEXT_USED';
  }});
}
