import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {isIP} from 'node:net';
import {mkdir,writeFile,readFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {X509Certificate} from 'node:crypto';
export async function setupTls(root,{host,names=[],port=4317,bindHost=host,openssl=process.env.POC_OPENSSL_BIN||(process.platform==='darwin'?'/usr/bin/openssl':'openssl')}={}){
 if(process.platform==='win32'&&openssl==='openssl'){try{await access('C:/Program Files/Git/usr/bin/openssl.exe');openssl='C:/Program Files/Git/usr/bin/openssl.exe';}catch{}}
 const valid=s=>typeof s==='string'&&(isIP(s)||/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,200}[a-zA-Z0-9])?$/.test(s));
 if(!valid(host)||names.some(s=>!valid(s)))throw new Error('請用 --host 提供 Mac 的固定內網 IP 或 DNS 名稱，可用 --name 加一個 DNS 名稱');
 if(!Number.isInteger(port)||port<1024||port>65535||!valid(bindHost))throw new Error('port／bind host 不正確');
 const envFile=path.join(root,'config/central.env.local');try{await access(envFile);throw new Error('central.env.local 已存在，請保留現有設定，勿覆蓋憑證');}catch(e){if(e.code!=='ENOENT')throw e;}
 const dest=path.join(root,'config/tls');await mkdir(path.join(root,'config'),{recursive:true});await mkdir(dest,{recursive:false,mode:0o700});
 const sans=[...new Set([host,...names,'localhost','127.0.0.1'])];let ip=0,dns=0;
 const config=`[req]\nprompt=no\ndistinguished_name=dn\n[dn]\nCN=Company AI Pilot\n[ca_ext]\nbasicConstraints=critical,CA:TRUE,pathlen:0\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid:always\n[server_ext]\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\nsubjectAltName=@alt\n[alt]\n${sans.map(s=>`${isIP(s)?'IP.'+(++ip):'DNS.'+(++dns)}=${s}`).join('\n')}\n`;
 const cfg=path.join(dest,'openssl.cnf');await writeFile(cfg,config);
 const run=args=>new Promise((resolve,reject)=>{const p=spawn(openssl,args,{shell:false,windowsHide:true,stdio:['ignore','ignore','pipe']});let error='';p.stderr.on('data',b=>error=(error+b).slice(-1000));p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(new Error('OpenSSL 失敗：'+error)));});
 const ca=path.join(dest,'ca.crt'),caKey=path.join(dest,'ca.key'),cert=path.join(dest,'server.crt'),key=path.join(dest,'server.key'),csr=path.join(dest,'server.csr');
 await writeFile(caKey,'',{flag:'wx',mode:0o600});await writeFile(key,'',{flag:'wx',mode:0o600});
 await run(['req','-x509','-newkey','rsa:3072','-nodes','-days','3650','-keyout',caKey,'-out',ca,'-config',cfg,'-extensions','ca_ext']);
 const serverCfg=path.join(dest,'server.cnf');await writeFile(serverCfg,config.replace('CN=Company AI Pilot',`CN=${host}`));
 await run(['req','-new','-newkey','rsa:3072','-nodes','-keyout',key,'-out',csr,'-config',serverCfg]);
 await run(['x509','-req','-in',csr,'-CA',ca,'-CAkey',caKey,'-CAcreateserial','-out',cert,'-days','365','-extfile',cfg,'-extensions','server_ext']);
 // Restrict generated keys where POSIX permissions apply. Windows deployment must
 // use the account's private project folder; no system certificate store is changed.
 const {chmod}=await import('node:fs/promises');await chmod(key,0o600);await chmod(caKey,0o600);
 await writeFile(envFile,`POC_BIND_HOST=${bindHost}\nPORT=${port}\nPOC_ALLOWED_HOSTS=${sans.join(',')}\nPOC_TLS_CERT=config/tls/server.crt\nPOC_TLS_KEY=config/tls/server.key\n`,{flag:'wx',mode:0o600});
 return {host,port,bindHost,url:`https://${host}:${port}`,caFile:ca,fingerprint:new X509Certificate(await readFile(ca)).fingerprint256};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),value=n=>args[args.indexOf('--'+n)+1],root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const r=await setupTls(root,{host:args.includes('--host')?value('host'):null,names:args.includes('--name')?[value('name')]:[],...(args.includes('--port')?{port:Number(value('port'))}:{}),...(args.includes('--bind')?{bindHost:value('bind')}: {})});console.log(JSON.stringify(r,null,2));console.log('僅建立新平台憑證及設定；沒有安裝信任憑證、改防火牆或啟動服務。');
}
