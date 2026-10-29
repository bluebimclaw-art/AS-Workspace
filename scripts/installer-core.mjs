import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import https from 'node:https';
import {open} from 'node:fs/promises';
import {access,stat,lstat,statfs,realpath,readdir,mkdir,cp,readFile,writeFile} from 'node:fs/promises';
import {constants} from 'node:fs';
import {spawn} from 'node:child_process';
import {createHash,X509Certificate,createPrivateKey,createPublicKey} from 'node:crypto';
import {setupTls} from './setup-central-tls.mjs';

const inside=(a,b)=>a===b||a.startsWith(b+path.sep);
const safeText=s=>typeof s==='string'&&s.length<1000&&!/[\r\n\0']/u.test(s);
export async function canonical(target){
 if(!safeText(target)||!path.isAbsolute(target))throw Error('請選擇絕對路徑；路徑不可含單引號或換行');
 let probe=path.resolve(target),suffix=[];
 for(;;){try{return path.join(await realpath(probe),...suffix);}catch(e){if(e.code!=='ENOENT')throw e;const parent=path.dirname(probe);if(parent===probe)throw e;suffix.unshift(path.basename(probe));probe=parent;}}
}
async function empty(target){try{if((await readdir(target)).length)throw Error('只可使用全新或空白目錄：'+target);}catch(e){if(e.code!=='ENOENT')throw e;}}
export async function pathsFor(source,input){
 const src=await canonical(source),app=await canonical(input.appDir),data=await canonical(input.dataDir);
 const forbidden=[src,path.join(os.homedir(),'.hermes'),path.join(os.homedir(),'AppData','Local','hermes'),path.join(os.homedir(),'AppData','Roaming','hermes')];
 if(forbidden.some(p=>inside(app,p)||inside(p,app)||inside(data,p)||inside(p,data))||inside(app,data)||inside(data,app))throw Error('程式／資料目錄必須獨立，不能包含安裝來源、Hermes或彼此');
 // Reject parent trees containing a Hermes installation marker, regardless of naming.
 for(const target of [app,data]){let p=path.dirname(target);while(p!==path.dirname(p)){for(const marker of ['hermes_cli','hermes-agent']){try{await access(path.join(p,marker));throw Error('所選位置位於Hermes相關目錄內');}catch(e){if(e.code!=='ENOENT')throw e;}}p=path.dirname(p);}}
 await empty(app);await empty(data);return {app,data,source:src};
}
export async function availablePort(host,port){
 if(!Number.isInteger(port)||port<1024||port>65535)throw Error('端口須為1024–65535');
 await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',()=>reject(Error('地址無法綁定或端口已被使用')));s.listen(port,host,()=>s.close(resolve));});
}
export function validateSettings(input){
 if(!input||!['local','lan'].includes(input.mode))throw Error('請選擇本機或LAN模式');
 const host=input.mode==='local'?'127.0.0.1':input.host;
 if(!net.isIP(host)||host==='0.0.0.0'||host==='::')throw Error('請選擇本機實際IP；不接受全部介面綁定');
 if(input.mode==='lan'&&!Object.values(os.networkInterfaces()).flat().some(n=>n.address===host&&!n.internal))throw Error('LAN IP不屬於此主機目前的網絡介面');
 if(input.mode==='lan'&&!['pilot','import'].includes(input.tlsMode))throw Error('LAN模式必須設定HTTPS');
 if(!/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(input.username||''))throw Error('Admin帳戶須為3–40個小寫英文字母、數字或_.-');
 if(typeof input.password!=='string'||input.password.length<12||input.password.length>512)throw Error('Admin密碼須為12–512字元');
 for(const key of ['javaBin','pdfBin'])if(input[key]&&(!safeText(input[key])||!path.isAbsolute(input[key])))throw Error('工具須為本機絕對路徑');
 return {host,port:Number(input.port)};
}
export async function preflight(source,input){
 const locations=await pathsFor(source,input),network=validateSettings(input);await availablePort(network.host,network.port);
 const node=process.versions.node.split('.').map(Number);if(node[0]<22||node[0]===22&&(node[1]<22||node[1]===22&&node[2]<3))throw Error('需要Node22.22.3+；建議Node24');
 const disks={};for(const [name,target]of [['app',locations.app],['data',locations.data]]){let parent=path.dirname(target);for(;;){try{await access(parent,constants.W_OK);break;}catch(e){if(e.code!=='ENOENT')throw Error('父目錄不可寫：'+parent);parent=path.dirname(parent);}}const volume=await statfs(parent);disks[name]={freeBytes:volume.bavail*volume.bsize,parent};if(disks[name].freeBytes<2*1024**3)throw Error('目的磁碟少於2GiB可用空間');}
 const free=os.freemem(),warnings=[];if(free<4*1024**3)warnings.push('可用RAM少於4GiB；只能先做小批pilot，尚未通過多人容量測試');
 for(const key of ['javaBin','pdfBin'])if(input[key]){if(!(await stat(input[key])).isFile())throw Error('工具路徑不是檔案');}
 if(!input.javaBin&&!input.installJava)warnings.push('未指定Java17+；文字PDF抽取待設定');
 if(!input.pdfBin)warnings.push('未指定pdftoppm；掃描PDF OCR待設定');
 const packageInfo=JSON.parse(await readFile(path.join(source,'package.json'),'utf8'));
 return {version:packageInfo.version,node:process.version,platform:process.platform,arch:process.arch,freeMemoryBytes:free,disks,...locations,...network,warnings,networkInterfaces:Object.values(os.networkInterfaces()).flat().filter(n=>!n.internal).map(n=>n.address)};
}
export async function verifyImportedTls({certFile,keyFile,caFile,host}){
 const [cert,key,ca]=await Promise.all([readFile(certFile),readFile(keyFile),readFile(caFile)]),x=new X509Certificate(cert),authority=new X509Certificate(ca),now=Date.now();
 if(!authority.ca||[x,authority].some(c=>now<Date.parse(c.validFrom)||now>Date.parse(c.validTo)))throw Error('憑證或CA無效／已過期');
 if(!x.verify(authority.publicKey)||!x.checkIssued(authority))throw Error('只接受可直接由所選CA驗證的憑證；多層公司鏈請由IT提供相應簽發CA');
 if(!(net.isIP(host)?x.checkIP(host):x.checkHost(host))||!x.keyUsage?.includes('1.3.6.1.5.5.7.3.1'))throw Error('憑證缺少匹配SAN或serverAuth');
 if(!x.publicKey.equals(createPublicKey(createPrivateKey(key))))throw Error('私鑰與憑證不匹配');
 return {cert,key,ca,fingerprint:authority.fingerprint256};
}
const quote=s=>{if(!safeText(s))throw Error('設定含不接受的字元');return "'"+s.replaceAll('\\','/')+"'";};
const excludes=new Set(['.git','node_modules','data','dist','tools','release','evidence','.env','models.local.json','office.local.json','office-live-data','office-check-data']);
async function restrictNewWindowsFolders(folders){
 if(process.platform!=='win32')return;
 const execute=(binary,args)=>new Promise((resolve,reject)=>{const child=spawn(binary,args,{shell:false,windowsHide:true});let output='';child.stdout.on('data',b=>output=(output+b).slice(-8000));child.stderr.resume();child.on('error',()=>reject(Error('新平台目錄權限工具不可用')));child.on('exit',code=>code===0?resolve(output):reject(Error('新平台目錄ACL設定失敗；請選擇可管理的獨立目錄')));});
 const system=path.join(process.env.SystemRoot||'C:\\Windows','System32'),sid=(await execute(path.join(system,'whoami.exe'),['/user','/fo','csv','/nh'])).match(/S-1-5-(?:\d+-)*\d+/)?.[0];if(!sid)throw Error('無法確認安裝帳戶SID');
 for(const folder of folders)await execute(path.join(system,'icacls.exe'),[folder,'/inheritance:r','/grant:r',`*${sid}:(OI)(CI)F`,'*S-1-5-18:(OI)(CI)F','*S-1-5-32-544:(OI)(CI)F']);
}
export async function install(source,input,{npmCli=process.env.npm_execpath,onProgress=()=>{},runCommand}={}){
 const plan=await preflight(source,input);
 if(!input.confirmInstall)throw Error('先確認安裝變更清單');
 let imported;if(input.mode==='lan'&&input.tlsMode==='import')imported=await verifyImportedTls({...input,host:plan.host});
 if(!npmCli&&!runCommand)throw Error('請透過 npm run setup 啟動精靈');
 // No shell, user commands or service changes. stderr is kept out of setup reports.
 const run=runCommand||((args)=>new Promise((resolve,reject)=>{const p=spawn(process.execPath,[npmCli,...args],{cwd:plan.app,shell:false,windowsHide:true,stdio:'ignore',env:{...process.env,POC_JAVA_BIN:input.javaBin||'',POC_PDFTOPPM_BIN:input.pdfBin||''}});p.on('error',()=>reject(Error('無法啟動套件工具')));p.on('exit',c=>c===0?resolve():reject(Error('安裝步驟失敗：'+args.join(' ')+'；請核對網絡／依賴，不會自動回退舊平台')));}));
 await mkdir(plan.app,{recursive:true,mode:0o700});await mkdir(plan.data,{recursive:true,mode:0o700});
 await restrictNewWindowsFolders([plan.app,plan.data]);
 const report={version:plan.version,appDir:plan.app,dataDir:plan.data,status:'staged',steps:[],warnings:plan.warnings,changes:['建立獨立程式及資料目錄','在新目錄執行npm ci、build及OCR資料準備','建立首次Admin及本平台設定'],notChanged:['Hermes','防火牆','系統CA','舊平台'],generationTested:false,sessionIsolationTested:false,autoStartInstalled:false,nativeOfficeRequested:!!input.installOffice};
 const checkpoint=async()=>{await writeFile(path.join(plan.app,'install-report.local.json'),JSON.stringify(report,null,2),{mode:0o600});};
 const step=async(name,fn)=>{onProgress(name);await fn();report.steps.push(name);await checkpoint();};
 await checkpoint();
 try{
  await step('複製新平台檔案',()=>cp(plan.source,plan.app,{recursive:true,filter:async f=>{const rel=path.relative(plan.source,f).toLowerCase();return !(await lstat(f)).isSymbolicLink()&&!rel.split(path.sep).some(n=>excludes.has(n)||n.endsWith('.local')||n.endsWith('.local.json')||/\.(key|pem|pfx|p12|crt)$/i.test(n)||(n.startsWith('.env')&&n!=='.env.example'))&&!/^WINDOWS_.*_2026-10-24\.md$/.test(path.basename(f));}}));
  await mkdir(path.join(plan.app,'config'),{recursive:true});
  await step('安裝固定npm依賴（需registry網絡）',()=>run(['ci','--ignore-scripts']));
  await step('建置Web應用',()=>run(['run','build']));
  await step('準備中英OCR資料',()=>run(['run','search:ocr:setup']));
  if(input.installOffice)await step('下載原生Craft背景工具（官方固定版本及checksum）',()=>run(['run','office:install']));
  if(input.installJava)await step('下載本平台Java17（需批准外網）',()=>run(['run','search:java']));
  let tls='';
  if(input.mode==='lan'){
   if(imported){const dir=path.join(plan.app,'config/tls');await mkdir(dir,{mode:0o700});for(const [n,b]of [['server.crt',imported.cert],['server.key',imported.key],['ca.crt',imported.ca]])await writeFile(path.join(dir,n),b,{flag:'wx',mode:0o600});report.caFingerprint=imported.fingerprint;}
   else {const r=await setupTls(plan.app,{host:plan.host,bindHost:plan.host,port:plan.port});report.caFingerprint=r.fingerprint;}
   tls="POC_TLS_CERT='config/tls/server.crt'\nPOC_TLS_KEY='config/tls/server.key'\n";
  }
  const env=`POC_DATA_DIR=${quote(plan.data)}\nPOC_BIND_HOST=${quote(plan.host)}\nPORT=${plan.port}\nPOC_ALLOWED_HOSTS=${quote(plan.host+',localhost,127.0.0.1')}\n${tls}${input.javaBin?'POC_JAVA_BIN='+quote(input.javaBin)+'\n':''}${input.pdfBin?'POC_PDFTOPPM_BIN='+quote(input.pdfBin)+'\n':''}`;
  // setupTls may have created this file; only the fresh installation is modified.
  await writeFile(path.join(plan.app,'config/central.env.local'),env,{mode:0o600});
  await step('建立首次Admin及政策',async()=>{
   const {putUser,readUsers}=await import('../server/auth.mjs');
   await putUser(plan.data,{username:input.username,password:input.password,role:'admin'});
   const {CompanyPolicy}=await import('../server/company-policy.mjs');const policy=await new CompanyPolicy().init(plan.data);
   try{const accounts=await readUsers(plan.data);policy.update('setup','initial-accounts',d=>{d.accounts=accounts;d.bootstrapDone=true;});policy.enableSingleWorkspace();
    if(input.cloudApproved)policy.update('setup','cloud-approved',d=>{d.sharedWorkspace.inferencePolicy='approved-cloud';});
    if(input.hermes?.baseUrl){const {Gateway}=await import('../server/gateway.mjs');const gateway=await new Gateway(policy,plan.data,{}).init();gateway.save(accounts[0],{id:'hermes',label:'公司Hermes（雲端／混合）',protocol:'hermes',baseUrl:input.hermes.baseUrl,connectionScope:'loopback',inference:'mixed',model:input.hermes.model||'',models:input.hermes.model?[input.hermes.model]:[],apiKey:input.hermes.key||'',enabled:false,globalAccess:false,allowedUsers:[accounts[0].id]});report.hermesConfigured=true;report.warnings.push('Hermes已保存但停用：Admin須先完成會話／工具範圍及雲端政策確認，再啟用');}
   }finally{policy.close();}
  });
  report.status='configured';report.url=`${input.mode==='lan'?'https':'http'}://${plan.host.includes(':')?'['+plan.host+']':plan.host}:${plan.port}/`;
  report.startCommand='npm run central:start';report.pending=['首次啟動及登入','另一部電腦TLS／LAN','Hermes生成及會話／工具隔離','備份還原','開機自啟及無人登入依賴','5–10人容量'];
  await checkpoint();onProgress('設定完成；尚未啟動服務');return report;
 }catch(e){report.status='failed';report.failedStep=report.steps.length;report.error='步驟未完成；保留新目錄供檢查，沒有覆蓋舊平台。';await checkpoint();throw e;}
}

export async function startInstalled(report){
 if(report?.status!=='configured'||typeof report.appDir!=='string')throw Error('先完成新平台安裝');
 const config=path.join(report.appDir,'config/central.env.local');await access(config);
 const url=new URL(report.url);await availablePort(url.hostname.replace(/^\[|\]$/g,''),Number(url.port));
 const logDir=path.join(report.appDir,'logs');await mkdir(logDir,{recursive:true,mode:0o700});const log=await open(path.join(logDir,'platform.log'),'a',0o600);
 let child,failed=false;try{child=spawn(process.execPath,['--env-file=config/central.env.local','server/index.mjs'],{cwd:report.appDir,detached:true,windowsHide:true,shell:false,stdio:['ignore',log.fd,log.fd]});child.on('error',()=>failed=true);child.on('exit',()=>failed=true);}finally{await log.close();}
 child.unref();
 const ca=url.protocol==='https:'?await readFile(path.join(report.appDir,'config/tls/ca.crt')):null;
 for(let i=0;i<40;i++){
  if(failed)throw Error('新平台啟動失敗，請檢查新目錄logs/platform.log');
  try{
   const healthUrl=new URL('/api/health',url);
   const result=ca?await new Promise((resolve,reject)=>{
    const req=https.get(healthUrl,{ca,rejectUnauthorized:true,timeout:2000},res=>{
     let raw='';res.on('data',b=>raw+=b);
     res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(raw)});}catch{reject(Error('健康回應格式不正確'));}});
    });
    req.on('error',reject);req.on('timeout',()=>req.destroy());
   }):await fetch(healthUrl,{redirect:'error',signal:AbortSignal.timeout(2000)}).then(async r=>({status:r.status,body:await r.json()}));
   if(result.status===200&&result.body.version===report.version)return {started:true,pid:child.pid,url:report.url,version:report.version,health:200,tlsVerified:!!ca,autoStartInstalled:false,loginTested:false};
  }catch{}
  await new Promise(r=>setTimeout(r,250));
 }
 // Only this invocation's child can be terminated. Never stop unknown listeners.
 if(!failed)child.kill('SIGTERM');throw Error('新平台未在限時內通過健康檢查；只停止本輪啟動的程序');
}
