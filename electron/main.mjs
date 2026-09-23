import { app, BrowserWindow, ipcMain, safeStorage, shell, dialog, nativeTheme, Menu, clipboard } from "electron";
import {applicationMenu} from './application-menu.mjs';
import { createServer } from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readMaterial, readMaterialBytes } from "../backend/materials.mjs";
import { loadCompletion } from '../backend/completion.mjs';
import { ModelConnections } from '../backend/model-connections.mjs';
import {pendingWorkspace,pendingContext} from '../backend/task-workspace.mjs';
import {exportBackup} from '../backend/backup.mjs';
import {previewPath} from '../backend/preview-path.mjs';
import {executeGoat} from '../backend/goat-service.mjs';
import {exportVersion,validateDeliveryDirectory} from '../backend/delivery-service.mjs';
import { PiService } from "../backend/pi-service.mjs";
import { StorageService } from "../backend/storage.mjs";

import { ArtifactService, readArtifact, withVersionContext, artifactUrl as previewUrl } from "../backend/artifact-service.mjs";

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let mainWindow;
let storage;
let pi;
let connections;
let previewServer;
let previewOrigin;
let bootstrapped=false;
let backupBusy=false;
let quitting=false;
const deliveryDirectories=new Map();

app.setName("Nodus");
configureUserDataPath();

app.whenReady().then(async () => {
  const dataDir = process.env.NODUS_DATA_DIR || process.env.FORMA_DATA_DIR || path.join(app.getPath("userData"), "forma-data");
  storage = new StorageService(dataDir);
  await storage.initialize();
  const savedState = await storage.loadState();
  nativeTheme.themeSource = ['light','dark','system'].includes(savedState.settings?.theme) ? savedState.settings.theme : 'light';
  pi = new PiService({
    piDir: storage.piDir,
    emit: (taskId, event) => mainWindow?.webContents.send("forma:execution-event", { taskId, event }),
  });
  await pi.initialize();
  connections=new ModelConnections(pi,safeStorage,storage.credentialPath);
  // macOS Keychain access must be user initiated, including existing credentials.
  if(process.platform!=='darwin')await restoreCredential();
  previewOrigin = await startPreviewServer();
  registerIpc();
  createWindow();
  Menu.setApplicationMenu(Menu.buildFromTemplate(applicationMenu(process.platform,command=>{
    if(!mainWindow||mainWindow.isDestroyed())return;
    mainWindow.show();mainWindow.focus();mainWindow.webContents.send('forma:menu-command',command);
  })));
});

function configureUserDataPath() {
  if (process.env.NODUS_DATA_DIR || process.env.FORMA_DATA_DIR) return;
  const appData = app.getPath("appData");
  const nodusDir = path.join(appData, "Nodus");
  const legacyDir = path.join(appData, "forma-agent-workspace");
  const hasData = directory => existsSync(path.join(directory, "forma-data", "state.json")) || existsSync(path.join(directory, "forma-data", "credentials.json"));
  if (hasData(nodusDir)) {
    app.setPath("userData", nodusDir);
    return;
  }
  if (hasData(legacyDir)) {
    app.setPath("userData", legacyDir);
    return;
  }
  mkdirSync(nodusDir, { recursive: true });
  app.setPath("userData", nodusDir);
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {quitting=true;previewServer?.close();});
app.on("activate", () => {
  if(mainWindow&&!mainWindow.isDestroyed()){mainWindow.show();mainWindow.focus();}
  else if (storage && previewOrigin && BrowserWindow.getAllWindows().length === 0) createWindow();
});

function windowAppearance() {
  return {
    platform: process.platform,
    dark: nativeTheme.shouldUseDarkColors,
    reducedTransparency: nativeTheme.prefersReducedTransparency,
    increasedContrast: nativeTheme.shouldUseHighContrastColors,
    focused: mainWindow?.isFocused() ?? true,
  };
}

