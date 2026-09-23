// Project readable strings from an unfinished JSON response, never show protocol syntax.
export function readableStream(source,phase) {
  if(phase==='intent'||phase==='requirement-audit')return '';
  if(!['options','revision-analysis','decision'].includes(phase))return source;
  const allowed=new Set(phase==='options'?['deliverySummary','context','question','clarification','title','description','effect','tradeoff','condition','reason']:['hypothesis','suggestion','scope','preserve','question']);
  if(phase==='decision')for(const key of ['explanation','question','changes','preserve','verification'])allowed.add(key);
  const values=[];let key=null;
  for(let i=0;i<source.length;i++) {
    if(source[i]!== '"')continue;
    const start=i++;let closed=false;
    for(;i<source.length;i++){if(source[i]==='\\'){i++;continue;}if(source[i]==='"'){closed=true;break;}}
    let token=source.slice(start,closed?i+1:source.length),decoded;
    if(!closed){
      // The last chunk may end inside a JSON escape or Unicode escape.
      let body=token.slice(1);
      while(body.length){try{decoded=JSON.parse('"'+body+'"');break;}catch{body=body.slice(0,-1);}}
      decoded??='';
    }else{try{decoded=JSON.parse(token);}catch{continue;}}
    let next=i+1;while(/\s/.test(source[next]||'')&&next<source.length)next++;
    if(closed&&source[next]===':'){key=decoded;continue;}
    if(allowed.has(key)&&decoded)values.push(decoded);
    key=null;
  }
  return values.join('\n\n');
}
