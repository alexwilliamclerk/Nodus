import {readdirSync,readFileSync,statSync} from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url);
const entry=readdirSync('node_modules/.pnpm').find(name=>name.startsWith('@electron+asar@'));
assert(entry,'ASAR reader must be installed by electron-builder');
const asar=require(path.resolve('node_modules/.pnpm',entry,'node_modules/@electron/asar'));
const platform=process.argv[2];
assert(['mac','win'].includes(platform),'Expected mac or win');
const archive=platform==='mac'?'dist/mac-arm64/Nodus.app/Contents/Resources/app.asar':'dist/win-unpacked/resources/app.asar';
const files=['app.js','index.html','styles.css'];
for(const dir of ['backend','electron','frontend','skills']) {
  for(const file of readdirSync(dir,{recursive:true})) {
    const name=path.join(dir,file);
    if(statSync(name).isFile())files.push(name);
  }
}
for(const file of files)assert(readFileSync(file).equals(asar.extractFile(archive,file.split(path.sep).join('/'))),`Packaged file differs: ${file}`);
const source=JSON.parse(readFileSync('package.json','utf8'));
const packed=JSON.parse(asar.extractFile(archive,'package.json').toString());
for(const key of ['name','version','main','dependencies'])assert.deepEqual(packed[key],source[key],`Packaged metadata differs: ${key}`);
const forbidden=asar.listPackage(archive).filter(file=>/[\\/](?:\.forma-data|\.nodus-user-data|\.env|credentials\.json|auth\.json|test-results|migration-original)(?:[\\/]|$)/.test(file));
assert.deepEqual(forbidden,[],'Private-data paths must not be packaged');
console.log(`Verified ${files.length} application files and package metadata (${platform}).`);
