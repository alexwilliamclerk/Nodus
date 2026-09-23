const endpoints={
  'moonshotai-cn':'https://api.moonshot.cn/v1',
  moonshotai:'https://api.moonshot.ai/v1',
};
export async function discoverMoonshotModels(providerId,apiKey,request=fetch) {
  const base=endpoints[providerId];if(!base)throw new Error('不是 Kimi 开放平台入口');
  let response;
  try {response=await request(`${base}/models`,{headers:{Authorization:`Bearer ${apiKey.trim()}`},redirect:'error',signal:AbortSignal.timeout(15000)});}
  catch {throw new Error(`无法访问 ${base}/models，请检查网络连接。`);}
  if(!response.ok)throw new Error(response.status===401
    ?`Kimi 开放平台 ${base}/models 返回 401：该端点未接受此 Key。请核对创建 Key 的站点与完整密钥；platform.kimi.com 对应中国入口，platform.kimi.ai 对应全球入口。不要改选 Kimi Coding Plan。`
    :`Kimi 开放平台模型查询失败（HTTP ${response.status}），端点：${base}/models。`);
  const body=await response.json();
  if(!Array.isArray(body.data))throw new Error('Kimi 模型列表格式无效');
  const ids=body.data.map(item=>item?.id).filter(id=>typeof id==='string'&&id.trim());
  if(!ids.length)throw new Error('此 Key 返回的模型列表为空，请检查账户模型权限');
  return ids;
}
export function selectMoonshotModel(available,ids,modelId) {
  const supported=available.filter(model=>ids.includes(model.id));
  if(modelId&&!ids.includes(modelId))throw new Error(`账户模型列表未包含 ${modelId}。可用模型：${ids.join('、')}`);
  const selected=modelId?supported.find(m=>m.id===modelId):supported.find(m=>m.id==='kimi-k3')||supported[0];
  if(!selected)throw new Error(`账户模型尚未被当前 SDK 适配：${ids.join('、')}。不会静默换用其他模型。`);
  return {selected,supported};
}
