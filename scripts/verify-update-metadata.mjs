import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createReadStream} from 'node:fs';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {releaseAssetName} from '../backend/release-names.mjs';

const {version}=JSON.parse(await readFile('package.json','utf8'));
for(const [platform,metadataFile] of [['win32','latest.yml'],['linux','latest-linux.yml']]){
  const name=releaseAssetName(platform,`v${version}`);
  const raw=await readFile(path.join('release-assets',metadataFile),'utf8');
  assert(raw.includes(`version: ${version}`),`${metadataFile} has another version`);
  const url=/^\s*- url: ([^\r\n]+)$/m.exec(raw)?.[1];
  const digest=/^\s*sha512: ([A-Za-z0-9+/=]+)$/m.exec(raw)?.[1];
  const size=Number(/^\s*size: (\d+)$/m.exec(raw)?.[1]);
  assert.equal(url,name,`${metadataFile} points to another installer`);
  assert(digest&&Number.isSafeInteger(size)&&size>0,`${metadataFile} is missing checksum or size`);
  const file=path.join('release-assets',name);
  assert.equal((await stat(file)).size,size,`${metadataFile} size mismatch`);
  const hash=createHash('sha512');
  for await(const chunk of createReadStream(file))hash.update(chunk);
  assert.equal(hash.digest('base64'),digest,`${metadataFile} SHA-512 mismatch`);
  console.log(`Verified ${metadataFile} against ${name}`);
}
