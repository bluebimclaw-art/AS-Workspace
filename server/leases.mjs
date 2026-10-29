import {randomBytes} from 'node:crypto';
const conflict=m=>Object.assign(new Error(m),{status:409});
export class Leases {
 constructor(store,files,{ttlMs=300000}={}){this.store=store;this.files=files;this.ttlMs=ttlMs;}
 async init(){await this.store.mutate(db=>{db.editLeases=[];});return this;}
 current(fileId){return this.store.db.editLeases.find(l=>l.fileId===fileId&&l.expiresAt>Date.now());}
 check(fileId,actor,token){const l=this.current(fileId);if(!l||l.userId!==actor.id||l.sessionId!==actor.sessionId||l.token!==token)throw conflict(l?`${l.name} 正在編輯；請另存副本或稍後重試`:'編輯鎖已過期，請重新取得或另存副本');}
 async change(fileId,{action='acquire',expectedVersion,token},actor){
  return this.store.mutate(db=>{
   const f=this.files.file(fileId);let l=this.current(fileId);
   if(action==='release'){if(l){this.check(fileId,actor,token);db.editLeases=db.editLeases.filter(x=>x!==l);}return {released:true};}
   if(!['acquire','renew'].includes(action))throw Object.assign(new Error('鎖定操作不正確'),{status:400});
   if(f.version!==expectedVersion)throw conflict('檔案已有新版本，請更新後重開');
   if(l){this.check(fileId,actor,token);}else if(action==='renew')throw conflict('編輯鎖已過期，請重新取得');
   if(!l){l={fileId,userId:actor.id,name:actor.name,sessionId:actor.sessionId,token:randomBytes(32).toString('base64url')};db.editLeases=db.editLeases.filter(x=>x.fileId!==fileId);db.editLeases.push(l);}
   l.expiresAt=Date.now()+this.ttlMs;return {fileId,token:l.token,expiresAt:l.expiresAt,version:f.version};
  });
 }
 async releaseSession(sessionId){await this.store.mutate(db=>{db.editLeases=db.editLeases.filter(l=>l.sessionId!==sessionId);});}
 visible(){return this.store.db.editLeases.filter(l=>l.expiresAt>Date.now()).map(({fileId,name,expiresAt})=>({fileId,name,expiresAt}));}
}