function syncWindowAppearance() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const appearance = windowAppearance();
  if (process.platform === "darwin") {
    const opaque = appearance.reducedTransparency || appearance.increasedContrast;
    mainWindow.setVibrancy(opaque ? null : "under-window");
    mainWindow.setBackgroundColor(opaque ? (appearance.dark ? "#171c24" : "#fffcfa") : "#00000000");
  } else {
    mainWindow.setBackgroundColor(appearance.dark ? "#171c24" : "#fffcfa");
  }
  mainWindow.webContents.send("forma:appearance", appearance);
}
nativeTheme.on("updated", syncWindowAppearance);

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#171c24" : "#fffcfa",
    ...(process.platform === "darwin" ? {
      titleBarStyle: "hiddenInset",
      trafficLightPosition: { x: 20, y: 20 },
      vibrancy: "under-window",
      visualEffectState: "followWindow",
      backgroundColor: "#00000000",
    } : {}),
    webPreferences: {
      preload: path.join(rootDir, "electron", "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  mainWindow.on("focus", syncWindowAppearance);
  // Keep the renderer's pending IPC callbacks alive when closing a macOS window.
  mainWindow.on('close',event=>{if(process.platform==='darwin'&&!quitting){event.preventDefault();mainWindow.hide();}});
  mainWindow.on("blur", syncWindowAppearance);
  mainWindow.webContents.on("did-finish-load", syncWindowAppearance);
  mainWindow.on("closed", () => { mainWindow = null; });
  syncWindowAppearance();
  mainWindow.loadFile(path.join(rootDir, "index.html"));
}

function registerIpc() {
  ipcMain.handle('forma:read-clipboard',()=>clipboard.readText());
  ipcMain.handle('forma:choose-delivery-directory',async(_event,taskId)=>{
    const selection=await dialog.showOpenDialog(mainWindow,{title:'选择作品交付目录',properties:['openDirectory','createDirectory']});
    if(selection.canceled||!selection.filePaths.length)return {canceled:true};
    const directory=await validateDeliveryDirectory(storage,selection.filePaths[0]);deliveryDirectories.set(taskId,directory);return {directory};
  });
  ipcMain.handle('forma:export-version',async(_event,{taskId,versionId})=>{
    const task=(await storage.loadState()).tasks.find(t=>t.id===taskId);
    if(!task?.versions?.some(v=>v.id===versionId))throw new Error('只能导出已生成的作品版本');
    const selection=await dialog.showOpenDialog(mainWindow,{title:'导出作品到文件夹',properties:['openDirectory','createDirectory']});
    if(selection.canceled||!selection.filePaths.length)return {canceled:true};
    return exportVersion(storage,{taskId,versionId,directory:selection.filePaths[0]});
  });
  ipcMain.handle('forma:open-version-directory',async(_event,{taskId,versionId})=>{
    const task=(await storage.loadState()).tasks.find(t=>t.id===taskId),version=task?.versions?.find(v=>v.id===versionId);
    if(!version)throw new Error('作品版本不存在');
    const directory=version.delivery?.directory||storage.versionDir(taskId,versionId);
    const error=await shell.openPath(directory);if(error)throw new Error(`无法打开目录：${error}`);return {directory};
  });
  ipcMain.handle('forma:export-backup',async()=>{
    if(backupBusy||pi.activeRuns.size)throw new Error('请等待当前操作结束，再导出备份');
    backupBusy=true;
    try{
      const selection=await dialog.showSaveDialog(mainWindow,{title:'备份对话并导出',defaultPath:path.join(app.getPath('downloads'),`Nodus-备份-${new Date().toISOString().replace(/[:.]/g,'-')}.zip`),filters:[{name:'ZIP 备份',extensions:['zip']}]});
      if(selection.canceled||!selection.filePath)return {canceled:true};
      return await exportBackup(storage,selection.filePath,{version:app.getVersion()});
    }finally{backupBusy=false;}
  });
  ipcMain.handle('forma:task-workspace',async(_event,taskId)=>{const p=await pendingWorkspace(storage,taskId);return p?{pendingId:p.pendingId,baseVersionId:p.baseVersionId,artifactType:p.task.artifactType}:null;});
  ipcMain.handle('forma:next-decision',async(_event,{task,flow})=>{
    const context=flow.pendingId?await pendingContext(storage,task):await withVersionContext(storage,task,flow.baseVersionId);
    return pi.nextDecision(context,flow);
  });
  ipcMain.handle('forma:restore-credential',async()=>{
    if(pi.activeRuns.size)throw new Error('请先停止正在运行的任务');
    return restoreCredential(true);
  });
  ipcMain.handle('forma:activate-connection',(_event,id)=>connections.activate(id));
  ipcMain.handle('forma:remove-connection',(_event,id)=>connections.remove(id));
  ipcMain.handle("forma:appearance", () => windowAppearance());
  ipcMain.handle("forma:set-theme", (_event, theme) => {
    if(!['light','dark','system'].includes(theme))throw new Error('无效的主题设置');
    nativeTheme.themeSource = theme;
    syncWindowAppearance();
    return windowAppearance();
  });
  ipcMain.handle("forma:bootstrap", async () => {
    const state = await storage.loadState();
    for (const task of state.tasks) {
      if(!bootstrapped&&task.operation?.status==='running'){
        task.operation.status='stopped';task.operation.lastActivity='上次运行已中断，文件与选择已保留。';
        task.stage='error';task.error={title:'运行已中断',message:task.operation.lastActivity};
      }
      if (task.stage === "executing" || task.stage === "loading-options" || task.stage === "loading-revision") {
        task.stage = "error";
        task.status = "已中断";
        task.lastAction ||= task.versions?.length ? "revision" : "options";
        task.error = { title: "上次执行已中断", message: "应用在该步骤完成前退出。已有版本和部分执行文件均已保留，可返回后重试。" };
        if (task.operation?.status === "running") {
          task.operation.status = "stopped";
          task.operation.endedAt = new Date().toISOString();
          task.operation.lastActivity = "应用退出前操作未完成";
          task.operation.lastActivityAt = task.operation.endedAt;
        }
      }
      for (const version of task.versions || []) {
        try {version.completion=await loadCompletion(storage,task.id,version.id);}
        catch {version.completion={versionId:version.id,status:'unreadable',results:[{text:'完成记录不可读取',status:'unverified',detail:'原始记录已保留；此版本的完成条件无法确认，不能视为验证通过。'}]};}
        try { version.artifact=await readArtifact(storage.versionDir(task.id,version.id)); version.previewUrl=artifactUrl(task.id,version.id,version.artifact); }
        catch(error) { version.previewUrl=null;version.previewError=error.message; }
      }
      if (!Object.hasOwn(task,'artifactType')) task.artifactType=task.versions?.length ? (task.versions.find(v=>v.id===task.currentVersionId)?.artifact?.type || 'website') : task.options?.length ? 'website' : null;
    }
    await storage.saveState(state);
    bootstrapped=true;
    return { state, model: connections.status(), previewOrigin, desktop: true };
  });
  ipcMain.handle("forma:save-state", async (_event, state) => storage.saveState(state));
  ipcMain.handle("forma:stop-task", (_event, { taskId }) => {artifacts.cancel(taskId);return pi.stop(taskId);});
  ipcMain.handle("forma:disconnect-model", async () => {
    if(connections.activeId)return connections.remove(connections.activeId);
    await pi.disconnect();
    try { await unlink(storage.credentialPath); } catch (error) { if (error.code !== "ENOENT") throw error; }
    return pi.status();
  });
  ipcMain.handle("forma:open-plugins", async () => {
    const url = "https://www.npmjs.com/search?q=keywords%3Api-package";
    await shell.openExternal(url);
    return { url };
  });
  ipcMain.handle("forma:select-materials", async () => {
    const selection = await dialog.showOpenDialog(mainWindow, { title: "添加任务材料", properties: ["openFile", "multiSelections"] });
    if (selection.canceled) return [];
    return Promise.all(selection.filePaths.map(readMaterial));
  });
  ipcMain.handle("forma:import-material", (_event, { name, bytes }) => readMaterialBytes(name, bytes));
  ipcMain.handle("forma:configure-model", async (_event, config) => {
    return connections.add(config);
  });
  ipcMain.handle("forma:generate-options", (_event, { task, previousOptions }) => pi.generateOptions(task, previousOptions));
  ipcMain.handle("forma:one-shot-chat", async (_event, { task, message }) => pi.oneShotChat(await withVersionContext(storage,task), message));
  ipcMain.handle('forma:classify-message',(_event,{task,message})=>pi.classifyMessage(task,message));
  ipcMain.handle("forma:propose-revision", async (_event, { task, evaluation }) => pi.proposeRevision(await withVersionContext(storage,task,evaluation.versionId), evaluation));
  const artifacts=new ArtifactService(storage,pi);
  const deliver=async(taskId,versionId,result)=>{
    const task=(await storage.loadState()).tasks.find(t=>t.id===taskId);
    const directory=deliveryDirectories.get(taskId)||task?.deliveryDirectory;
    if(!directory)return result;
    try{return {...result,delivery:await exportVersion(storage,{taskId,versionId,directory})};}
    catch(error){return {...result,deliveryError:error.message};}
  };
  const execute=async payload=>{
    if(backupBusy)throw new Error('正在导出备份，请稍后执行');
    const result=await artifacts.execute(payload);
    return {...await deliver(payload.task.id,payload.versionId,result),previewUrl:artifactUrl(payload.task.id,payload.versionId,result.artifact)};
  };
  ipcMain.handle("forma:execute-artifact",(_event,payload)=>execute(payload));
  ipcMain.handle('forma:execute-goat',async(_event,payload)=>{
    if(backupBusy)throw new Error('正在导出备份，请稍后执行');
    const result=await executeGoat(artifacts,payload);
    return {...await deliver(payload.task.id,payload.versionId,result),previewUrl:artifactUrl(payload.task.id,payload.versionId,result.artifact)};
  });
  ipcMain.handle("forma:execute-website",(_event,payload)=>execute({...payload,task:{...payload.task,artifactType:'website'}}));
  ipcMain.handle("forma:execute-revision",(_event,payload)=>execute(payload));
  ipcMain.handle("forma:restore-version",async (_event,payload)=>{
    if(backupBusy)throw new Error('正在导出备份，请稍后恢复版本');
    const result=await artifacts.restore(payload);
    return {...await deliver(payload.taskId,payload.versionId,result),previewUrl:artifactUrl(payload.taskId,payload.versionId,result.artifact)};
  });
}

async function restoreCredential(explicit=false) {
  try {
    return await connections.restore();
  } catch (error) {
    if(explicit)throw new Error(error.code==='ENOENT'?'没有已保存的连接，请填写 API Key。':'无法恢复已保存连接。可拒绝系统授权，直接填写 API Key，仅在本次运行使用。');
    if (error.code !== "ENOENT") console.warn("Stored model credential is not active:", error.message);
  }
}

function artifactUrl(taskId, versionId, artifact) { return previewUrl(previewOrigin,taskId,versionId,artifact); }

function startPreviewServer() {
  return new Promise((resolve, reject) => {
    previewServer = createServer(async (request, response) => {
      try {
        const requested = await previewPath(storage,request.url);
        const body = await readFile(requested);
        response.setHeader("Content-Type", contentType(requested));
        response.setHeader("Cache-Control", "no-store");
        response.end(body);
      } catch (error) {
        response.statusCode = 404;
        response.end("Artifact not found");
      }
    });
    previewServer.once("error", reject);
    previewServer.listen(0, "127.0.0.1", () => {
      const address = previewServer.address();
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return ({
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".md": "text/plain; charset=utf-8",
    ".py": "text/plain; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  })[extension] || "application/octet-stream";
}
