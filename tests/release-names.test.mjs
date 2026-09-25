import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {releaseAssetName,legacyAssetName} from '../backend/release-names.mjs';

const run=promisify(execFile);
const script=fileURLToPath(new URL('../scripts/prepare-release-asset.mjs',import.meta.url));
const config=JSON.parse(await readFile(new URL('../package.json',import.meta.url),'utf8'));

test('builder names include release version, platform and supported architecture',()=>{
  assert.equal(config.build.mac.artifactName,'Nodus-v${version}-macOS-${arch}.${ext}');
  assert.equal(config.build.win.artifactName,'Nodus-v${version}-Windows-${arch}.${ext}');
  assert.equal(config.build.linux.artifactName,'Nodus-v${version}-Linux-${arch}.${ext}');
  assert.deepEqual(config.build.publish,[{provider:'github',owner:'alexwilliamclerk',repo:'Nodus'}]);
  assert.throws(()=>releaseAssetName('win32','v1.2.3/other'),/tag/);
});

test('release preparation keeps a versioned canonical asset and byte-identical old updater alias',async()=>{
  for(const [buildPlatform,platform] of [['mac','darwin'],['win','win32'],['linux','linux']]){
    const dir=await mkdtemp(path.join(os.tmpdir(),'nodus-release-names-'));
    const canonical=releaseAssetName(platform,'v9.8.7');
    const bytes=Buffer.from(`test-only package for ${platform}`);
    await mkdir(path.join(dir,'dist'));
    await writeFile(path.join(dir,'package.json'),JSON.stringify({version:'9.8.7'}));
    await writeFile(path.join(dir,'dist',canonical),bytes);
    if(platform==='linux'){await mkdir(path.join(dir,'scripts'));await writeFile(path.join(dir,'scripts/install-linux.sh'),'#!/bin/bash\nexit 0\n');}
    if(platform==='win32'||platform==='linux')await writeFile(path.join(dir,'dist',platform==='win32'?'latest.yml':'latest-linux.yml'),`version: 9.8.7\npath: ${canonical}\nsha512: test-only\n`);
    await run(process.execPath,[script,buildPlatform],{cwd:dir});
    assert((await readFile(path.join(dir,'release-assets',canonical))).equals(bytes));
    assert((await readFile(path.join(dir,'release-assets',legacyAssetName(platform)))).equals(bytes));
    if(platform==='win32'||platform==='linux')assert.match(await readFile(path.join(dir,'release-assets',platform==='win32'?'latest.yml':'latest-linux.yml'),'utf8'),new RegExp(canonical.replaceAll('.','\\.')));
    if(platform==='linux')assert.equal(await readFile(path.join(dir,'release-assets','Nodus-linux-install.sh'),'utf8'),'#!/bin/bash\nexit 0\n');
  }
});
