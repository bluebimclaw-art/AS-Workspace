import {execFileSync} from 'node:child_process';
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,readFile,writeFile,rm,access} from 'node:fs/promises';
import {randomUUID,createHash,X509Certificate} from 'node:crypto';
import {createApp} from '../server/index.mjs';
import {putUser} from '../server/auth.mjs';
import {setupTls} from '../scripts/setup-central-tls.mjs';
import {networkConfig} from '../server/network.mjs';
import {lockDataDirectory} from '../server/server-lock.mjs';
import {Store} from '../server/store.mjs';
import {AiQueue} from '../server/ai-queue.mjs';
import JSZip from 'jszip';
const password='Synthetic-only-password-42!',metrics={kind:'REAL local HTTPS + independent sessions + disk storage; SIMULATED model; not Mac/LAN/browser proof',checks:[]};
let dir,app,modelServer,port,ca,clients=[],admin,viewer,active=0,maxActive=0,modelCalls=[],modelProfiles;
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s.address().port)));
const close=s=>new Promise(r=>{s.closeAllConnections();s.close(r);});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function waitJobs(jobs){for(let i=0;i<300;i++){const rows=await Promise.all(jobs.map(async({client,id})=>(await client.get('/api/jobs/'+id)).data));if(rows.every(j=>['succeeded','failed','cancelled','interrupted'].includes(j.status)))return rows;await delay(25);}throw new Error('Jobs did not finish');}
class Client {
 constructor(){this.cookie='';this.csrf='';}
 request(route,body,{method=body===undefined?'GET':'POST',headers={}}={}){return new Promise((resolve,reject)=>{
  const bytes=body===undefined?null:Buffer.from(JSON.stringify(body));const req=https.request({hostname:'127.0.0.1',servername:'localhost',port,path:route,method,ca,headers:{...(this.cookie?{Cookie:this.cookie}:{}),...(bytes?{'Content-Type':'application/json','Content-Length':bytes.length,Origin:`https://127.0.0.1:${port}`}:{}),...(this.csrf?{'X-CSRF-Token':this.csrf}:{}),...headers}},res=>{const chunks=[];res.on('data',b=>chunks.push(b));res.on('end',()=>{const raw=Buffer.concat(chunks);let data;try{data=JSON.parse(raw);}catch{data=raw;}resolve({status:res.statusCode,headers:res.headers,data,bytes:raw});});});req.on('error',reject);req.end(bytes);
 });}
 get(route){return this.request(route);}
 post(route,body){return this.request(route,body);}
 async login(username){const r=await this.post('/api/auth/login',{username,password});assert.equal(r.status,200,JSON.stringify(r.data));this.cookie=r.headers['set-cookie'][0].split(';')[0];this.csrf=r.data.csrf;this.user=r.data.user;return r;}
 async chat(prompt,options={}){return this.post('/api/chat',{app:'files',prompt,provider:'ollama',requestId:randomUUID(),...options});}
}
before(async()=>{
 dir=await mkdtemp(path.join(os.tmpdir(),'central-pilot-'));
 let openssl=process.env.POC_OPENSSL_BIN||'openssl';if(process.platform==='win32'){try{await access('C:/Program Files/Git/usr/bin/openssl.exe');openssl='C:/Program Files/Git/usr/bin/openssl.exe';}catch{}}
 const tls=await setupTls(dir,{host:'192.0.2.10',port:4331,openssl});ca=await readFile(tls.caFile);
 assert.equal(tls.url,'https://192.0.2.10:4331');assert.match(await readFile(path.join(dir,'config/central.env.local'),'utf8'),/PORT=4331/);
 execFileSync(openssl,['verify','-x509_strict','-purpose','sslserver','-verify_ip','192.0.2.10','-CAfile',tls.caFile,path.join(dir,'config/tls/server.crt')],{stdio:'pipe'});
 const leaf=new X509Certificate(await readFile(path.join(dir,'config/tls/server.crt'))),authority=new X509Certificate(ca);
 assert.notEqual(leaf.subject,authority.subject,'CA and server must not share subject');assert.equal(leaf.checkIP('127.0.0.1'),'127.0.0.1');assert.equal(leaf.verify(authority.publicKey),true);
 modelServer=http.createServer(async(req,res)=>{let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw);active++;maxActive=Math.max(maxActive,active);modelCalls.push(body);await delay(body.model==='slow'?400:45);active--;res.setHeader('Content-Type','application/json');if(body.model==='failure'){res.writeHead(503);res.end('{}');}else res.end(JSON.stringify({message:{content:`SIMULATED ${body.model} [1]`}}));});
 const modelPort=await listen(modelServer);
 modelProfiles={ollama:{id:'ollama',label:'Synthetic model',protocol:'ollama',location:'local',inference:'local',baseUrl:`http://127.0.0.1:${modelPort}`,model:'fast',timeoutMs:5000,key:'SYNTHETIC-SERVER-ONLY-KEY'}};
 app=await createApp({dataDir:dir,security:{auth:true,tls:{key:await readFile(path.join(dir,'config/tls/server.key')),cert:await readFile(path.join(dir,'config/tls/server.crt'))}},modelProfiles});port=await listen(app.server);
 for(let i=0;i<10;i++){await putUser(dir,{username:'pilot'+i,password,role:'member'});const c=new Client();await c.login('pilot'+i);clients.push(c);}
 await putUser(dir,{username:'admin',password,role:'admin'});admin=new Client();await admin.login('admin');await putUser(dir,{username:'viewer',password,role:'viewer'});viewer=new Client();await viewer.login('viewer');
});
after(async()=>{
 if(app){await app.queue.close();await close(app.server);}if(modelServer)await close(modelServer);
 metrics.platform=process.platform;metrics.node=process.version;metrics.modelMaxConcurrent=maxActive;metrics.modelCalls=modelCalls.length;await writeFile('evidence/central-pilot-tests.json',JSON.stringify(metrics,null,2));if(dir)await rm(dir,{recursive:true,force:true});
});
test('HTTPS login: unauthenticated reads/downloads denied; Secure HttpOnly cookies; CSRF and hostile Host blocked',async()=>{
 const anon=new Client();assert.equal((await anon.get('/api/state')).status,401);assert.equal((await anon.get('/api/project/files/no-file')).status,401);
 const page=await anon.get('/');assert.notEqual(page.status,500,'anonymous static login page must not dereference an absent session');assert.ok([200,404].includes(page.status));if(page.status===200)assert.match(page.bytes.toString(),/id="root"/);
 assert.equal((await anon.post('/api/health',{})).status,401);
 const login=await anon.login('pilot0');assert.match(login.headers['set-cookie'][0],/HttpOnly/);assert.match(login.headers['set-cookie'][0],/Secure/);assert.match(login.headers['set-cookie'][0],/SameSite=Strict/);
 assert.equal((await anon.request('/api/assets',{name:'bad',text:'bad'},{headers:{'X-CSRF-Token':'wrong'}})).status,403);
 assert.equal((await anon.request('/api/assets',{name:'bad',text:'bad'},{headers:{Origin:'https://evil.example'}})).status,403);
 assert.equal((await anon.request('/api/state',undefined,{headers:{Host:'evil.example'}})).status,403);
 const out=await anon.post('/api/auth/logout',{});assert.equal(out.status,200);assert.equal((await anon.get('/api/state')).status,401);
 metrics.checks.push('HTTPS cookies, login, logout, all private API reads gated, CSRF/origin/host refusals');
});
test('roles: viewer can read/download but cannot edit, call AI, inspect audit or use another user job',async()=>{
 const f=(await clients[0].post('/api/project/files',{name:'shared.txt',base64:Buffer.from('Shared source').toString('base64')})).data;
 assert.equal((await viewer.get('/api/project/files/'+f.id)).status,200);assert.equal((await viewer.post('/api/project/files',{name:'bad.txt',base64:'YQ=='})).status,403);assert.equal((await viewer.chat('AI')).status,403);assert.equal((await viewer.get('/api/admin/audit')).status,403);assert.equal((await admin.get('/api/admin/audit')).status,200);
 assert.equal((await viewer.post('/api/office/tasks',{tool:'wordcraft',action:'create',requestId:randomUUID()})).status,403);
 const job=(await clients[0].chat('PRIVATE-ALPHA-ONLY')).data;await waitJobs([{client:clients[0],id:job.id}]);assert.equal((await clients[1].get('/api/jobs/'+job.id)).status,404);
 const state=(await clients[1].get('/api/state')).data;assert.equal(state.chats.length,0);assert.ok(!('aiInputs'in state));assert.ok(!JSON.stringify(state).includes('PRIVATE-ALPHA-ONLY'));assert.ok(!('token'in (state.leases[0]||{})));
 const adminJob=(await admin.get('/api/jobs/'+job.id)).data;assert.equal(adminJob.result,undefined);
 metrics.checks.push('Viewer write/AI denial, audit authorization, personal chat/job privacy, queue inputs/lease secrets hidden');
});

