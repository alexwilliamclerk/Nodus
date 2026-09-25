import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {EventEmitter} from 'node:events';
import {mkdtemp,readFile,readdir,symlink,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {UpdateInstallService,preserveOldAppImage} from '../backend/update-install-service.mjs';

const name='Nodus-v1.5.0-Windows-x64.exe';
const root='https://github.com/alexwilliamclerk/Nodus/releases/download/v1.5.0/';
const bytes=Buffer.from('synthetic installer, never executed');
const hash=createHash('sha256').update(bytes).digest('hex');
const release={tag_name:'v1.5.0',draft:false,prerelease:false,assets:[
  {name,browser_download_url:root+name,size:bytes.length},
  {name:'SHA256SUMS.txt',browser_download_url:root+'SHA256SUMS.txt',size:100},
]};
const response=(url,value)=>({url,ok:true,status:200,headers:new Headers({'content-length':String(Buffer.byteLength(value))}),text:async()=>String(value),body:new Response(value).body});
const request=async url=>url.endsWith('SHA256SUMS.txt')?response(url,`${hash}  ${name}\n`):url.endsWith('.exe')?response(url,bytes):response(url,JSON.stringify(release));
class FakeUpdater extends EventEmitter{
  constructor(file){super();this.file=file;this.installCalls=[];this.metadata={version:'1.5.0',files:[{url:name}]};}
  async checkForUpdates(){return {updateInfo:this.metadata};}
  async downloadUpdate(){this.emit('download-progress',{transferred:bytes.length,total:bytes.length});return [this.file];}
  quitAndInstall(...args){this.installCalls.push(args);}
}

test('packaged Windows update downloads, verifies, then installs only after explicit action',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-auto-update-'));
  const file=path.join(dir,name);await writeFile(file,bytes);
  const updater=new FakeUpdater(file),progress=[];
  const service=new UpdateInstallService({platform:'win32',appVersion:'1.4.0',packaged:true,downloadsDir:dir,updater,request,onProgress:p=>progress.push(p)});
  const check=await service.check();assert.equal(check.installMode,'automatic');
  assert.equal(updater.autoDownload,false);assert.equal(updater.autoInstallOnAppQuit,false);
  assert.deepEqual(updater.installCalls,[]);
  await assert.rejects(service.installAutomatically(),/下载并校验/);
  assert.equal((await service.download()).installMode,'automatic');
  assert.deepEqual(progress.at(-1),{received:bytes.length,total:bytes.length});
  assert.deepEqual(updater.installCalls,[]);
  await service.installAutomatically();assert.deepEqual(updater.installCalls,[[true,true]]);
});

test('mismatched metadata falls back to guided installer; corrupt automatic download never installs',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-auto-update-bad-'));
  const file=path.join(dir,name);await writeFile(file,Buffer.alloc(bytes.length));
  const updater=new FakeUpdater(file);
  const service=new UpdateInstallService({platform:'win32',appVersion:'1.4.0',packaged:true,downloadsDir:dir,updater,request});
  await service.check();await assert.rejects(service.download(),/SHA-256/);assert.deepEqual(updater.installCalls,[]);
  updater.metadata={version:'1.5.1',files:[{url:name}]};
  const check=await service.check();assert.equal(check.installMode,'guided');assert.match(check.automaticUnavailableReason,/元数据/);
  assert.equal((await service.download()).installMode,'guided');
  await assert.rejects(service.installAutomatically(),/下载并校验/);
});

test('packaged Linux AppImage uses the same verified explicit install path',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-appimage-update-'));
  const linuxName='Nodus-v1.5.0-Linux-x86_64.AppImage';
  const file=path.join(dir,linuxName);await writeFile(file,bytes);
  const linuxRelease={...release,assets:[{name:linuxName,browser_download_url:root+linuxName,size:bytes.length},release.assets[1]]};
  const linuxRequest=async url=>url.endsWith('SHA256SUMS.txt')?response(url,`${hash}  ${linuxName}\n`):response(url,JSON.stringify(linuxRelease));
  const updater=new FakeUpdater(file);updater.metadata={version:'1.5.0',files:[{url:linuxName}]};
  const service=new UpdateInstallService({platform:'linux',appVersion:'1.4.0',packaged:true,downloadsDir:dir,updater,request:linuxRequest});
  assert.equal((await service.check()).installMode,'automatic');
  assert.equal((await service.download()).installMode,'automatic');
  await service.installAutomatically();assert.deepEqual(updater.installCalls,[[true,true]]);
});

test('Linux user can keep the old AppImage as an explicit program-file backup',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-appimage-choice-'));
  const linuxName='Nodus-v1.5.0-Linux-x86_64.AppImage';
  const file=path.join(dir,linuxName),old=path.join(dir,'Nodus-v1.4.0-Linux-x86_64.AppImage');
  await writeFile(file,bytes);await writeFile(old,'old program only');
  const linuxRelease={...release,assets:[{name:linuxName,browser_download_url:root+linuxName,size:bytes.length},release.assets[1]]};
  const linuxRequest=async url=>url.endsWith('SHA256SUMS.txt')?response(url,`${hash}  ${linuxName}\n`):response(url,JSON.stringify(linuxRelease));
  const updater=new FakeUpdater(file);updater.metadata={version:'1.5.0',files:[{url:linuxName}]};
  const service=new UpdateInstallService({platform:'linux',appVersion:'1.4.0',packaged:true,downloadsDir:dir,updater,request:linuxRequest,currentAppImage:old});
  await service.check();await service.download();await service.installAutomatically({removeOldProgram:false});
  const backups=(await readdir(dir)).filter(name=>name.startsWith('Nodus-backup-v1.4.0-'));
  assert.equal(backups.length,1);assert.equal(await readFile(path.join(dir,backups[0]),'utf8'),'old program only');
  assert.deepEqual(updater.installCalls,[[true,true]]);
  await assert.rejects(preserveOldAppImage(path.join(dir,'NotNodus.AppImage'),'1.4.0'),/无法确认/);
  const link=path.join(dir,'Nodus.AppImage');await symlink(old,link);
  await assert.rejects(preserveOldAppImage(link,'1.4.0'),/普通文件/);
});

test('installer is reverified immediately before replacing the running app',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-update-reverify-'));
  const file=path.join(dir,name);await writeFile(file,bytes);
  const updater=new FakeUpdater(file);
  const service=new UpdateInstallService({platform:'win32',appVersion:'1.4.0',packaged:true,downloadsDir:dir,updater,request});
  await service.check();await service.download();
  await writeFile(file,Buffer.alloc(bytes.length));
  await assert.rejects(service.installAutomatically(),/SHA-256/);
  assert.deepEqual(updater.installCalls,[]);
});

test('unpackaged development and macOS use guided installation',async()=>{
  const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-guided-update-'));
  for(const [platform,packaged] of [['win32',false],['darwin',true]]){
    const updater=new FakeUpdater('unused');
    const service=new UpdateInstallService({platform,appVersion:'1.4.0',packaged,downloadsDir:dir,updater,request});
    const check=await service.check();assert.equal(check.installMode,'guided');
  }
});
