import {readdirSync,readFileSync,statSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
import {releaseAssetName} from '../backend/release-names.mjs';
const require=createRequire(import.meta.url);
const entry=readdirSync('node_modules/.pnpm').find(name=>name.startsWith('@electron+asar@'));
assert(entry,'ASAR reader must be installed by electron-builder');
const asar=require(path.resolve('node_modules/.pnpm',entry,'node_modules/@electron/asar'));
const platform=process.argv[2];
assert(['mac','win','linux'].includes(platform),'Expected mac, win, or linux');
const archive=platform==='mac'?'dist/mac-arm64/Nodus.app/Contents/Resources/app.asar':platform==='win'?'dist/win-unpacked/resources/app.asar':'dist/linux-unpacked/resources/app.asar';
const files=['app.js','index.html','styles.css'];
for(const dir of ['backend','electron','frontend','skills']) {
  for(const file of readdirSync(dir,{recursive:true})) {
    const name=path.join(dir,file);
    if(statSync(name).isFile())files.push(name);
  }
}
const archivedFiles=new Set(asar.listPackage(archive).map(file=>file.replaceAll('\\','/').replace(/^\//,'')));
assert(archivedFiles.has('node_modules/electron-updater/package.json'),'Packaged automatic updater dependency is missing');
for(const file of files){
  const archivePath=file.split(path.sep).join('/');
  assert(archivedFiles.has(archivePath),`Packaged file missing: ${archivePath}; related entries: ${[...archivedFiles].filter(item=>item.includes('skill')).slice(0,12).join(', ')}`);
  assert(readFileSync(file).equals(asar.extractFile(archive,file)),`Packaged file differs: ${file}`);
}
const source=JSON.parse(readFileSync('package.json','utf8'));
const packed=JSON.parse(asar.extractFile(archive,'package.json').toString());
for(const key of ['name','version','main','dependencies'])assert.deepEqual(packed[key],source[key],`Packaged metadata differs: ${key}`);
if(platform!=='mac'){
  const resources=platform==='win'?'dist/win-unpacked/resources':'dist/linux-unpacked/resources';
  const updateConfig=readFileSync(path.join(resources,'app-update.yml'),'utf8');
  assert.match(updateConfig,/provider: github/);
  assert.match(updateConfig,/owner: alexwilliamclerk/);
  assert.match(updateConfig,/repo: Nodus/);
  const metadata=readFileSync(platform==='win'?'dist/latest.yml':'dist/latest-linux.yml','utf8');
  assert(metadata.includes(releaseAssetName(platform==='win'?'win32':'linux',`v${source.version}`)),'Auto-update metadata points to a different installer');
  assert.match(metadata,/sha512:/);
}
const forbidden=asar.listPackage(archive).filter(file=>/[\\/](?:\.forma-data|\.nodus-user-data|\.env|credentials\.json|auth\.json|test-results|migration-original)(?:[\\/]|$)/.test(file));
assert.deepEqual(forbidden,[],'Private-data paths must not be packaged');
console.log(`Verified ${files.length} application files and package metadata (${platform}).`);
