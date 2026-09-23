import {readFile,writeFile,rename} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {connectCredential} from './credential-service.mjs';

const snapshot=pi=>Object.fromEntries(['modelRuntime','model','providerId','modelId'].map(key=>[key,pi[key]]));
export class ModelConnections {
  constructor(pi,safeStorage,file){this.pi=pi;this.safeStorage=safeStorage;this.file=file;this.items=new Map();this.activeId=null;this.busy=false;}
  status(){return {...this.pi.status(),activeConnectionId:this.activeId,connections:[...this.items.values()].map(({id,label,providerId,modelId,remembered})=>({id,label,providerId,modelId,remembered}))};}
  async exclusive(work){
    if(this.busy||this.pi.activeRuns.size)throw new Error('请等待模型操作结束或停止任务后再切换连接。');
    this.busy=true;try{return await work();}finally{this.busy=false;}
  }
  async readSaved(){
    try{const raw=JSON.parse(await readFile(this.file,'utf8'));return raw.schemaVersion===2?raw:{schemaVersion:2,activeId:'legacy',connections:[{id:'legacy',label:raw.modelId,...raw}]};}
    catch(error){if(error.code==='ENOENT')return {schemaVersion:2,connections:[]};throw error;}
  }
  async writeSaved(value){await writeFile(`${this.file}.pending`,JSON.stringify(value),'utf8');await rename(`${this.file}.pending`,this.file);}
  async add(config){return this.exclusive(async()=>{
    const id=randomUUID(),label=(config.label||'').trim();
    const result=await connectCredential({pi:this.pi,safeStorage:this.safeStorage,config,save:async saved=>{
      const vault=await this.readSaved();vault.connections.push({id,label:label||saved.modelId,...saved});vault.activeId=id;await this.writeSaved(vault);
    }});
    this.items.set(id,{id,label:label||result.modelId,providerId:result.providerId,modelId:result.modelId,remembered:result.remembered,runtime:snapshot(this.pi)});
    this.activeId=id;return {...this.status(),remembered:result.remembered};
  });}
  async activate(id){return this.exclusive(async()=>{
    const item=this.items.get(id);if(!item)throw new Error('连接已失效，请重新添加或恢复。');
    if(item.remembered){const vault=await this.readSaved();vault.activeId=id;await this.writeSaved(vault);}
    Object.assign(this.pi,item.runtime);this.activeId=id;return this.status();
  });}
  async remove(id){return this.exclusive(async()=>{
    const item=this.items.get(id);if(!item)throw new Error('连接不存在');
    if(item.remembered){const vault=await this.readSaved();vault.connections=vault.connections.filter(c=>c.id!==id);if(vault.activeId===id)vault.activeId=null;await this.writeSaved(vault);}
    this.items.delete(id);
    if(this.activeId===id){await this.pi.disconnect();this.activeId=null;}
    return this.status();
  });}
  async restore(){return this.exclusive(async()=>{
    const vault=await this.readSaved();if(!vault.connections.length)throw new Error('没有已保存连接。');
    if(!this.safeStorage.isEncryptionAvailable())throw new Error('未获系统加密授权；可以直接添加仅本次使用的连接。');
    const previous=snapshot(this.pi),restored=[];
    try{
      for(const saved of vault.connections){
        const apiKey=this.safeStorage.decryptString(Buffer.from(saved.encryptedKey,'base64'));
        const result=await this.pi.configure({providerId:saved.providerId,modelId:saved.modelId,apiKey,verify:false});
        restored.push({id:saved.id,label:saved.label||result.modelId,providerId:result.providerId,modelId:result.modelId,remembered:true,runtime:snapshot(this.pi)});
      }
    }catch{Object.assign(this.pi,previous);throw new Error('无法恢复已保存连接，原连接保持不变。可以直接添加仅本次使用的连接。');}
    for(const item of restored)this.items.set(item.id,item);
    const chosen=restored.find(c=>c.id===vault.activeId)||restored[0];Object.assign(this.pi,chosen.runtime);this.activeId=chosen.id;return this.status();
  });}
}
