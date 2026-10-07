import test from 'node:test';
import assert from 'node:assert/strict';
import {renderChatMarkdown as render} from '../frontend/chat-markdown.js';
test('chat Markdown supports headings, inline styles, lists, quotes and tables',()=>{
 const html=render('# Title\n\n**bold** *italic* ~~old~~ `code`\n\n- first\n- second\n\n> quote\n\n| A | B |\n| --- | --- |\n| 1 | 2 |');
 for(const text of ['<h1>Title</h1>','<strong>bold</strong>','<em>italic</em>','<del>old</del>','<code>code</code>','<ul>','<blockquote>','<table>','<td>2</td>'])assert(html.includes(text),text);
});
test('untrusted HTML, unsafe links and images cannot execute or fetch',()=>{
 const html=render('<img src=x onerror=alert(1)>\n\n<script>alert(1)</script>\n\n[bad](javascript:alert%281%29) ![remote](https://example.com/track.png) [file](file:///etc/passwd) [data](data:text/html,bad)');
 assert(!/<(?:img|script|iframe|style)\b/i.test(html));assert(!/href=/.test(html));assert(html.includes('&lt;img'));assert(html.includes('[remote]'));
 const safe=render('[site](https://example.com/?q=%22)');assert(safe.includes('rel="noopener noreferrer"'));assert(safe.includes('https://example.com/'));
});
test('code and unfinished streaming Markdown remain safe and readable',()=>{
 assert.equal(render('```html\n<script>bad()</script>\n```'),'<pre><code>&lt;script&gt;bad()&lt;/script&gt;</code></pre>');
 for(const text of ['**partial','# Title\n\n```js\nconst x = 1;','[partial](https://'])assert.equal(typeof render(text),'string');
 assert(render('line one\nline two').includes('<br>'));
});
