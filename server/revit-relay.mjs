import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {fail} from './company-policy.mjs';
const digest=v=>createHash('sha256').update(v).digest('hex');
const clean=(v,n=200)=>typeof v==='string'?v.slice(0,n):'';
export function cleanRevitResult(r){
 if(!r||r.readOnly!==true||r.writeEnabled!==false||!['connected-readonly','version-mismatch','revit-unavailable','mcp-unavailable'].includes(r.status))throw fail('Connector結果格式不接受',400);
 const result={at:new Date().toISOString(),status:r.status,readOnly:true,writeEnabled:false,mcpReady:r.mcpReady===true,revitConnected:r.revitConnected===true,actualRevitYear:/^20\d{2}$/.test(r.actualRevitYear)?r.actualRevitYear:null,warnings:(Array.isArray(r.warnings)?r.warnings:[]).slice(0,8).map(x=>clean(x,400))};
 if(r.server)result.server={name:clean(r.server.name),version:clean(r.server.version)};
 if(r.project)result.project={name:clean(r.project.name)};
 if(r.error)result.error='Windows Connector未能完成唯讀查詢；請在工作站檢查本機診斷';
 if(r.levels){const items=Array.isArray(r.levels.items)?r.levels.items.slice(0,100):[];result.levels={count:Number.isInteger(r.levels.count)?r.levels.count:items.length,items:items.map(l=>({name:clean(l.name,100),elevationMm:Number.isFinite(l.elevationMm)?l.elevationMm:null}))};}
 return result;
}
export class RevitRelay{
 constructor(policy,{timeoutMs=30000,onlineMs=15000}={}){Object.assign(this,{policy,timeoutMs,onlineMs});this.live=new Map();this.tasks=new Map();}
 devices(){return (this.policy.state.revitDevices||[]).map(({tokenHash,...d})=>({...d,online:!d.revoked&&Date.now()-(this.live.get(d.id)?.seen||0)<this.onlineMs,last:this.live.get(d.id)?.last||null,readOnly:true,writeEnabled:false}));}
 issue(user,{label,expectedVersion}){if(typeof label!=='string'||!label.trim()||label.length>80)throw fail('裝置名稱須1–80字元',400);if((this.policy.state.revitDevices||[]).length>=30)throw fail('Connector記錄已達30項上限',409);const token=randomBytes(32).toString('base64url'),id=randomUUID();this.policy.update(user.id,'revit-device-pair',d=>{d.revitDevices??=[];d.revitDevices.push({id,label:label.trim(),tokenHash:digest(token),createdAt:new Date().toISOString(),expiresAt:Date.now()+30*86400000,revoked:false});},expectedVersion);return {id,token,expiresDays:30,notice:'只顯示一次，請在Windows本機保存；不要貼到對話或GitHub'};}
 revoke(user,{id,expectedVersion}){this.policy.update(user.id,'revit-device-revoke',d=>{const device=d.revitDevices?.find(x=>x.id===id);if(!device)throw fail('Connector不存在',404);device.revoked=true;},expectedVersion);for(const [taskId,t]of this.tasks)if(t.deviceId===id){clearTimeout(t.timer);t.reject(fail('Connector已撤銷',403));this.tasks.delete(taskId);}this.live.delete(id);return {ok:true};}
 authenticate(token){if(typeof token!=='string'||token.length>200)throw fail('Connector認證失敗',401);const d=this.policy.state.revitDevices?.find(d=>!d.revoked&&d.expiresAt>Date.now()&&d.tokenHash===digest(token));if(!d)throw fail('Connector認證失敗或已撤銷',401);return d;}
 authorized(t){const user=this.policy.state.accounts?.find(u=>u.id===t.userId&&!u.disabled);if(!user||user.role==='viewer')throw fail('發起帳戶已撤權',403);this.policy.require(user,t.projectId,'bim','read');}
 poll(token,body){if(Object.keys(body).length)throw fail('輪詢不接受任意工具／參數',400);const d=this.authenticate(token),live=this.live.get(d.id)||{};live.seen=Date.now();this.live.set(d.id,live);const task=[...this.tasks.values()].find(t=>t.deviceId===d.id&&!t.dispatched);if(!task)return {task:null};try{this.authorized(task);}catch(e){clearTimeout(task.timer);this.tasks.delete(task.id);task.reject(e);return {task:null};}task.dispatched=true;return {task:{id:task.id,operation:'probe-readonly'}};}
 report(token,{taskId,result,...extra}){if(Object.keys(extra).length)throw fail('結果含未批准欄位',400);const d=this.authenticate(token),t=this.tasks.get(taskId);if(!t||t.deviceId!==d.id||!t.dispatched)throw fail('查詢不存在或已逾時；不重送',409);this.authorized(t);const value=cleanRevitResult(result);clearTimeout(t.timer);this.tasks.delete(t.id);this.live.set(d.id,{seen:Date.now(),last:value});this.policy.update(t.userId,'revit-readonly-result',()=>{});t.resolve(value);return {ok:true};}
 probe(user,projectId,id){if(user.role==='viewer')throw fail('Viewer不可提交Revit查詢',403);this.policy.require(user,projectId,'bim','read');const d=this.devices().find(d=>d.id===id&&!d.revoked);if(!d)throw fail('Connector不存在',404);if(!d.online)throw fail('Windows Connector離線；先啟動出站連線',409);if([...this.tasks.values()].some(t=>t.deviceId===id))throw fail('此Revit工作站正在查詢，請稍後再試',409);return new Promise((resolve,reject)=>{const task={id:randomUUID(),deviceId:id,userId:user.id,projectId,resolve,reject,dispatched:false};task.timer=setTimeout(()=>{this.tasks.delete(task.id);reject(fail('Connector查詢逾時；未自動重送',504));},this.timeoutMs);this.tasks.set(task.id,task);});}
 close(){for(const t of this.tasks.values()){clearTimeout(t.timer);t.reject(fail('平台停止；查詢不重播',503));}this.tasks.clear();}
}
