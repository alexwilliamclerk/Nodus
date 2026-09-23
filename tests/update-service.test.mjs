import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,readdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {compareVersions,checkForUpdate,downloadUpdate} from '../backend/update-service.mjs';

const repo='https://github.com/alexwilliamclerk/Nodus/releases/download/v1.3.0/';
const name='Nodus-windows-x64.exe';
const bytes=Buffer.from('synthetic installer payload');
const digest=createHash('sha256').update(bytes).digest('hex');
const asset=(file,size)=>({name:file,size,browser_download_url:repo+file});
function mockResponse(url,content){
  const body=Buffer.isBuffer(content)?content:Buffer.from(content);
  return {url,ok:true,status:200,headers:new Headers({'content-length':String(body.length)}),text:async()=>body.toString(),body:new Response(body).body};
}
const release={tag_name:'v1.3.0',draft:false,prerelease:false,assets:[asset(name,bytes.length),asset('SHA256SUMS.txt',100)]};

test('update check compares semantic versions and selects only the matching platform asset',async()=>{
  assert.equal(compareVersions('1.3.0','1.2.9'),1);
  assert.equal(compareVersions('v1.2.0','1.2.0'),0);
  assert.equal(compareVersions('1.2.0','1.3.0'),-1);
  const request=async url=>mockResponse(url,JSON.stringify(release));
  const result=await checkForUpdate('1.2.0','win32',request);
  assert.equal(result.downloadable,true);
  assert.equal(result.assetName,name);
  const current=await checkForUpdate('1.3.0','win32',request);
  assert.equal(current.available,false);
  assert.equal(current.downloadable,true,'the current installer remains available to repair a broken local install');
  assert.equal((await checkForUpdate('1.2.0','darwin',request)).downloadable,false);
  await assert.rejects(()=>checkForUpdate('1.2.0','freebsd',request),/不支持/);
});

test('download verifies published checksum and size, and reuses a verified file',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'nodus-update-test-'));
  const info=await checkForUpdate('1.2.0','win32',async url=>mockResponse(url,JSON.stringify(release)));
  let downloads=0,progress=[];
  const request=async url=>{
    if(url.endsWith('SHA256SUMS.txt'))return mockResponse(url,`${digest}  ${name}\n`);
    downloads++;return mockResponse(url,bytes);
  };
  const first=await downloadUpdate(info,directory,{request,onProgress:value=>progress.push(value)});
  assert((await readFile(first.path)).equals(bytes));
  assert.equal(first.reused,false);
  assert.deepEqual(progress.at(-1),{received:bytes.length,total:bytes.length});
  const second=await downloadUpdate(info,directory,{request});
  assert.equal(second.reused,true);
  assert.equal(downloads,1);
});

test('corrupt downloads are rejected and no partial installer remains',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'nodus-update-bad-'));
  const info=await checkForUpdate('1.2.0','win32',async url=>mockResponse(url,JSON.stringify(release)));
  const wrong=Buffer.alloc(bytes.length,0);
  const request=async url=>url.endsWith('SHA256SUMS.txt')?mockResponse(url,`${digest}  ${name}\n`):mockResponse(url,wrong);
  await assert.rejects(()=>downloadUpdate(info,directory,{request}),/SHA-256/);
  assert.deepEqual(await readdir(path.join(directory,'Nodus-updates','v1.3.0')),[]);
});

test('GitHub asset digest must agree with the release checksum file',async()=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'nodus-update-digest-'));
  const info=await checkForUpdate('1.2.0','win32',async url=>mockResponse(url,JSON.stringify(release)));
  const request=async url=>url.endsWith('SHA256SUMS.txt')?mockResponse(url,`${digest}  ${name}\n`):mockResponse(url,bytes);
  await assert.rejects(()=>downloadUpdate({...info,assetDigest:`sha256:${'0'.repeat(64)}`},directory,{request}),/摘要/);
});
