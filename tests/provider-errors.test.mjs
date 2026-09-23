import test from 'node:test';
import assert from 'node:assert/strict';
import {formatProviderError} from '../backend/pi-service.mjs';
test('provider errors explain balance, credentials, permissions and rate limits',()=>{
 assert.match(formatProviderError(new Error('{"message":"Insufficient Balance","code":402}'),'deepseek','deepseek-flash').message,/HTTP 402.*余额不足/);
 assert.match(formatProviderError(new Error('401 Unauthorized'),'deepseek','flash').message,/API Key 无效/);
 assert.match(formatProviderError(new Error('{"message":"Forbidden","status":403}'),'qwen-api-cn','qwen-plus').message,/没有.*权限/);
 assert.match(formatProviderError(new Error('429 rate limit'),'kimi','k3').message,/过于频繁|限额/);
 assert(!formatProviderError(new Error('{"message":"Insufficient Balance","key":"secret"}'),'deepseek','flash').message.includes('secret'));
});
