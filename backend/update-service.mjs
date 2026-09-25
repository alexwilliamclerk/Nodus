import {createHash,randomUUID} from 'node:crypto';
import {createReadStream,createWriteStream} from 'node:fs';
import {chmod,mkdir,rename,stat,unlink} from 'node:fs/promises';
import path from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {releaseAssetName,legacyAssetName} from './release-names.mjs';

const REPO='alexwilliamclerk/Nodus';
const API=`https://api.github.com/repos/${REPO}/releases/latest`;
const MAX_INSTALLER_BYTES=650*1024*1024;
const MAX_METADATA_BYTES=1024*1024;
const PLATFORMS=new Set(['darwin','win32','linux']);
const candidateNames=(platform,tag)=>{
  if(typeof tag!=='string'||!/^v?\d+\.\d+\.\d+$/.test(tag))throw new Error('更新包版本无效');
  return [...(tag.startsWith('v')?[releaseAssetName(platform,tag)]:[]),legacyAssetName(platform)];
};
const versionParts=value=>{
  const match=/^v?(\d+)\.(\d+)\.(\d+)$/.exec(value||'');
  return match?.slice(1).map(Number)||null;
};

export function compareVersions(left,right){
  const a=versionParts(left),b=versionParts(right);
  if(!a||!b)throw new Error('无法识别发布版本号');
  for(let i=0;i<3;i++)if(a[i]!==b[i])return Math.sign(a[i]-b[i]);
  return 0;
}

function expectedUrl(tag,name){return `https://github.com/${REPO}/releases/download/${tag}/${name}`;}
function validAsset(asset,tag,name){
  return Boolean(asset)&&typeof name==='string'&&asset.name===name && asset.browser_download_url===expectedUrl(tag,name) &&
    Number.isSafeInteger(asset.size) && asset.size>0 && asset.size<=MAX_INSTALLER_BYTES;
}
async function responseText(response,limit){
  if(!response.ok)throw new Error(`GitHub 返回 HTTP ${response.status}`);
  const length=Number(response.headers.get('content-length'));
  if(length>limit)throw new Error('发布信息超过允许大小');
  const text=await response.text();
  if(Buffer.byteLength(text)>limit)throw new Error('发布信息超过允许大小');
  return text;
}
function githubResponse(response){
  const host=new URL(response.url).hostname;
  if(!['github.com','release-assets.githubusercontent.com','api.github.com'].includes(host))throw new Error('下载地址不是 GitHub 官方地址');
}

export async function checkForUpdate(currentVersion,platform,request=fetch){
  if(!PLATFORMS.has(platform))throw new Error('当前平台暂不支持自动检查更新');
  const response=await request(API,{headers:{Accept:'application/vnd.github+json','User-Agent':'Nodus-Updater'},signal:AbortSignal.timeout(15000)});
  githubResponse(response);
  const release=JSON.parse(await responseText(response,MAX_METADATA_BYTES));
  const tag=release.tag_name;
  if(release.draft||release.prerelease||!versionParts(tag))throw new Error('GitHub 最新发布信息无效');
  const latestVersion=tag.replace(/^v/,'');
  const comparison=compareVersions(latestVersion,currentVersion);
  const available=comparison>0;
  const asset=candidateNames(platform,tag).map(name=>release.assets?.find(item=>validAsset(item,tag,name))).find(Boolean);
  const assetName=asset?.name;
  const checksums=release.assets?.find(item=>item.name==='SHA256SUMS.txt');
  const downloadable=comparison>=0&&validAsset(asset,tag,assetName)&&validAsset(checksums,tag,'SHA256SUMS.txt');
  return {
    currentVersion,latestVersion,available,downloadable,platform,
    releaseUrl:`https://github.com/${REPO}/releases/tag/${tag}`,
    ...(downloadable?{tag,assetName,assetUrl:asset.browser_download_url,assetSize:asset.size,assetDigest:asset.digest||null,checksumUrl:checksums.browser_download_url}:{}),
  };
}

