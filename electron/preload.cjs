const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("forma", {
  platform: process.platform,
  onMenuCommand: listener => {
    const handler=(_event,command)=>listener(command);
    ipcRenderer.on('forma:menu-command',handler);
    return ()=>ipcRenderer.removeListener('forma:menu-command',handler);
  },
  getAppearance: () => ipcRenderer.invoke("forma:appearance"),
  onAppearance: listener => {
    const handler = (_event, appearance) => listener(appearance);
    ipcRenderer.on("forma:appearance", handler);
    return () => ipcRenderer.removeListener("forma:appearance", handler);
  },
  bootstrap: () => ipcRenderer.invoke("forma:bootstrap"),
  saveState: state => ipcRenderer.invoke("forma:save-state", state),
  exportBackup: () => ipcRenderer.invoke('forma:export-backup'),
  readClipboard: () => ipcRenderer.invoke('forma:read-clipboard'),
  chooseDeliveryDirectory: taskId=>ipcRenderer.invoke('forma:choose-delivery-directory',taskId),
  exportVersion: payload=>ipcRenderer.invoke('forma:export-version',payload),
  openVersionDirectory: payload=>ipcRenderer.invoke('forma:open-version-directory',payload),
  configureModel: config => ipcRenderer.invoke("forma:configure-model", config),
  restoreCredential: () => ipcRenderer.invoke('forma:restore-credential'),
  activateConnection: id => ipcRenderer.invoke('forma:activate-connection',id),
  removeConnection: id => ipcRenderer.invoke('forma:remove-connection',id),
  stopTask: payload => ipcRenderer.invoke("forma:stop-task", payload),
  disconnectModel: () => ipcRenderer.invoke("forma:disconnect-model"),
  openPlugins: () => ipcRenderer.invoke("forma:open-plugins"),
  selectMaterials: () => ipcRenderer.invoke("forma:select-materials"),
  importMaterial: payload => ipcRenderer.invoke("forma:import-material", payload),
  generateOptions: payload => ipcRenderer.invoke("forma:generate-options", payload),
  taskWorkspace: taskId => ipcRenderer.invoke('forma:task-workspace',taskId),
  nextDecision: payload => ipcRenderer.invoke('forma:next-decision',payload),
  oneShotChat: payload => ipcRenderer.invoke("forma:one-shot-chat", payload),
  classifyMessage: payload => ipcRenderer.invoke('forma:classify-message',payload),
  executeArtifact: payload => ipcRenderer.invoke("forma:execute-artifact", payload),
  executeGoat: payload => ipcRenderer.invoke('forma:execute-goat',payload),
  executeWebsite: payload => ipcRenderer.invoke("forma:execute-website", payload),
  proposeRevision: payload => ipcRenderer.invoke("forma:propose-revision", payload),
  executeRevision: payload => ipcRenderer.invoke("forma:execute-revision", payload),
  restoreVersion: payload => ipcRenderer.invoke("forma:restore-version", payload),
  onExecutionEvent: listener => {
    const handler = (_event, payload) => listener(payload);
    ipcRenderer.on("forma:execution-event", handler);
    return () => ipcRenderer.removeListener("forma:execution-event", handler);
  },
});
