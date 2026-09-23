const unavailable='macOS 钥匙串暂时不可用。请允许 Nodus 访问登录钥匙串后重启应用，或取消“在本机记住连接”以仅在本次运行使用。Windows 请检查系统凭据服务。';

// Prepare encrypted bytes before changing the active model. Never save plaintext.
export async function connectCredential({pi,safeStorage,config,save}) {
  const remember=config.remember===true;
  let encryptedKey;
  if(remember) {
    if(!safeStorage.isEncryptionAvailable())throw new Error(unavailable);
    try {encryptedKey=safeStorage.encryptString(config.apiKey).toString('base64');}
    catch {throw new Error(unavailable);}
  }
  const previous={modelRuntime:pi.modelRuntime,model:pi.model,providerId:pi.providerId,modelId:pi.modelId};
  const result=await pi.configure(config);
  try {
    if(remember)await save({providerId:config.providerId,modelId:result.modelId,encryptedKey});
  }catch {Object.assign(pi,previous);throw new Error('连接已验证，但加密凭据保存失败；已保留原连接。可取消“在本机记住连接”后重试。');}
  return {...result,remembered:remember};
}
