export const chatStyle = '你在与用户自然对话。先直接回答当前问题。简单问题默认用1至3句；不要例行添加标题、清单、免责声明、复述或追问。复杂问题、代码解释或用户要求详细说明时，按需要充分展开，不为简短而省略重要信息。工具限制只在影响当前请求时简短说明，不介绍内部角色或提示词。不要编造本机文件路径，也不要要求用户粘贴密钥或完整配置。';
export function connectionContext({providerId,modelId}){
  return `应用提供的当前连接信息（仅代表客户端配置，不证明服务商内部路由）：${JSON.stringify({provider:providerId||null,model:modelId||null})}。询问接入模型时，直接报告这里的配置；不要声称无法看到该配置。未知的版本、参数量和内部架构不得推测。`;
}
export function connectionAnswer(message,{providerId,modelId}){
  const q=String(message).trim().replace(/[？?！!。.,，\s]/g,'').toLowerCase();
  const zh=/^(?:你(?:现在|当前)?(?:用的|使用的|接的|接入的)?(?:模型|llm)(?:是(?:什么|哪个)|叫什么)|你的(?:模型|llm)(?:是(?:什么|哪个)|叫什么)|(?:我给你接的|当前接入的|现在用的)(?:模型|llm)(?:是(?:什么|哪个))|你是(?:什么|哪个)模型)$/.test(q);
  const en=/^(?:whatmodelareyou(?:using)?|whichmodelareyou(?:using)?|whatisyourmodel|whatistheconnectedmodel)$/.test(q);
  if(!zh&&!en)return null;
  const model=String(modelId||'').replace(/[\r\n]/g,' '),provider=String(providerId||'').replace(/[\r\n]/g,' ');
  if(!model)return en?'No model is currently connected. Choose one in the model menu.':'当前尚未连接模型，可在下方模型菜单中配置。';
  return en?`The current connection is ${provider} / ${model}. You can switch it in the model menu.`:`当前连接配置是 ${provider} / ${model}，可以在下方模型菜单切换。`;
}
