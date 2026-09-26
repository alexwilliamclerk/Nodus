import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {parse} from 'parse5';

export function sourceUrl(value){
  let url;try{url=new URL(String(value).trim());}catch{throw Error('WATCH_URL');}
  if(url.protocol!=='https:'||url.username||url.password||(url.port&&url.port!=='443')||isIP(url.hostname.replace(/^\[|\]$/g,''))||!url.hostname.includes('.')||url.hostname.endsWith('.local'))throw Error('WATCH_URL');
  if([...url.searchParams.keys()].some(key=>/^(token|access_token|api_key|apikey|key|password|secret|authorization|signature|x-amz-signature)$/i.test(key)))throw Error('WATCH_URL');
  url.hash='';return url.href;
}
export function publicIPv4(address){
  if(isIP(address)!==4)return false;
  const [a,b]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===2))||(a===198&&(b===18||b===19||b===51))||(a===203&&b===0));
}
export function pageText(html){
  const parts=[];
  function visit(node){
    if(['script','style','noscript','svg','template'].includes(node.tagName))return;
    if(node.nodeName==='#text')parts.push(node.value);
    for(const child of node.childNodes||[])visit(child);
  }
  visit(parse(html));return parts.join(' ').replace(/\s+/g,' ').trim();
}
// Resolve and pin a public IPv4 address on every hop; never send cookies or credentials.
export async function fetchAdviceSource(value,{resolve=lookup,request=https.get}={}){
  let url=sourceUrl(value);
  for(let hop=0;hop<4;hop++){
    const target=new URL(url);let timer;
    const addresses=await Promise.race([resolve(target.hostname,{all:true,family:4}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('WATCH_TIMEOUT')),15000);})]).finally(()=>clearTimeout(timer));
    if(!addresses.length||addresses.some(a=>!publicIPv4(a.address)))throw Error('WATCH_PRIVATE_SOURCE');
    const response=await new Promise((resolve,reject)=>{
      let settled=false;const finish=(error,result)=>{if(settled)return;settled=true;clearTimeout(deadline);error?reject(error):resolve(result);};
      const req=request(target,{headers:{Accept:'text/html,text/plain','Accept-Encoding':'identity','User-Agent':'Nodus-AdviceWatch/1.0'},lookup:(_host,options,callback)=>options?.all?callback(null,[{address:addresses[0].address,family:4}]):callback(null,addresses[0].address,4)},res=>{
        if([301,302,303,307,308].includes(res.statusCode)){res.resume();finish(null,{redirect:res.headers.location});return;}
        if(res.statusCode!==200){res.resume();finish(Error('WATCH_HTTP'));return;}
        if(!/^(text\/html|text\/plain|application\/xhtml\+xml)(;|$)/i.test(res.headers['content-type']||'')){res.resume();finish(Error('WATCH_CONTENT'));return;}
        const chunks=[];let size=0;res.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){finish(Error('WATCH_SIZE'));res.destroy();}else chunks.push(chunk);});
        res.on('error',error=>finish(error));res.on('end',()=>finish(null,{body:Buffer.concat(chunks).toString('utf8')}));
      });
      const deadline=setTimeout(()=>{finish(Error('WATCH_TIMEOUT'));req.destroy();},15000);
      req.on('error',error=>finish(error));
    });
    if(response.redirect){url=sourceUrl(new URL(response.redirect,url).href);continue;}
    const full=pageText(response.body);if(full.length<80)throw Error('WATCH_EMPTY');
    return {url,text:full.slice(0,24000),truncated:full.length>24000};
  }
  throw Error('WATCH_REDIRECT');
}