test('version-pinned download: viewer receives MIME, safe Unicode name and exact bytes; PDF preview stays inline',async()=>{
 const archive=new JSZip();archive.file('xl/workbook.xml','<workbook><sheet name="繁體中文"/></workbook>');const bytes=await archive.generateAsync({type:'nodebuffer'}),name="繁體'測試.xlsx";
 const created=await clients[0].post('/api/project/files',{name,base64:bytes.toString('base64')});assert.equal(created.status,201);const f=created.data;
 const route=`/api/project/files/${f.id}?version=1&download=1`,r=await viewer.get(route);
 assert.equal(r.status,200);assert.equal(r.headers['content-type'],'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
 assert.match(r.headers['content-disposition'],/^attachment;/);assert.ok(r.headers['content-disposition'].includes('%27'));assert.equal(r.headers['content-length'],String(bytes.length));assert.equal(r.headers['cache-control'],'no-store');assert.equal(r.headers['x-file-version'],'1');assert.equal(r.headers['x-file-sha256'],createHash('sha256').update(bytes).digest('hex'));assert.deepEqual(r.bytes,bytes);
 assert.equal((await new Client().get(route)).status,401);assert.equal((await viewer.get(`/api/project/files/${f.id}?version=999&download=1`)).status,404);
 const pdf=(await clients[0].post('/api/project/files',{name:'preview.pdf',base64:Buffer.from('%PDF-synthetic').toString('base64')})).data;
 assert.match((await viewer.get(`/api/project/files/${pdf.id}?version=1`)).headers['content-disposition'],/^inline;/);
 assert.match((await viewer.get(`/api/project/files/${pdf.id}?version=1&download=1`)).headers['content-disposition'],/^attachment;/);
 metrics.checks.push('Authenticated version-pinned downloads: Unicode filename, MIME, bytes/hash/length, viewer allowed, anonymous denied, PDF preview/download split');
});
test('file leases + optimistic versions: simultaneous editors, session binding, expiry and original version preservation',async()=>{
 const [a,b]=clients;const f=(await a.post('/api/project/files',{name:'conflict.txt',base64:Buffer.from('original').toString('base64')})).data;
 const lease=(await a.post(`/api/project/files/${f.id}/lease`,{expectedVersion:1})).data;assert.ok(lease.token);
 assert.equal((await b.post(`/api/project/files/${f.id}/lease`,{expectedVersion:1})).status,409);
 assert.equal((await b.post('/api/project/files',{id:f.id,name:f.name,expectedVersion:1,base64:'Yg==',leaseToken:lease.token})).status,409);
 const update=await a.post('/api/project/files',{id:f.id,name:f.name,expectedVersion:1,base64:Buffer.from('revision 2').toString('base64'),leaseToken:lease.token});assert.equal(update.data.version,2);
 assert.equal((await a.post('/api/project/files',{id:f.id,name:f.name,expectedVersion:1,base64:'YQ==',leaseToken:lease.token})).status,409);
 const sameUserNewSession=new Client();await sameUserNewSession.login('pilot0');assert.equal((await sameUserNewSession.post(`/api/project/files/${f.id}/lease`,{expectedVersion:2,token:lease.token})).status,409);
 await app.store.mutate(()=>{app.leases.current(f.id).expiresAt=Date.now()-1;});const second=(await b.post(`/api/project/files/${f.id}/lease`,{expectedVersion:2})).data;assert.ok(second.token);
 assert.equal((await a.post('/api/project/files',{id:f.id,name:f.name,expectedVersion:2,base64:'YQ==',leaseToken:lease.token})).status,409);
 assert.equal((await a.get(`/api/project/files/${f.id}?version=1`)).bytes.toString(),'original');
 const original=await a.get(`/api/project/files/${f.id}?version=1`);assert.equal((await b.post('/api/project/files',{id:f.id,name:f.name,expectedVersion:2,base64:original.bytes.toString('base64'),leaseToken:second.token})).data.version,3);
 const copy=await a.post('/api/project/files',{name:'conflict-copy.txt',base64:Buffer.from('unsaved copy').toString('base64')});assert.equal(copy.status,201);assert.notEqual(copy.data.id,f.id);
 metrics.checks.push('Lease owner/session/token, expiry takeover, stale write refusal, restore v1 into v3, save-copy without overwrite');
});
test('10 authenticated independent clients: FIFO AI queue, one active call, immutable model choice and duplicate submission idempotency',async()=>{
 const initial=modelCalls.length,started=Date.now(),ids=await Promise.all(clients.map(async(c,i)=>{const requestId=randomUUID(),body={app:'files',prompt:'LOAD-'+i,provider:'ollama',model:'choice-'+i,requestId};const r=await c.post('/api/chat',body);assert.equal(r.status,202);const duplicate=await c.post('/api/chat',body);assert.equal(duplicate.data.id,r.data.id);return {client:c,id:r.data.id,model:'choice-'+i};}));
 const rows=await waitJobs(ids);assert.ok(rows.every(j=>j.status==='succeeded'));assert.equal(modelCalls.length-initial,10);assert.equal(maxActive,1);assert.deepEqual(modelCalls.slice(initial).map(b=>b.model),app.store.db.aiJobs.filter(j=>ids.some(x=>x.id===j.id)).map(j=>j.model));
 for(let i=0;i<ids.length;i++){const state=(await ids[i].client.get('/api/state')).data;assert.ok(state.chats.every(c=>c.userId===ids[i].client.user.id));}
 metrics.tenClients={allCompleted:true,modelMaxConcurrent:maxActive,duplicateDidNotGenerateTwice:true,elapsedMs:Date.now()-started,note:'Synthetic model 45ms/response; not real inference speed'};
});
test('queued file context is snapshotted; cancellation and model failure do not block following tasks',async()=>{
 const [a,b,c,d]=clients;const slow=(await a.chat('slow hold',{model:'slow',app:'search'})).data;
 for(let i=0;i<100&&app.queue.find(slow.id,a.user).status!=='running';i++)await delay(5);
 assert.equal((await a.post(`/api/jobs/${slow.id}/cancel`,{})).status,409);
 const f=(await b.post('/api/project/files',{name:'snapshot.txt',base64:Buffer.from('SNAPSHOT-V1').toString('base64')})).data;
 const snap=(await b.chat('read snapshot',{fileId:f.id,expectedVersion:1})).data;
 const lease=(await b.post(`/api/project/files/${f.id}/lease`,{expectedVersion:1})).data;await b.post('/api/project/files',{id:f.id,name:f.name,expectedVersion:1,leaseToken:lease.token,base64:Buffer.from('SNAPSHOT-V2').toString('base64')});
 const cancel=(await c.chat('CANCEL-NOT-SENT',{app:'search'})).data;assert.equal((await c.post(`/api/jobs/${cancel.id}/cancel`,{})).data.status,'cancelled');
 const failed=(await d.chat('force failure',{model:'failure',app:'search'})).data;
 const rows=await waitJobs([{client:a,id:slow.id},{client:b,id:snap.id},{client:c,id:cancel.id},{client:d,id:failed.id}]);assert.deepEqual(rows.map(j=>j.status),['succeeded','succeeded','cancelled','failed']);
 const request=modelCalls.find(b=>b.messages.at(-1).content.includes('read snapshot'));assert.ok(request.messages.at(-1).content.includes('SNAPSHOT-V1'));assert.ok(!request.messages.at(-1).content.includes('SNAPSHOT-V2'));assert.ok(!modelCalls.some(b=>b.messages.at(-1).content.includes('CANCEL-NOT-SENT')));
 const recovery=(await d.chat('after failure',{app:'search'})).data;assert.equal((await waitJobs([{client:d,id:recovery.id}]))[0].status,'succeeded');
 metrics.checks.push('Pinned submission context, queued-only cancellation, failures recorded and queue continues, no automatic fallback');
});
test('per-user queue backpressure rejects a fourth outstanding task',async()=>{
 const a=clients[8],jobs=[];for(const appName of ['gridcraft','wordcraft','deckcraft']){const r=await a.chat('limit',{model:'slow',app:appName});assert.equal(r.status,202);jobs.push({client:a,id:r.data.id});}
 assert.equal((await a.chat('fourth',{app:'pdfcraft'})).status,429);for(const job of jobs){const row=(await a.get('/api/jobs/'+job.id)).data;if(row.status==='queued')await a.post(`/api/jobs/${job.id}/cancel`,{});}await waitJobs(jobs);metrics.checks.push('Three outstanding jobs per user; excess submission returns 429');
});
test('queued route change is refused; provider keys are never persisted in job snapshots',async()=>{
 const a=clients[5],b=clients[6],hold=(await a.chat('route hold',{app:'search',model:'slow'})).data;for(let i=0;i<100&&app.queue.find(hold.id,a.user).status!=='running';i++)await delay(5);
 const waiting=(await b.chat('ROUTE-MUST-NOT-BE-SENT',{app:'search'})).data;
 assert.ok(!JSON.stringify(app.store.db.aiInputs).includes('SYNTHETIC-SERVER-ONLY-KEY'));
 const url=modelProfiles.ollama.baseUrl;modelProfiles.ollama.baseUrl+='/changed';
 try{const rows=await waitJobs([{client:a,id:hold.id},{client:b,id:waiting.id}]);assert.equal(rows[1].status,'failed');assert.match(rows[1].error,/路由設定已改/);assert.ok(!modelCalls.some(b=>b.messages.at(-1).content.includes('ROUTE-MUST-NOT-BE-SENT')));}finally{modelProfiles.ollama.baseUrl=url;}
 metrics.checks.push('No provider key persisted; changed route fails before network delivery');
});
test('global queue bound rejects overflow before preparing or charging a task',async()=>{
 const temp=await mkdtemp(path.join(os.tmpdir(),'bounded-queue-')),store=await new Store(temp).init();let unblock;const gate=new Promise(r=>unblock=r),q=await new AiQueue(store,()=>gate,{limit:2,perUser:10}).init();const user={id:'test',name:'test',role:'member'};
 try{await q.submit(user,'request-one',async()=>({kind:'test'}));await q.submit(user,'request-two',async()=>({kind:'test'}));let prepared=false;await assert.rejects(q.submit(user,'request-three',async()=>{prepared=true;return {kind:'test'};}),e=>e.status===429);assert.equal(prepared,false);metrics.checks.push('Global queue bound rejects overflow before task preparation');}finally{unblock({});await q.close();await rm(temp,{recursive:true,force:true});}
});
test('password reset and disabled accounts invalidate existing sessions',async()=>{
 await putUser(dir,{username:'temporary',password,role:'member'});const c=new Client();await c.login('temporary');await putUser(dir,{username:'temporary',password,role:'member',reset:true});assert.equal((await c.get('/api/state')).status,401);await c.login('temporary');await putUser(dir,{username:'temporary',role:'member',disabled:true,reset:true});assert.equal((await c.get('/api/state')).status,401);metrics.checks.push('Password reset and disable revoke old sessions');
});
test('login throttling and board version conflict are enforced server-side',async()=>{
 const c=new Client();for(let i=0;i<5;i++)assert.equal((await c.post('/api/auth/login',{username:'nonexistent',password:'wrong'})).status,401);assert.equal((await c.post('/api/auth/login',{username:'nonexistent',password:'wrong'})).status,429);
 const a=clients[0],b=clients[1],board=(await a.post('/api/boards',{name:'shared board',elements:[]})).data;assert.equal((await b.post('/api/boards',{id:board.id,expectedVersion:1,name:'b edit',elements:[]})).status,200);assert.equal((await a.post('/api/boards',{id:board.id,expectedVersion:1,name:'a stale edit',elements:[]})).status,409);metrics.checks.push('Login throttling and board optimistic conflict protection');
});
test('restart interrupts queued/running work without replay; data lock blocks second writer; LAN HTTP refused',async()=>{
 const restartDir=await mkdtemp(path.join(os.tmpdir(),'pilot-restart-'));let first,second,release;
 try{
  first=await createApp({dataDir:restartDir});await first.store.mutate(db=>{db.aiJobs.push({id:'restart-job',userId:'old',turnId:'restart-turn',status:'queued'});db.aiInputs['restart-job']={kind:'chat'};db.chats.push({userId:'old',messages:[{id:'restart-turn',status:'queued'}]});});await first.queue.close();
  second=await createApp({dataDir:restartDir});assert.equal(second.store.db.aiJobs[0].status,'interrupted');assert.equal(second.store.db.chats[0].messages[0].status,'interrupted');assert.equal(Object.keys(second.store.db.aiInputs).length,0);assert.equal(second.store.db.editLeases.length,0);
  release=await lockDataDirectory(restartDir);await assert.rejects(lockDataDirectory(restartDir),/已有平台/);
  await assert.rejects(networkConfig(restartDir,{POC_BIND_HOST:'0.0.0.0'}),/HTTPS/);assert.equal((await networkConfig(restartDir,{})).auth,true);metrics.checks.push('Durable interrupted status, no restart replay, single-writer data lock, no cleartext LAN startup');
 }finally{await first?.queue.close();await second?.queue.close();if(release)await release();await rm(restartDir,{recursive:true,force:true});}
});
