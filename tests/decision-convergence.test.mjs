import test from 'node:test';
import assert from 'node:assert/strict';
import {isExecutionRequest,prepareFlowConfirmation,localNode,emptyAnswer,confirmedFlow,backDecision,commitDecision} from '../frontend/decision-flow.js';
import {PiService} from '../backend/pi-service.mjs';
import {readableStream} from '../backend/stream-text.mjs';
import {buildRequirementLedger,requirementContext} from '../frontend/requirements.js';
import {validateRequirementAudit} from '../backend/requirement-audit.mjs';
test('requirement ledger keeps confirmed choices and accepts only grounded audit evidence',()=>{
 const task={requirement:'制作网站；不要使用外部资源',artifactType:'website',options:[{id:'a',title:'简洁布局',description:'保留清晰层级'}],selectedOptionIds:['a'],optionNotes:{a:'只改排版'},freeform:'不要改动文案',completionContract:{conditions:[{kind:'manual',text:'页面可阅读'}]}};
 const ledger=buildRequirementLedger(task);assert.equal(ledger.items.length,4);assert.match(requirementContext(ledger),/不要改动文案/);
 const snapshot={files:[{file:'index.html',content:'<h1>清晰层级</h1>'}],truncated:false};
 const audit=validateRequirementAudit({results:ledger.items.map((item,index)=>({id:item.id,status:index?'unverified':'supported',reason:'evidence',evidence:index?[ ]:[{file:'index.html',quote:'清晰层级'}]}))},ledger,snapshot);
 assert.equal(audit.results[0].status,'supported');assert.equal(audit.results[1].status,'unverified');assert.equal(audit.status,'needs_review');
});
test('semantic message routing is typed and read-only; malformed intent cannot authorize execution',async()=>{
 const pi=new PiService({piDir:'.',emit:()=>{}});pi.model={id:'mock'};let request;
 pi.runText=async args=>{request=args;return '{"intent":"execute"}';};
 for(const [type,message] of [['website','把标题改成红色'],['python','implement it now'],['report','整理成报告'],['presentation','把这部分做成幻灯片'],['analysis','用新数据重新计算']]){
  assert.equal((await pi.classifyMessage({id:'task',artifactType:type,requirement:'task'},message)).intent,'execute');
  assert.deepEqual(request.tools,[]);assert(request.prompt.includes(message));assert(request.prompt.includes(type));
 }
 pi.runText=async()=>'{"intent":"chat"}';assert.equal((await pi.classifyMessage({id:'task'},'先别改，解释一下')).intent,'chat');
 pi.runText=async args=>{request=args;return '{"intent":"answer"}';};
 assert.equal((await pi.classifyMessage({id:'task',stage:'decision',decisionFlow:{current:{question:'选择排版'},history:[]},temporaryConversations:[{message:'之前的讨论',reply:'回答'}]},'第二个')).intent,'answer');
 assert.match(request.prompt,/选择排版/);assert.match(request.prompt,/之前的讨论/);assert(!request.system.includes('之前的讨论'));assert.deepEqual(request.tools,[]);
 const question=localNode('area','website');
 pi.runText=async()=>'{"intent":"answer","selectedOptionIds":["interaction","content"]}';
 assert.deepEqual((await pi.classifyMessage({id:'task',decisionFlow:{current:question}},'第二个和第三个')).selectedOptionIds,['interaction','content']);
 pi.runText=async()=>'{"intent":"answer","selectedOptionIds":["nonexistent"]}';await assert.rejects(pi.classifyMessage({id:'task',decisionFlow:{current:question}},'x'));
 pi.runText=async()=>'{"intent":"answer","selectedOptionIds":["continue","adjust"]}';await assert.rejects(pi.classifyMessage({id:'task',decisionFlow:{current:localNode('pause')}},'两个都要'));
 pi.runText=async()=>'{"intent":"unknown"}';await assert.rejects(pi.classifyMessage({id:'task'},'x'));
 assert.equal(readableStream('{"intent":"execute"}','intent'),'');
});
test('explicit coding instructions route to confirmation, not read-only questions',()=>{
 for(const message of ['就按照这个编码吧','直接修改代码','请开始编码','按照已选方案执行','直接写代码'])assert(isExecutionRequest(message),message);
 for(const message of ['不要直接编码','能不能直接修改代码？','解释如何写代码','请给我示例代码','我不知道怎么编码'])assert(!isExecutionRequest(message),message);
});
test('long paths converge without losing decisions and still require confirmation',()=>{
 const f={artifactType:'website',schemaVersion:3,history:[],invalidated:[],current:localNode('area','website'),draft:emptyAnswer()};
 for(let i=0;i<40;i++){f.draft={...emptyAnswer(),selectedOptionIds:['visual'],optionNotes:{visual:`requirement-${i}`}};commitDecision(f);}
 prepareFlowConfirmation(f,'就按照这个编码吧');assert.equal(f.history.length,40);assert.equal(f.current.kind,'confirm');assert.throws(()=>confirmedFlow(f));
 f.status='confirmed';f.draft.selectedOptionIds=['execute'];const proposal=confirmedFlow(f);assert.equal(proposal.decisions.length,40);assert.match(JSON.stringify(proposal),/requirement-39/);
 backDecision(f);assert.equal(f.history.length,39);assert.equal(f.draft.optionNotes.visual,'requirement-39');assert.throws(()=>confirmedFlow(f));
});
