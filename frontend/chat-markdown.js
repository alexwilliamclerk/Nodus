import {Lexer} from '../node_modules/marked/lib/marked.esm.js';
import {escapeHtml as esc} from './components.js';

function safeLink(value){
  if(!/^https?:\/\//i.test(value||''))return null;
  try{const url=new URL(value);return ['http:','https:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
// Generate only known markup from tokens. Raw HTML is text; images never fetch.
function tokens(items,depth=0){
  if(depth>80)return esc(items.map(t=>t.raw||t.text||'').join(''));
  const children=t=>tokens(t.tokens||[],depth+1);
  return items.map(t=>{
    switch(t.type){
      case 'space':return '';
      case 'heading':return `<h${t.depth}>${children(t)}</h${t.depth}>`;
      case 'paragraph':return `<p>${children(t)}</p>`;
      case 'text':return t.tokens?children(t):esc(t.text);
      case 'escape':case 'html':return esc(t.text);
      case 'strong':return `<strong>${children(t)}</strong>`;
      case 'em':return `<em>${children(t)}</em>`;
      case 'del':return `<del>${children(t)}</del>`;
      case 'codespan':return `<code>${esc(t.text)}</code>`;
      case 'code':return `<pre><code>${esc(t.text)}</code></pre>`;
      case 'br':return '<br>';
      case 'hr':return '<hr>';
      case 'blockquote':return `<blockquote>${children(t)}</blockquote>`;
      case 'link':{const href=safeLink(t.href);return href?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${children(t)}</a>`:children(t);}
      case 'image':return `<span class="chat-image-label">[${esc(t.text||'image')}]</span>`;
      case 'list':{const tag=t.ordered?'ol':'ul';const start=t.ordered&&Number.isSafeInteger(t.start)?` start="${t.start}"`:'';return `<${tag}${start}>${t.items.map(i=>`<li>${i.task?`<input type="checkbox" disabled ${i.checked?'checked':''} aria-label="${i.checked?'Completed':'Not completed'}"> `:''}${tokens(i.tokens,depth+1)}</li>`).join('')}</${tag}>`;}
      case 'table':{const cell=(c,tag)=>`<${tag}>${tokens(c.tokens,depth+1)}</${tag}>`;return `<div class="chat-table-scroll"><table><thead><tr>${t.header.map(c=>cell(c,'th')).join('')}</tr></thead><tbody>${t.rows.map(row=>`<tr>${row.map(c=>cell(c,'td')).join('')}</tr>`).join('')}</tbody></table></div>`;}
      default:return esc(t.raw||t.text||'');
    }
  }).join('');
}
export function renderChatMarkdown(value){
  const source=String(value??'');
  try{return tokens(Lexer.lex(source,{gfm:true,breaks:true}));}
  catch{return `<p>${esc(source)}</p>`;}
}
