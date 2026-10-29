import {readFile} from 'node:fs/promises';
import path from 'node:path';
export function checkOrigin(req,tls,allowedHosts){
 let host;try{host=new URL(`http://${req.headers.host}`).hostname.toLowerCase();}catch{return false;}
 if(!allowedHosts.includes(host))return false;
 if(req.method==='POST'&&req.headers['sec-fetch-site']==='cross-site')return false;
 if(req.method==='POST'&&req.headers.origin&&req.headers.origin!==`${tls?'https':'http'}://${req.headers.host}`)return false;
 return true;
}
export async function networkConfig(root,env=process.env){
 const host=env.POC_BIND_HOST||'127.0.0.1',port=Number(env.PORT||4317),allowedHosts=(env.POC_ALLOWED_HOSTS||'localhost,127.0.0.1').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT 不正確');
 const cert=env.POC_TLS_CERT,key=env.POC_TLS_KEY;if(!!cert!==!!key)throw new Error('TLS_CERT 和 TLS_KEY 必須一起設定');
 if(!['127.0.0.1','localhost','::1'].includes(host)&&!cert)throw new Error('跨機監聽必須啟用 HTTPS，不接受明文登入');
 if(!['127.0.0.1','localhost','::1'].includes(host)&&!env.POC_ALLOWED_HOSTS)throw new Error('跨機模式必須明確指定 POC_ALLOWED_HOSTS');
 const tls=cert?{cert:await readFile(path.resolve(root,cert)),key:await readFile(path.resolve(root,key)),minVersion:'TLSv1.2'}:null;
 return {host,port,tls,allowedHosts,auth:true};
}
