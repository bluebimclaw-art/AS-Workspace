import {randomUUID} from 'node:crypto';
const terminal=new Set(['succeeded','failed','cancelled','interrupted']);
export class AiQueue {
 constructor(store,execute,{limit=30,perUser=3}={}){this.store=store;this.execute=execute;this.limit=limit;this.perUser=perUser;this.running=false;this.stopped=false;this.controllers=new Map();this.timer=null;this.submission=Promise.resolve();}
 async init(){await this.store.mutate(db=>{db.aiJobs??=[];db.aiInputs??={};for(const j of db.aiJobs){if(!terminal.has(j.status)){j.status='interrupted';j.error='服務重啟；未自動重送，請核對後自行重新提交';j.finishedAt=new Date().toISOString();const turn=db.chats?.flatMap(s=>s.messages).find(t=>t.id===j.turnId);if(turn){turn.status='interrupted';turn.error=j.error;}}delete db.aiInputs[j.id];}});return this;}
 find(id,user){const j=this.store.db.aiJobs.find(j=>j.id===id&&(j.userId===user.id||user.role==='admin'));if(!j)throw Object.assign(new Error('找不到任務'),{status:404});return j;}
 view(job,user){const pending=this.store.db.aiJobs.filter(j=>j.status==='queued');return {...job,result:job.userId===user.id?job.result:undefined,position:job.status==='queued'?pending.findIndex(j=>j.id===job.id)+1:0};}
 list(user){return this.store.db.aiJobs.filter(j=>j.userId===user.id||user.role==='admin').slice(-100).map(j=>this.view(j,user));}
 submit(user,requestId,prepare){
  const task=this.submission.then(async()=>{
   if(typeof requestId!=='string'||!/^[\w-]{8,100}$/.test(requestId))throw Object.assign(new Error('缺少有效任務識別碼'),{status:400});
   const prior=this.store.db.aiJobs.find(j=>j.userId===user.id&&j.requestId===requestId);if(prior)return this.view(prior,user);
   const active=this.store.db.aiJobs.filter(j=>!terminal.has(j.status));if(active.length>=this.limit||active.filter(j=>j.userId===user.id).length>=this.perUser)throw Object.assign(new Error('排隊已滿，請等待目前任務完成'),{status:429});
   const prepared=await prepare(),job={id:randomUUID(),requestId,userId:user.id,userName:user.name,kind:prepared.kind,label:prepared.label,provider:prepared.provider,model:prepared.model,turnId:prepared.turnId,status:'queued',createdAt:new Date().toISOString()};
   if(prepared.sourceId){job.sourceId=prepared.sourceId;job.sourceRevision=prepared.revision;}
   await this.store.mutate(db=>{db.aiJobs.push(job);db.aiInputs[job.id]=prepared;});this.schedule();return this.view(job,user);
  });this.submission=task.catch(()=>{});return task;
 }
 schedule(){if(this.timer||this.running||this.stopped)return;this.timer=setTimeout(()=>{this.timer=null;this.drain().catch(e=>{console.error('AI queue paused:',e.message);this.stopped=true;});},10);}
 async drain(){if(this.running||this.stopped)return;const job=this.store.db.aiJobs.find(j=>j.status==='queued');if(!job)return;this.running=true;const controller=new AbortController();this.controllers.set(job.id,controller);
  try{
   await this.store.mutate(()=>{if(job.status==='queued'){job.status='running';job.startedAt=new Date().toISOString();}});if(job.status!=='running')return;
   const result=await this.execute(this.store.db.aiInputs[job.id],job,controller.signal);
   await this.store.mutate(()=>{if(job.status==='running'){job.status='succeeded';job.result=result;}});
  }catch(e){await this.store.mutate(db=>{if(job.status==='running'){job.status=controller.signal.aborted?'cancelled':'failed';job.error=controller.signal.aborted?'已中止本平台等候；上游是否停止運算未確認':e.message;const turn=db.chats?.flatMap(s=>s.messages).find(t=>t.id===job.turnId);if(turn){turn.status=job.status;turn.error=job.error;}}});
  }finally{await this.store.mutate(db=>{job.finishedAt=new Date().toISOString();delete db.aiInputs[job.id];});this.controllers.delete(job.id);this.running=false;this.schedule();}
 }
 async cancel(id,user){const job=this.find(id,user);await this.store.mutate(db=>{if(terminal.has(job.status))return;if(job.status==='running')throw Object.assign(new Error('任務已送至模型；此版只可取消尚未執行的任務，避免不確定上游是否停止'),{status:409});job.status='cancelled';job.finishedAt=new Date().toISOString();job.error='已取消，未送至模型';delete db.aiInputs[job.id];const turn=db.chats?.flatMap(s=>s.messages).find(t=>t.id===job.turnId);if(turn){turn.status='cancelled';turn.error=job.error;}});return this.view(job,user);}
 async close(){this.stopped=true;if(this.timer)clearTimeout(this.timer);for(const c of this.controllers.values())c.abort();while(this.running)await new Promise(r=>setTimeout(r,20));}
}
