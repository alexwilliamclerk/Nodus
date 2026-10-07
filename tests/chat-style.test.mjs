import test from 'node:test';import assert from 'node:assert/strict';
import {connectionAnswer,connectionContext,chatStyle} from '../backend/chat-style.mjs';
import {PiService} from '../backend/pi-service.mjs';
test('model identity is answered from current connection, without calling or guessing a model',async()=>{
 const service={providerId:'deepseek',modelId:'configured-model',requireModel(){},runText(){throw Error('Unexpected model call');}};
 for(const q of ['你的 llm 是什么？','我给你接的模型是什么','你是什么模型','what model are you using?'])assert.match(await PiService.prototype.oneShotChat.call(service,{id:'test'},q),/configured-model/);
 assert.equal(connectionAnswer('比较你的模型和其他模型有什么区别',service),null);
 assert.equal(connectionAnswer('你是什么模型？请详细解释推理能力',service),null);
});
test('connection context excludes credentials and instructions preserve detailed answers when requested',()=>{
 const text=connectionContext({providerId:'p',modelId:'m',apiKey:'secret',baseUrl:'private'});assert(!text.includes('secret'));assert(!text.includes('private'));assert.match(chatStyle,/用户要求详细/);assert.match(chatStyle,/1至3句/);
});
