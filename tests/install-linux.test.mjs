import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,readdir,writeFile,chmod} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const installer=fileURLToPath(new URL('../scripts/install-linux.sh',import.meta.url));
const run=(env,input='')=>new Promise((resolve,reject)=>{
  const child=spawn('bash',[installer],{env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';
  child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
  child.on('error',reject);child.on('close',code=>resolve({code,stdout,stderr}));child.stdin.end(input);
});
async function setup({legacy=false,goodChecksum=true}={}){
  const root=await mkdtemp(path.join(os.tmpdir(),'nodus-linux-installer-'));
  const bin=path.join(root,'bin'),programs=path.join(root,'programs');await mkdir(bin);await mkdir(programs);
  const image=path.join(root,'appimage');
  const content='#!/bin/sh\nprintf launched > "$NODUS_TEST_LAUNCHED"\n';
  await writeFile(image,content);await chmod(image,0o755);
  const digest=createHash('sha256').update(content).digest('hex');
  const sums=path.join(root,'SHA256SUMS.txt');
  await writeFile(sums,`${goodChecksum?digest:'0'.repeat(64)}  ${legacy?'Nodus-linux-x64.AppImage':'Nodus-v1.3.1-Linux-x86_64.AppImage'}\n`);
  await writeFile(path.join(bin,'curl'),`#!/bin/sh
out=''; url=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '-o' ]; then shift; out="$1"; else url="$1"; fi
  shift
done
case "$url" in
  */releases/latest) printf '%s' 'https://github.com/alexwilliamclerk/Nodus/releases/tag/v1.3.1' ;;
  */SHA256SUMS.txt) cp "$NODUS_TEST_SUMS" "$out" ;;
  */Nodus-v1.3.1-Linux-x86_64.AppImage) if [ "$NODUS_TEST_LEGACY" = 1 ]; then exit 22; else cp "$NODUS_TEST_IMAGE" "$out"; fi ;;
  */Nodus-linux-x64.AppImage) cp "$NODUS_TEST_IMAGE" "$out" ;;
  *) exit 22 ;;
esac
`);
  await writeFile(path.join(bin,'sha256sum'),`#!/bin/sh
"$NODUS_TEST_NODE" -e 'const fs=require("fs"),crypto=require("crypto");const f=process.argv[1];console.log(crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex")+"  "+f)' "$1"
`);
  await writeFile(path.join(bin,'gio'),'#!/bin/sh\n[ "$1" = trash ] || exit 1\nrm -- "$2"\n');
  for(const name of ['curl','sha256sum','gio'])await chmod(path.join(bin,name),0o755);
  const launched=path.join(root,'launched');
  const env={...process.env,PATH:`${bin}:${process.env.PATH}`,NODUS_INSTALL_DIR:programs,NODUS_TEST_IMAGE:image,NODUS_TEST_SUMS:sums,NODUS_TEST_NODE:process.execPath,NODUS_TEST_LAUNCHED:launched,NODUS_TEST_LEGACY:legacy?'1':'0'};
  return {root,programs,launched,env};
}

test('verified Linux install offers per-file cleanup only after the new app exits',async()=>{
  const {programs,launched,env}=await setup();
  const older=path.join(programs,'Nodus-v1.3.0-Linux-x86_64.AppImage');
  const newer=path.join(programs,'Nodus-v2.0.0-Linux-x86_64.AppImage');
  const legacy=path.join(programs,'Nodus.AppImage');
  await writeFile(older,'old');await writeFile(newer,'future');await writeFile(legacy,'legacy');
  const result=await run(env,'y\nn\n');
  assert.equal(result.code,0,result.stderr);
  assert.equal(await readFile(launched,'utf8'),'launched');
  assert.match(result.stdout,/Remove old program file Nodus-v1.3.0/);
  assert(!result.stdout.includes('Nodus-v2.0.0'));
  assert(!(await readdir(programs)).includes(path.basename(older)));
  assert((await readdir(programs)).includes(path.basename(newer)));
  assert((await readdir(programs)).includes(path.basename(legacy)));
  assert((await readdir(programs)).includes('Nodus-v1.3.1-Linux-x86_64.AppImage'));
});

test('checksum failure preserves old AppImage; older releases can use the stable alias',async()=>{
  const bad=await setup({goodChecksum:false});
  const old=path.join(bad.programs,'Nodus.AppImage');await writeFile(old,'keep');
  const failed=await run(bad.env);assert.notEqual(failed.code,0);assert.match(failed.stderr,/checksum mismatch/i);
  assert.equal(await readFile(old,'utf8'),'keep');
  const alias=await setup({legacy:true});
  const result=await run(alias.env);assert.equal(result.code,0,result.stderr);
  assert((await readdir(alias.programs)).includes('Nodus-v1.3.1-Linux-x86_64.AppImage'));
});
