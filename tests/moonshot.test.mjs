import test from 'node:test';
import assert from 'node:assert/strict';
import {discoverMoonshotModels,selectMoonshotModel} from '../backend/moonshot-models.mjs';
test('open-platform discovery uses regional endpoint and Bearer authentication',async()=>{
  for(const [provider,host] of [['moonshotai-cn','api.moonshot.cn'],['moonshotai','api.moonshot.ai']]) {
    const ids=await discoverMoonshotModels(provider,' test-placeholder ',async(url,options)=>{
      assert.equal(url,`https://${host}/v1/models`);assert.equal(options.headers.Authorization,'Bearer test-placeholder');
      assert.equal(options.redirect,'error');return {ok:true,json:async()=>({data:[{id:'kimi-k3'}]})};
    });assert.deepEqual(ids,['kimi-k3']);
  }
});
test('default selection is constrained to actual account models, preferring K3',()=>{
  const models=[{id:'old'},{id:'kimi-k3'}];
  assert.equal(selectMoonshotModel(models,['kimi-k3']).selected.id,'kimi-k3');
  assert.throws(()=>selectMoonshotModel(models,['kimi-k3'],'old'),/未包含/);
  assert.throws(()=>selectMoonshotModel(models,['future-model']),/尚未被当前 SDK 适配/);
});
test('401 never forwards secret-bearing server text or switches to Coding',async()=>{
  await assert.rejects(discoverMoonshotModels('moonshotai-cn','test-placeholder',async()=>({ok:false,status:401})),/不要改选 Kimi Coding/);
});
