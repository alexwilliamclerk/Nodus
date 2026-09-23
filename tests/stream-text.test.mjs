import test from 'node:test';
import assert from 'node:assert/strict';
import {readableStream} from '../backend/stream-text.mjs';
test('partial structured response shows content before JSON completion without protocol keys',()=>{
 assert.equal(readableStream('{"artifactType":"report","deliverySummary":"报告先','options'),'报告先');
 assert.equal(readableStream('{"options":[{"id":"a","title":"方向一","description":"先检查','options'),'方向一\n\n先检查');
});
test('escaped strings and incomplete escapes do not leak JSON formatting',()=>{
 assert.equal(readableStream('{"clarification":"需要\\n资料\\u4','options'),'需要\n资料');
 assert.equal(readableStream(JSON.stringify({clarification:'引号 "内容"'}),'options'),'引号 "内容"');
 assert.equal(readableStream('{"scope":"修改标题","preserve":"保持配色"}','revision-analysis'),'修改标题\n\n保持配色');
});
test('free text streams unchanged and response text is not treated as markup',()=>{
 assert.equal(readableStream('<script>示例</script>','chat'),'<script>示例</script>');
});
test('internal audit protocol and file evidence never stream into conversation',()=>{
 const raw=JSON.stringify({results:[{id:'req-123',status:'supported',evidence:[{file:'index.html',quote:'<h1>作品</h1>'}]}]});
 for(const text of [raw.slice(0,25),raw])assert.equal(readableStream(text,'requirement-audit'),'');
});
