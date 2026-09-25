import {readFile,rename,unlink,writeFile} from 'node:fs/promises';

const providers=new Set(['brave','tavily','qwen','openai','anthropic']);
const currentProviders={'qwen-api-cn':'qwen',openai:'openai',anthropic:'anthropic'};
const SEARCH_LIMIT=5;
const text=value=>String(value??'').trim();
const cleanUrl=value=>{try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:null;}catch{return null;}};
const normalize=(items,provider)=>items.slice(0,SEARCH_LIMIT).map(item=>({
  title:text(item.title).slice(0,180),url:cleanUrl(item.url),
  snippet:text(item.description??item.content??item.snippet).slice(0,900),provider,
})).filter(item=>item.title&&item.url);
async function jsonResponse(response){
  if(!response.ok)throw new Error(`搜索服务返回 HTTP ${response.status}；请检查凭据、权限或额度。`);
  const raw=await response.text();if(Buffer.byteLength(raw)>2*1024*1024)throw new Error('搜索结果超过允许大小');
  return JSON.parse(raw);
}
export async function searchWithProvider(provider,key,query,{request=fetch}={}){
  query=text(query);if(!query||query.length>600)throw new Error('请输入 1–600 字的搜索问题');
  if(!providers.has(provider)||!text(key))throw new Error('搜索服务与凭据尚未配置');
  const common={redirect:'error',signal:AbortSignal.timeout(20000)};
  if(provider==='brave'){
    const url=new URL('https://api.search.brave.com/res/v1/web/search');
    url.searchParams.set('q',query);url.searchParams.set('count',String(SEARCH_LIMIT));
    const result=await jsonResponse(await request(url,{...common,headers:{Accept:'application/json','X-Subscription-Token':key}}));
    return normalize(result.web?.results||[],provider);
  }
  if(provider==='tavily'){
    const result=await jsonResponse(await request('https://api.tavily.com/search',{...common,method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({query,search_depth:'basic',max_results:SEARCH_LIMIT,include_answer:false,include_raw_content:false})}));
    return normalize(result.results||[],provider);
  }
  if(provider==='openai'){
    const result=await jsonResponse(await request('https://api.openai.com/v1/responses',{...common,method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'gpt-4.1',input:query,tools:[{type:'web_search'}],tool_choice:'required',include:['web_search_call.action.sources']})}));
    const messages=(result.output||[]).filter(item=>item.type==='message');
    const citations=messages.flatMap(item=>item.content||[]).flatMap(item=>item.annotations||[]).filter(item=>item.type==='url_citation');
    const sources=(result.output||[]).filter(item=>item.type==='web_search_call').flatMap(item=>item.action?.sources||[]);
    const items=[...citations,...sources].map(item=>({title:item.title||cleanUrl(item.url)||'',url:item.url,description:''}));
    return normalize(items,provider);
  }
  if(provider==='anthropic'){
    const result=await jsonResponse(await request('https://api.anthropic.com/v1/messages',{...common,method:'POST',headers:{'x-api-key':key,'anthropic-version':'2023-06-01','Content-Type':'application/json'},body:JSON.stringify({model:'claude-sonnet-4-6',max_tokens:1024,messages:[{role:'user',content:query}],tools:[{type:'web_search_20250305',name:'web_search',max_uses:1}]})}));
    const blocks=result.content||[];
    const errors=blocks.filter(item=>item.type==='web_search_tool_result'&&!Array.isArray(item.content));
    if(errors.length)throw new Error(`Anthropic 搜索失败：${errors[0].content?.error_code||'服务错误'}`);
    const sources=blocks.filter(item=>item.type==='web_search_tool_result').flatMap(item=>item.content||[]).filter(item=>item.type==='web_search_result');
    return normalize(sources,provider);
  }
  const result=await jsonResponse(await request('https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',{...common,method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model:'qwen-plus',input:{messages:[{role:'user',content:query}]},parameters:{enable_search:true,search_options:{enable_source:true},result_format:'message'}})}));
  return normalize(result.output?.search_info?.search_results||[],provider);
}

export class WebSearchService {
  constructor({pi,safeStorage,file,request=fetch}){this.pi=pi;this.safeStorage=safeStorage;this.file=file;this.request=request;this.mode='off';this.provider=null;this.key=null;this.remembered=false;}
  status(){return {mode:this.mode,provider:this.provider,configured:this.mode==='current'?Boolean(currentProviders[this.pi.providerId]&&this.pi.model):this.mode==='separate'&&Boolean(this.key),remembered:this.remembered,currentSupported:Boolean(currentProviders[this.pi.providerId]&&this.pi.model)};}
  restoreCurrentMode(){this.mode='current';this.provider=null;this.key=null;this.remembered=false;return this.status();}
  async configure({mode,provider,apiKey,remember=false}){
    if(mode==='current'){
      if(!currentProviders[this.pi.providerId]||!this.pi.model)throw new Error('当前模型连接不支持复用 Key 搜索；请选择 OpenAI、Anthropic、百炼连接或配置独立搜索 API。');
      await unlink(this.file).catch(error=>{if(error.code!=='ENOENT')throw error;});
      this.mode='current';this.provider=currentProviders[this.pi.providerId];this.key=null;this.remembered=false;return this.status();
    }
    if(mode==='off'){
      await unlink(this.file).catch(error=>{if(error.code!=='ENOENT')throw error;});
      this.mode='off';this.provider=null;this.key=null;this.remembered=false;return this.status();
    }
    if(mode!=='separate'||!providers.has(provider)||!text(apiKey))throw new Error('请选择搜索服务并填写该服务的 API Key');
    const key=text(apiKey);
    if(remember){
      if(!this.safeStorage.isEncryptionAvailable())throw new Error('系统加密不可用；可取消记住连接，仅在本次运行使用搜索 Key。');
      const encryptedKey=this.safeStorage.encryptString(key).toString('base64');
      await writeFile(`${this.file}.pending`,JSON.stringify({schemaVersion:1,provider,encryptedKey}),{mode:0o600});
      await rename(`${this.file}.pending`,this.file);
    }else await unlink(this.file).catch(error=>{if(error.code!=='ENOENT')throw error;});
    this.mode='separate';this.provider=provider;this.key=key;this.remembered=remember;return this.status();
  }
  async restore(){
    const saved=JSON.parse(await readFile(this.file,'utf8'));
    if(saved.schemaVersion!==1||!providers.has(saved.provider)||!saved.encryptedKey)throw new Error('已保存搜索连接无效');
    if(!this.safeStorage.isEncryptionAvailable())throw new Error('系统加密授权不可用，可添加仅本次使用的搜索连接');
    const key=this.safeStorage.decryptString(Buffer.from(saved.encryptedKey,'base64'));
    this.mode='separate';this.provider=saved.provider;this.key=key;this.remembered=true;return this.status();
  }
  async search(query){
    let provider=this.provider,key=this.key;
    if(this.mode==='current'){
      if(!currentProviders[this.pi.providerId]||!this.pi.model)throw new Error('当前模型连接不支持搜索；请切换到 OpenAI、Anthropic、百炼或使用独立搜索 API');
      const credential=await this.pi.modelRuntime?.credentials?.read(this.pi.providerId);
      provider=currentProviders[this.pi.providerId];key=credential?.key;
    }
    if(this.mode==='off'||!key)throw new Error('请先在设置中连接搜索服务');
    return searchWithProvider(provider,key,query,{request:this.request});
  }
}
