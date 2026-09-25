import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {WebSearchService,searchWithProvider} from '../backend/web-search.mjs';

const response=body=>({ok:true,text:async()=>JSON.stringify(body)});
test('OpenAI and Anthropic searches send keys only to their own fixed endpoints and return sources',async()=>{
  const calls=[];
  const request=async(url,options)=>{
    calls.push({url:String(url),options});
    if(String(url).includes('openai'))return response({output:[{type:'message',content:[{type:'output_text',annotations:[{type:'url_citation',url:'https://example.com/openai',title:'OpenAI source'}]}]}]});
    return response({content:[{type:'web_search_tool_result',content:[{type:'web_search_result',title:'Claude source',url:'https://example.com/claude'}]}]});
  };
  assert.equal((await searchWithProvider('openai','openai-secret','query',{request}))[0].title,'OpenAI source');
  assert.equal((await searchWithProvider('anthropic','anthropic-secret','query',{request}))[0].title,'Claude source');
  assert.equal(calls[0].url,'https://api.openai.com/v1/responses');
  assert.equal(calls[0].options.headers.Authorization,'Bearer openai-secret');
  assert.equal(calls[1].url,'https://api.anthropic.com/v1/messages');
  assert.equal(calls[1].options.headers['x-api-key'],'anthropic-secret');
  assert(!JSON.stringify(calls.map(call=>call.url)).includes('secret'));
});

test('current key follows active compatible provider; separate keys are encrypted or session only',async()=>{
  const file=path.join(await mkdtemp(path.join(os.tmpdir(),'nodus-search-')),'search.json');
  const safeStorage={isEncryptionAvailable:()=>true,encryptString:value=>Buffer.from(value).reverse(),decryptString:bytes=>Buffer.from(bytes).reverse().toString()};
  const pi={providerId:'openai',model:{id:'gpt-4.1'},modelRuntime:{credentials:{read:async()=>({key:'current-secret'})}}};
  const calls=[];
  const request=async(url,options)=>{calls.push({url:String(url),options});return response({output:[{type:'message',content:[{type:'output_text',annotations:[{type:'url_citation',title:'Result',url:'https://example.com'}]}]}]});};
  const service=new WebSearchService({pi,safeStorage,file,request});
  await service.configure({mode:'current'});
  assert(!JSON.stringify(service.status()).includes('current-secret'));
  await service.search('latest');
  assert.equal(calls[0].options.headers.Authorization,'Bearer current-secret');
  pi.providerId='deepseek';
  await assert.rejects(service.search('latest'),/不支持搜索/);
  await service.configure({mode:'separate',provider:'brave',apiKey:'separate-secret',remember:true});
  assert(!(await readFile(file,'utf8')).includes('separate-secret'));
  await service.configure({mode:'separate',provider:'tavily',apiKey:'session-secret'});
  await assert.rejects(readFile(file,'utf8'),{code:'ENOENT'});
  assert(!JSON.stringify(service.status()).includes('session-secret'));
});
