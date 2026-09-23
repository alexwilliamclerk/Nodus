import path from 'node:path';
import {lstat} from 'node:fs/promises';

export async function previewPath(storage,requestUrl) {
  const url=new URL(requestUrl,'http://127.0.0.1');
  const [taskId,versionId,...files]=url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
  const validId=value=>typeof value==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(value);
  if(!validId(taskId)||!validId(versionId))throw new Error('Invalid artifact identifier');
  const parts=[taskId,versionId,...(files.length?files:['index.html'])];
  let current=storage.artifactRoot;
  for(const part of parts){
    if(!part||part==='.'||part==='..'||/[\\/\0:]/.test(part))throw new Error('Invalid artifact path');
    current=path.join(current,part);
    if((await lstat(current)).isSymbolicLink())throw new Error('Artifact links are not allowed');
  }
  if(!(await lstat(current)).isFile())throw new Error('Artifact file missing');
  return current;
}
