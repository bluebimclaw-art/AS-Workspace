import {RevitRelay} from './revit-relay.mjs';
import {discoverHermes} from './hermes-discovery.mjs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {access as fileAccess} from 'node:fs/promises';
import {Auth,passwordHash,readUsers,publicUser} from './auth.mjs';
import {CompanyPolicy,FEATURES,OPS,fail,validateGrants} from './company-policy.mjs';
import {checkOrigin} from './network.mjs';
import {Gateway,ADAPTERS} from './gateway.mjs';
import {profiles,modelList} from './models.mjs';
const cookie=req=>Object.fromEntries((req.headers.cookie||'').split(';').map(x=>x.trim().split('=')));
const name=v=>{if(typeof v!=='string'||!v.trim()||v.length>100)throw fail('名稱須為1–100字元',400);return v.trim();};
export async function createCompanyApp({dataDir,security,modelProfiles,officeConfig,appFactory,workspaceMode='single'}={}){
 if(!security?.auth)throw Error('Company mode requires authentication');
 const createApp=appFactory||(await import('./index.mjs')).createApp;
 try{await fileAccess(path.join(dataDir,'company.sqlite'));}catch(e){if(e.code!=='ENOENT')throw e;if(!(await readUsers(dataDir)).some(u=>u.role==='admin'&&!u.disabled))throw Error('首次公司模式啟動前，先使用 users CLI 建立啟用的admin帳戶；尚未遷移資料。');}
 const policy=await new CompanyPolicy().init(dataDir);if(!policy.state.accounts){const accounts=await readUsers(dataDir);policy.update('system','accounts-migration',d=>{d.accounts=accounts;});}
 const revitRelay=new RevitRelay(policy);
 const cookieName='as_'+createHash('sha256').update(path.resolve(dataDir)).digest('hex').slice(0,12),projectCookie=cookieName+'_project';
 const auth=new Auth(dataDir,{secure:!!security.tls,...security.sessionOptions,usersReader:()=>policy.state.accounts,cookieName}),apps=new Map(),gateway=await new Gateway(policy,dataDir,modelProfiles||profiles).init();let adminTail=Promise.resolve(),executionTail=Promise.resolve(),submissions=Promise.resolve(),activeRequests=0,closing=false;
 // No implicit admin content access and no automatic membership for newly created accounts.
 if(!policy.state.bootstrapDone){const existing=policy.state.accounts;policy.update('system','bootstrap-legacy',d=>{for(const u of existing.filter(u=>!u.disabled)){d.users[u.id]={allow:[...FEATURES],deny:[]};d.members.push({projectId:'legacy',userId:u.id,allow:[...FEATURES],ops:u.role==='viewer'?['read','download']:[...OPS]});}d.bootstrapDone=true;});}
 if(workspaceMode==='single')policy.enableSingleWorkspace();
 const gate=async(input,job,signal)=>{const user=await auth.user(job.userId),c=input.company;if(!c)throw fail('任務缺少項目授權');policy.require(user,c.projectId,c.feature,c.op);if(c.app)policy.require(user,c.projectId,c.app,'read');if(input.provider!=='office')gateway.require(user,c.projectId,input.provider,input.model);signal?.throwIfAborted();};
 // Project queues share one execution permit; authority is rechecked after waiting.
 const taskGate=async(input,job,signal)=>{let release;const prior=executionTail;executionTail=new Promise(r=>release=r);await prior;try{await gate(input,job,signal);}catch(e){release();throw e;}input.__release=release;};
 async function appFor(id){if(!apps.has(id)){const promise=createApp({dataDir:id==='legacy'?dataDir:path.join(dataDir,'projects',id),security,modelProfiles:()=>gateway.profiles(),officeConfig,sharedAuth:auth,sqlite:true,beforeTask:taskGate});apps.set(id,promise);try{const app=await promise;const execute=app.queue.execute;app.queue.execute=async(...args)=>{try{return await execute(...args);}finally{args[0].__release?.();delete args[0].__release;}};}catch(e){apps.delete(id);throw e;}}return apps.get(id);}
 const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 const handler=async(req,res)=>{if(closing)return send(res,503,{error:'平台維護中，請稍後重試'});activeRequests++;try{
  const url=new URL(req.url,'http://localhost');if(!checkOrigin(req,!!security.tls,security.allowedHosts||['localhost','127.0.0.1']))throw fail('Host 或來源不接受');const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);if(!local&&!security.tls)throw fail('跨機連線需要 HTTPS');
  if(url.pathname.startsWith('/api/connectors/revit/')){if(req.method!=='POST')throw fail('只接受固定Connector POST',405);let raw='';for await(const b of req){raw+=b;if(Buffer.byteLength(raw)>100000)throw fail('結果過大',413);}const body=JSON.parse(raw||'{}'),token=(req.headers.authorization||'').replace(/^Bearer /,'');const route=url.pathname.slice('/api/connectors/revit/'.length);if(route==='poll')return send(res,200,revitRelay.poll(token,body));if(route==='report')return send(res,200,revitRelay.report(token,body));throw fail('沒有此Connector操作',404);}
  if(!url.pathname.startsWith('/api/')||url.pathname==='/api/health'||url.pathname==='/api/auth/login')return await (await appFor('legacy')).handler(req,res);
  const identity=await auth.authenticate(req),user=identity.user;let body={};if(req.method==='POST'){auth.csrf(req,identity.session);let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>8_000_000)throw fail('內容超過限制',413);}body=JSON.parse(raw||'{}');req.companyBody=body;}
  if(url.pathname==='/api/auth/me')return send(res,200,{user,csrf:identity.session.csrf});
  if(url.pathname==='/api/auth/logout'){for(const p of apps.values())await(await p).leases.releaseSession(identity.session.id);res.setHeader('Set-Cookie',auth.logout(identity.key));return send(res,200,{ok:true});}
  const projects=policy.projects(user),requested=url.searchParams.get('project'),projectId=policy.singleWorkspace?'shared':requested||cookie(req)[projectCookie]||projects[0]?.id;if(policy.singleWorkspace&&requested&&requested!=='shared')throw fail('項目隔離已取消；請從平台首頁重新開啟',404);
  if(url.pathname==='/api/company/select'&&req.method==='POST'){if(policy.singleWorkspace)throw fail('此版本只有公司工作空間，沒有項目切換',410);if(!policy.access(user,body.projectId).ops.includes('read'))throw fail('沒有閱讀權限');res.setHeader('Set-Cookie',`${projectCookie}=${body.projectId}; Path=/; HttpOnly; SameSite=Strict${security.tls?'; Secure':''}`);return send(res,200,{ok:true});}
  if(url.pathname.startsWith('/api/company/admin')){
   if(user.role!=='admin')throw fail('只供管理員');
   if(req.method==='GET'&&url.pathname==='/api/company/admin'){const users=policy.state.accounts.map(u=>({...publicUser(u),disabled:u.disabled})),snapshot=policy.snapshot();return send(res,200,{...snapshot,revitDevices:revitRelay.devices(),workspaceMode:policy.singleWorkspace?'single':'projects',workspace:policy.state.sharedWorkspace,archivedProjectCount:policy.singleWorkspace?snapshot.projects.length:0,providers:gateway.public(),adapters:ADAPTERS,settings:snapshot.users,users,features:FEATURES,operations:OPS,limits:snapshot.limits||{global:30,perUser:3,dailyImages:0},system:{platform:process.platform,node:process.version,rssBytes:process.memoryUsage().rss,storage:'SQLite WAL snapshot / per-project files',activeProjects:apps.size,executionConcurrency:1}});}
   if(req.method!=='POST')throw fail('找不到接口',404);
   const work=async()=>{
    const current=await auth.user(user.id);if(current.role!=='admin')throw fail('管理權限已撤回');const state=policy.snapshot();if(body.expectedVersion!==state.version)throw fail('管理設定已有新版本，請重新載入',409);
    const route=url.pathname.slice('/api/company/admin/'.length);if(policy.singleWorkspace&&['project','member'].includes(route))throw fail('請在使用者頁管理程式權限；項目管理已取消',410);
    if(route==='revit-pair')return revitRelay.issue(user,body);
    if(route==='revit-revoke')return revitRelay.revoke(user,body);
    if(route==='hermes-discover')return discoverHermes({baseUrl:body.baseUrl});
    if(route==='provider')return gateway.save(user,body);
    if(route==='provider-check'){const p=gateway.profiles()[body.id];if(!p)throw fail('服務不存在',404);try{return {models:await modelList({...p,enabled:true}),generationTested:false};}catch{throw fail('服務連線或模型清單失敗；請核對端點與認證。未提交生成。',502);}}
    if(route==='user'){
     const users=policy.state.accounts,old=users.find(u=>u.username===body.username);if(!/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(body.username||'')||!['admin','member','viewer'].includes(body.role)||typeof body.disabled!=='boolean')throw fail('帳戶設定不正確',400);
     if(old?.role==='admin'&&!old.disabled&&(body.disabled||body.role!=='admin')&&users.filter(u=>u.role==='admin'&&!u.disabled).length<=1)throw fail('不能停用或降級最後一名管理員',409);
     validateGrants(body);if(!old&&!body.password)throw fail('新增帳戶必須提供密碼',400);const credentials=body.password?await passwordHash(body.password):old,u={id:old?.id||randomUUID(),username:body.username,name:name(body.name||body.username),role:body.role,disabled:body.disabled,passwordVersion:(old?.passwordVersion||0)+1,salt:credentials.salt,hash:credentials.hash};policy.update(user.id,'account-update:'+u.id,d=>{const i=d.accounts.findIndex(x=>x.id===u.id);if(i<0)d.accounts.push(u);else d.accounts[i]=u;d.users[u.id]={allow:body.allow||[],deny:body.deny||[],ops:body.ops||d.users[u.id]?.ops||(u.role==='viewer'?['read','download']:['read','download','edit','ai'])};},state.version);return {user:publicUser(u)};
    }
    const knownUsers=new Set(policy.state.accounts.map(u=>u.id));if(route==='member'&&body.userId&&!knownUsers.has(body.userId))throw fail('使用者不存在',404);if(route==='group'&&(!Array.isArray(body.users)||body.users.some(id=>!knownUsers.has(id))))throw fail('群組包含不存在的使用者',400);
    return policy.update(user.id,route,d=>{
     validateGrants(body);
     if(route==='workspace'){if(!['local-only','approved-cloud'].includes(body.inferencePolicy))throw fail('資料政策不正確',400);d.sharedWorkspace.inferencePolicy=body.inferencePolicy;return {ok:true};}
     if(route==='limits'){if(!Number.isInteger(body.global)||body.global<1||body.global>100||!Number.isInteger(body.perUser)||body.perUser<1||body.perUser>10||body.perUser>body.global)throw fail('全域上限1–100，每人上限1–10且不可超過全域',400);if(body.dailyImages!==undefined&&(!Number.isInteger(body.dailyImages)||body.dailyImages<0||body.dailyImages>1000))throw fail('每日生圖上限須為0–1000',400);d.limits={global:body.global,perUser:body.perUser,dailyImages:body.dailyImages??d.limits?.dailyImages??0};return {ok:true};}
     if(route==='project'){const id=body.id||randomUUID();let p=d.projects.find(p=>p.id===id);if(body.id&&!p)throw fail('找不到項目',404);if(body.inferencePolicy!==undefined&&!['approved-cloud','local-only'].includes(body.inferencePolicy))throw fail('資料政策不正確',400);if(p){p.name=name(body.name);p.disabled=!!body.disabled;p.inferencePolicy=body.inferencePolicy||p.inferencePolicy||'approved-cloud';}else d.projects.push({id,name:name(body.name),disabled:false,inferencePolicy:body.inferencePolicy||'approved-cloud'});return {id};}
     if(route==='member'){if(!d.projects.some(p=>p.id===body.projectId))throw fail('項目不存在',404);if(!!body.userId===!!body.groupId)throw fail('請指定使用者或群組',400);if(body.groupId&&!d.groups.some(g=>g.id===body.groupId))throw fail('群組不存在',404);const target=body.userId?{userId:body.userId}:{groupId:body.groupId};d.members=d.members.filter(m=>!(m.projectId===body.projectId&&(body.userId?m.userId===body.userId:m.groupId===body.groupId)));if(!body.remove)d.members.push({projectId:body.projectId,...target,allow:body.allow||[],deny:body.deny||[],ops:body.ops||[],denyOps:body.denyOps||[]});return {ok:true};}
     if(route==='group'){const id=body.id||randomUUID();if(!Array.isArray(body.users)||body.users.some(x=>typeof x!=='string'))throw fail('群組成員不正確',400);const g={id,name:name(body.name),users:[...new Set(body.users)],allow:body.allow||[],deny:body.deny||[]};const i=d.groups.findIndex(g=>g.id===id);if(body.id&&i<0)throw fail('群組不存在',404);if(i<0)d.groups.push(g);else d.groups[i]=g;return {id};}
     throw fail('找不到管理操作',404);
    },state.version);
   };const job=adminTail.then(work);adminTail=job.catch(()=>{});return send(res,200,await job);
  }
  const emptyState=()=>send(res,200,{assets:[],documents:[],boards:[],runs:[],projectFiles:[],officeFiles:[],chats:[],queue:[],leases:[],profiles:[],user,workspace:{projects,project:null,features:[],ops:[],mode:policy.singleWorkspace?'single':'projects'}});
  if(!projectId){if(url.pathname==='/api/state')return emptyState();throw fail('尚未獲分配項目',404);}
  let access;try{access=policy.access(user,projectId);if(!access.ops.includes('read')||!access.features.length)throw fail('沒有獲批准的程式或閱讀權限');}catch(e){if(url.pathname==='/api/state')return emptyState();throw e;}
  const require=(feature,op='read')=>policy.require(user,projectId,feature,op);const p=url.pathname;
  let feature='files',op=req.method==='POST'?'edit':'read',app;
  if(p==='/api/state'){feature=null;op='read';}
  else if(p==='/api/search'){feature='search';}
  else if(p.startsWith('/api/directory/')){feature='search';op=p==='/api/directory/ask'?'ai':p==='/api/directory/file'?'download':req.method==='POST'?'edit':'read';}
  else if(p.startsWith('/api/jobs')){feature='jobs';op=req.method==='POST'?'ai':'read';}
  else if(p==='/api/chat'){feature='chat';op='ai';app=body.app;require(app);}
  else if(p.startsWith('/api/models')||p==='/api/model/run'){feature='chat';op='ai';}
  else if(p.startsWith('/api/bim/')){feature='bim';op='read';}
  else if(p.startsWith('/api/canvas/')){feature='canvas';op=p==='/api/canvas/generate'?'ai':req.method==='POST'?'edit':'read';}
  else if(p==='/api/boards'){feature='board';}
  else if(p==='/api/project/new-grid'){feature='gridcraft';}
  else if(p==='/api/office/run'){throw fail('公司模式請使用可追蹤的文件任務隊列',410);}
  else if(p==='/api/office/tasks'){feature=body.tool;op='edit';}
  else if(p==='/api/office/import'){feature='pdfcraft';}
  else if(p==='/api/office/health'){feature='files';op='read';}
  else if(p==='/api/admin/audit'){if(user.role!=='admin')throw fail('只供管理員');}
  else if((p.startsWith('/api/project/files/')&&!p.endsWith('/lease')||p.startsWith('/api/office/files/')||/^\/api\/documents\/[^/]+\/docx$/.test(p))&&req.method==='GET'){op='download';}
  if(feature)require(feature,op);
  if(['chat','/api/models/list'].includes(feature)||p==='/api/models/list'||p==='/api/model/run'||p==='/api/canvas/generate'||p==='/api/directory/ask')gateway.require(user,projectId,body.provider,body.model);
  if(p==='/api/bim/devices'&&req.method==='GET')return send(res,200,{devices:revitRelay.devices()});
  if(p==='/api/bim/remote-probe'&&req.method==='POST'){if(Object.keys(body).some(k=>k!=='deviceId'))throw fail('只接受Connector ID，不能指定任意工具',400);return send(res,200,await revitRelay.probe(user,projectId,body.deviceId));}
  req.companyProfiles=gateway.forUser(user,projectId);req.company={projectId,feature:feature||'files',op,app};req.companyView={...access,projects,mode:policy.singleWorkspace?'single':'projects'};
  if(req.method==='POST'&&['/api/chat','/api/model/run','/api/office/tasks','/api/canvas/generate','/api/directory/index','/api/directory/ask'].includes(p)){
   const task=submissions.then(async()=>{
    const target=await appFor(projectId),prior=target.store.db.aiJobs.find(j=>j.userId===user.id&&j.requestId===body.requestId);let reserved=false;
    if(!prior){
     const all=(await Promise.all([...apps.values()])).flatMap(a=>a.store.db.aiJobs).filter(j=>['queued','running'].includes(j.status)),limits=policy.state.limits||{global:30,perUser:3};
     if(all.length>=limits.global||all.filter(j=>j.userId===user.id).length>=limits.perUser)throw fail('公司任務排隊已滿，請稍後再試',429);
     if(p==='/api/canvas/generate'){
      const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Hong_Kong'}).format(new Date());
      policy.update(user.id,'image-quota-reserve',d=>{const usage=d.imageUsage?.day===day?d.imageUsage:{day,count:0};if(!d.limits?.dailyImages||usage.count>=d.limits.dailyImages)throw fail('生圖配額未啟用或已達今日上限；請管理員核對預算',429);d.imageUsage={day,count:usage.count+1};});reserved=true;
     }
    }
    try{return await target.handler(req,res);}finally{if(reserved&&res.statusCode!==202)policy.update(user.id,'image-quota-release',d=>{d.imageUsage.count=Math.max(0,d.imageUsage.count-1);});}
   });submissions=task.catch(()=>{});return await task;
  }
  return await (await appFor(projectId)).handler(req,res);
 }catch(e){send(res,e.status||(e instanceof SyntaxError?400:500),{error:e.status?e.message:'公司平台處理失敗；請查看伺服器診斷'});}finally{activeRequests--;}};
 const server=security.tls?https.createServer(security.tls,handler):http.createServer(handler);server.requestTimeout=300000;server.headersTimeout=15000;
 return {server,auth,policy,gateway,revitRelay,apps,projectCookie,async close(){closing=true;revitRelay.close();while(activeRequests)await new Promise(r=>setTimeout(r,10));await Promise.all([...apps.values()].map(async p=>{const a=await p;await a.queue.close();await a.store.tail;a.store.sql?.close();}));policy.close();}};
}
