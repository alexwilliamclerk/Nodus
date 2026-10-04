import {mkdir,readFile,writeFile,rename,lstat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {sourceText} from './safety-evidence.mjs';

// Outside the artifact roots exposed to tools and the preview server.
export class SafetyMaterials {
  constructor(root){this.root=root;}
  file(taskId,name){
    if(!/^[a-zA-Z0-9][a-zA-Z0-9:_-]{0,180}$/.test(taskId)||! /^(?:[a-f0-9]{64}|intent)\.json$/.test(name))throw Error('Invalid material record');
    return path.join(this.root,taskId,name);
  }
  async save(file,value){
    await mkdir(path.dirname(file),{recursive:true,mode:0o700});
    const temporary=file+'.'+randomUUID()+'.tmp';
    await writeFile(temporary,JSON.stringify(value),{mode:0o600});await rename(temporary,file);
  }
  async capture(taskId,sources){
    for(const source of sources){
      const text=source[sourceText];if(typeof text!=='string'||!text||text.length>256000)continue;
      const file=this.file(taskId,source.id+'.json');
      // Content-addressed records are immutable; never overwrite an original.
      try{await lstat(file);continue;}catch(error){if(error.code!=='ENOENT')throw error;}
      await this.save(file,{id:source.id,kind:source.kind,name:source.name,origin:source.origin,digest:source.digest,filePath:source.filePath||null,completeFile:source.completeFile===true,text});
    }
  }
  async read(taskId,id){
    try{return JSON.parse(await readFile(this.file(taskId,id+'.json'),'utf8'));}
    catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
  async rememberIntent(taskId,{phase,retryMessage,taskContext}){
    if(!taskContext||!['chat','artifact','revision','website','options'].includes(phase))return;
    await this.save(this.file(taskId,'intent.json'),{phase,message:typeof retryMessage==='string'?retryMessage:null,at:new Date().toISOString()});
  }
  async intent(taskId){
    try{return JSON.parse(await readFile(this.file(taskId,'intent.json'),'utf8'));}
    catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
}
