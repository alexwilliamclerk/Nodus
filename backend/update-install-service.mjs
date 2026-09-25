import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {constants as fsConstants} from 'node:fs';
import {chmod,copyFile,lstat} from 'node:fs/promises';
import {checkForUpdate,downloadUpdate,verifyDownloadedUpdate} from './update-service.mjs';

const installerName=value=>{
  try{return decodeURIComponent(path.posix.basename(new URL(value,'https://github.com').pathname));}
  catch{return '';}
};
export async function preserveOldAppImage(file,currentVersion){
  if(!file||!/^Nodus(?:-v\d+\.\d+\.\d+-Linux-x86_64|-linux-x64)?\.AppImage$/.test(path.basename(file))||!/^\d+\.\d+\.\d+$/.test(currentVersion))throw new Error('无法确认当前 AppImage 文件，旧版未清理');
  const info=await lstat(file);
  if(!info.isFile()||info.isSymbolicLink())throw new Error('当前 AppImage 不是普通文件，旧版未清理');
  const backup=path.join(path.dirname(file),`Nodus-backup-v${currentVersion}-${randomUUID().slice(0,8)}.AppImage`);
  await copyFile(file,backup,fsConstants.COPYFILE_EXCL);
  await chmod(backup,info.mode);
  return backup;
}

export class UpdateInstallService {
  constructor({platform,appVersion,packaged,downloadsDir,updater=null,request=fetch,onProgress=()=>{},currentAppImage=process.env.APPIMAGE}){
    this.platform=platform;this.appVersion=appVersion;this.packaged=packaged;this.downloadsDir=downloadsDir;
    this.updater=updater;this.request=request;this.onProgress=onProgress;
    this.currentAppImage=currentAppImage;
    this.release=null;this.downloaded=null;this.installMode='guided';this.automaticUnavailableReason=null;
    if(updater){
      updater.autoDownload=false;
      updater.autoInstallOnAppQuit=false;
      updater.on('download-progress',progress=>onProgress({received:progress.transferred,total:progress.total}));
    }
  }
  async check(){
    this.release=null;this.downloaded=null;this.installMode='guided';this.automaticUnavailableReason=null;
    this.release=await checkForUpdate(this.appVersion,this.platform,this.request);
    if(this.release.available&&this.release.downloadable&&this.packaged&&['win32','linux'].includes(this.platform)&&this.updater){
      try{
        const result=await this.updater.checkForUpdates();
        const info=result?.updateInfo;
        if(info?.version!==this.release.latestVersion||!info.files?.some(file=>installerName(file.url||file.path)===this.release.assetName))throw new Error('自动更新元数据与已校验发布版本不一致');
        this.installMode='automatic';
      }catch(error){this.automaticUnavailableReason=error.message;}
    }
    return {...this.release,installMode:this.installMode,automaticUnavailableReason:this.automaticUnavailableReason};
  }
  async download(){
    if(!this.release?.downloadable)throw new Error('请先检查更新');
    this.downloaded=null;
    if(this.installMode==='automatic'){
      const files=await this.updater.downloadUpdate();
      if(!Array.isArray(files)||!files.length)throw new Error('自动更新器未返回安装包');
      let failure=null;
      for(const file of [...files].sort((a,b)=>Number(installerName(b)===this.release.assetName)-Number(installerName(a)===this.release.assetName))){
        try{
          const verified=await verifyDownloadedUpdate(this.release,file,{request:this.request});
          this.downloaded={...verified,installMode:'automatic'};
          return {version:verified.version,installMode:'automatic',reused:false};
        }catch(error){failure=error;}
      }
      throw failure||new Error('自动更新包校验失败');
    }
    const result=await downloadUpdate(this.release,this.downloadsDir,{request:this.request,onProgress:this.onProgress});
    this.downloaded={...result,installMode:'guided'};
    return {version:result.version,installMode:'guided',reused:result.reused};
  }
  async installAutomatically({removeOldProgram=true}={}){
    if(!this.downloaded||this.downloaded.installMode!=='automatic'||this.downloaded.version!==this.release?.latestVersion)throw new Error('请先下载并校验自动更新包');
    await verifyDownloadedUpdate(this.release,this.downloaded.path,{request:this.request});
    if(this.platform==='linux'&&!removeOldProgram)await preserveOldAppImage(this.currentAppImage,this.appVersion);
    this.updater.quitAndInstall(true,true);
  }
}
