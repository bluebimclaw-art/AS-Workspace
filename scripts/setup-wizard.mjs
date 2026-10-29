import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {readFile,readdir} from 'node:fs/promises';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {preflight,install,startInstalled} from './installer-core.mjs';
import {discoverHermes} from '../server/hermes-discovery.mjs';

export async function createSetup({source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),port=0,installAction=install}={}){
 const token=randomBytes(32).toString('hex'),nonce=randomBytes(18).toString('base64');
 const state={status:'ready',progress:[],report:null,error:null};let address;
 const server=http.createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options','DENY');
   if(req.headers.host!==address||!['127.0.0.1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return send(403,{error:'只接受本機精靈地址'});
   if(req.method==='GET'&&req.url==='/'){
    const html=(await readFile(new URL('./setup-wizard.html',import.meta.url),'utf8')).replaceAll('__NONCE__',nonce);
    res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':`default-src 'none'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`});return res.end(html);
   }
   const candidate=Buffer.from(req.headers['x-setup-token']||'');if(candidate.length!==token.length||!timingSafeEqual(candidate,Buffer.from(token)))return send(403,{error:'安裝連結已失效或缺少一次性token'});
   if(req.method!=='POST'||req.headers.origin!==`http://${address}`||req.headers['sec-fetch-site']==='cross-site')return send(403,{error:'拒絕跨來源安裝請求'});
   let raw='';for await(const b of req){raw+=b;if(Buffer.byteLength(raw)>40000)return send(413,{error:'設定過大'});}const body=JSON.parse(raw||'{}');
   if(req.url==='/api/state')return send(200,state);
   if(req.url==='/api/start'&&state.status==='configured'){
    if(state.starting||state.started)throw Error('新平台啟動中或已啟動；請使用交接URL');
    state.starting=true;try{state.started=await startInstalled(state.report);return send(200,state.started);}finally{state.starting=false;}
   }
   if(state.status==='installing'||state.status==='configured')return send(409,{error:'安裝正在執行或已完成；設定入口已鎖定'});
   if(req.url==='/api/defaults'){
    const version=JSON.parse(await readFile(path.join(source,'package.json'),'utf8')).version;
    return send(200,{version,appDir:path.join(os.homedir(),'AS-Workspace','app-'+version),dataDir:path.join(os.homedir(),'AS-Workspace','data-'+version),hosts:Object.values(os.networkInterfaces()).flat().filter(n=>!n.internal&&n.family==='IPv4').map(n=>n.address).sort((a,b)=>Number(b.startsWith('192.168.'))-Number(a.startsWith('192.168.'))),platform:process.platform,node:process.version});
   }
   if(req.url==='/api/browse'){
    let dir=body.path;if(typeof dir!=='string'||!path.isAbsolute(dir))throw Error('請輸入本機絕對路徑');
    let entries;for(;;){try{entries=await readdir(dir,{withFileTypes:true});break;}catch(e){const parent=path.dirname(dir);if(e.code!=='ENOENT'||parent===dir)throw e;dir=parent;}}
    return send(200,{path:dir,parent:path.dirname(dir),folders:entries.filter(e=>e.isDirectory()&&!e.isSymbolicLink()).slice(0,200).map(e=>e.name)});
   }
   if(req.url==='/api/hermes')return send(200,await discoverHermes({baseUrl:body.baseUrl,key:body.key,model:body.model,generate:body.generate===true}));
   if(req.url==='/api/preflight')return send(200,await preflight(source,body));
   if(req.url==='/api/install'){
    state.status='installing';state.error=null;state.progress=[];send(202,{ok:true});
    try{state.report=await installAction(source,body,{onProgress:s=>state.progress.push(s)});state.status='configured';}catch{state.status='failed';state.error='安裝未完成。檢查新目錄install-report.local.json；保留舊服務，請勿直接覆蓋重試。';}return;
   }
   return send(404,{error:'找不到設定接口'});
  }catch(e){send(400,{error:e instanceof SyntaxError?'設定JSON格式不正確':['ENOENT','EACCES','EPERM'].includes(e.code)?'路徑不存在或沒有讀取權限':String(e.message).slice(0,400)});}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});address='127.0.0.1:'+server.address().port;
 return {server,url:`http://${address}/#${token}`,state};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const setup=await createSetup();console.log('AS Workspace 安裝精靈（連結只供本機，勿轉發或上傳）：\n'+setup.url+'\n完成後可按 Ctrl+C 關閉精靈。平台以新目錄 npm run central:start 啟動。');
}