async function fileHash(file){
  const hash=createHash('sha256');
  for await(const chunk of createReadStream(file))hash.update(chunk);
  return hash.digest('hex');
}
export async function downloadUpdate(release,directory,{request=fetch,onProgress=()=>{}}={}){
  const expected=await expectedChecksum(release,request);
  const folder=path.join(directory,'Nodus-updates',release.tag);
  await mkdir(folder,{recursive:true});
  const target=path.join(folder,release.assetName);
  try{if(await fileHash(target)===expected)return {path:target,version:release.latestVersion,reused:true};}catch(error){if(error.code!=='ENOENT')throw error;}
  const partial=path.join(folder,`.${release.assetName}.${randomUUID()}.part`);
  try{
    const response=await request(release.assetUrl,{headers:{'User-Agent':'Nodus-Updater'},signal:AbortSignal.timeout(10*60*1000)});
    githubResponse(response);
    if(!response.ok||!response.body)throw new Error(`下载失败（HTTP ${response.status}）`);
    const reported=Number(response.headers.get('content-length'));
    if(reported&&reported!==release.assetSize)throw new Error('安装包大小与 GitHub 发布记录不一致');
    let received=0;
    const hash=createHash('sha256');
    const meter=new Transform({transform(chunk,_encoding,callback){
      received+=chunk.length;
      if(received>release.assetSize||received>MAX_INSTALLER_BYTES){callback(new Error('安装包超过预期大小'));return;}
      hash.update(chunk);onProgress({received,total:release.assetSize});callback(null,chunk);
    }});
    await pipeline(Readable.fromWeb(response.body),meter,createWriteStream(partial,{flags:'wx'}));
    if(received!==release.assetSize)throw new Error('安装包下载不完整');
    if(hash.digest('hex')!==expected)throw new Error('SHA-256 校验失败，安装包未保留');
    if(process.platform==='linux')await chmod(partial,0o755);
    await unlink(target).catch(error=>{if(error.code!=='ENOENT')throw error;});
    await rename(partial,target);
    return {path:target,version:release.latestVersion,reused:false};
  }catch(error){await unlink(partial).catch(()=>{});throw error;}
}
function validateReleaseAsset(release){
  if(!release.downloadable||!PLATFORMS.has(release.platform)||!candidateNames(release.platform,release.tag).includes(release.assetName)||!validAsset({name:release.assetName,browser_download_url:release.assetUrl,size:release.assetSize},release.tag,release.assetName)||release.checksumUrl!==expectedUrl(release.tag,'SHA256SUMS.txt'))throw new Error('更新包信息无效');
}
async function expectedChecksum(release,request){
  validateReleaseAsset(release);
  const checksumResponse=await request(release.checksumUrl,{headers:{'User-Agent':'Nodus-Updater'},signal:AbortSignal.timeout(15000)});
  githubResponse(checksumResponse);
  const checksumText=await responseText(checksumResponse,64*1024);
  const row=checksumText.split(/\r?\n/).map(line=>/^([a-fA-F0-9]{64})\s+\*?(.+)$/.exec(line)).find(match=>match?.[2]===release.assetName);
  if(!row)throw new Error('发布页缺少此安装包的 SHA-256 校验值');
  const expected=row[1].toLowerCase();
  if(release.assetDigest&&release.assetDigest!==`sha256:${expected}`)throw new Error('GitHub 安装包摘要与发布校验值不一致');
  return expected;
}
export async function verifyDownloadedUpdate(release,file,{request=fetch}={}){
  const expected=await expectedChecksum(release,request);
  const details=await stat(file);
  if(!details.isFile()||details.size!==release.assetSize)throw new Error('自动更新包大小与 GitHub 发布记录不一致');
  if(await fileHash(file)!==expected)throw new Error('自动更新包 SHA-256 校验失败');
  return {path:file,version:release.latestVersion};
}
