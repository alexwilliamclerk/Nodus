import {copyFile, mkdir} from 'node:fs/promises';
import {readFileSync} from 'node:fs';
import {releaseAssetName,legacyAssetName} from '../backend/release-names.mjs';
const {version}=JSON.parse(readFileSync('package.json','utf8'));
const platform=process.argv[2];
if(!['mac','win','linux'].includes(platform))throw new Error('Expected mac, win, or linux');
const system={mac:'darwin',win:'win32',linux:'linux'}[platform];
const target=releaseAssetName(system,`v${version}`);
const alias=legacyAssetName(system);
const source=`dist/${target}`;
await mkdir('release-assets',{recursive:true});
await copyFile(source,`release-assets/${target}`);
await copyFile(source,`release-assets/${alias}`);
if(platform==='win'||platform==='linux'){
  const metadata=platform==='win'?'latest.yml':'latest-linux.yml';
  await copyFile(`dist/${metadata}`,`release-assets/${metadata}`);
}
if(platform==='linux'){
  await copyFile('scripts/install-linux.sh',`release-assets/Nodus-v${version}-Linux-install.sh`);
  await copyFile('scripts/install-linux.sh','release-assets/Nodus-linux-install.sh');
}
console.log(`Prepared ${target} and compatibility alias ${alias}`);
