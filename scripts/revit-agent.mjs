import https from 'node:https';import http from 'node:http';import path from 'node:path';
import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {RevitConnector} from '../server/revit-connector.mjs';
export function relayRequest(config,route,body){
 const base=new URL(config.platformUrl);if(base.protocol!=='https:'&&!(base.protocol==='http:'&&['127.0.0.1','[::1]'].includes(base.hostname)))throw Error('平台必須HTTPS（本機合成測試可用loopback HTTP）');if(base.username||base.password||base.search||base.hash||base.pathname!=='/')throw Error('平台URL只接受根地址');
 return new Promise(async(resolve,reject)=>{let ca;try{ca=config.caFile?await readFile(config.caFile):undefined;}catch{return reject(Error('指定平台CA不可讀'));}const raw=JSON.stringify(body),req=(base.protocol==='https:'?https:http).request(new URL('/api/connectors/revit/'+route,base),{method:'POST',ca,rejectUnauthorized:true,headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(raw),Authorization:'Bearer '+config.token},timeout:10000},res=>{let data='';res.on('data',b=>{data+=b;if(data.length>150000)req.destroy(Error('回應過大'));});res.on('end',()=>{try{const result=JSON.parse(data);if(res.statusCode!==200)return reject(Error('Connector API HTTP '+res.statusCode));resolve(result);}catch{reject(Error('Connector API格式不正確'));}});});req.on('error',()=>reject(Error('平台TLS／網絡連線失敗；不略過驗證')));req.on('timeout',()=>req.destroy());req.end(raw);});
}
export async function agentStep(config,connector){const {task}=await relayRequest(config,'poll',{});if(!task)return {idle:true};if(task.operation!=='probe-readonly'||!/^[-\w]{1,80}$/.test(task.id))throw Error('拒絕未知操作');const result=await connector.probe();await relayRequest(config,'report',{taskId:task.id,result});return {idle:false,status:result.status,writeEnabled:false};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const file=process.argv[2];if(!file)throw Error('用法：npm run revit:agent -- config/revit-agent.local.json');
 const config=JSON.parse(await readFile(path.resolve(file),'utf8'));if(typeof config.token!=='string'||config.token.length<32)throw Error('缺少本機Connector token');const connector=new RevitConnector(config.revit);let stop=false;process.on('SIGINT',()=>stop=true);process.on('SIGTERM',()=>stop=true);console.log('Windows Revit Connector：僅出站，固定唯讀查詢；沒有公開MCP端口。');
 while(!stop){try{const r=await agentStep(config,connector);if(!r.idle)console.log(JSON.stringify(r));}catch(e){console.error(e.message);}await new Promise(r=>setTimeout(r,1500));}
}
