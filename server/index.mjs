import {RevitConnector,revitConfig} from './revit-connector.mjs';
import {DirectorySearch} from './directory-search.mjs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {Store} from './store.mjs';
import {search} from './search.mjs';
import {profiles,invoke,skill,modelList,chatCompletion,routeSignature} from './models.mjs';
import {exportDocx} from './documents.mjs';
import {Office} from './office.mjs';
import {ProjectFiles} from './project-files.mjs';
import {PdfSearch} from './pdf-search.mjs';
import {Chat} from './chat.mjs';
import {Auth} from './auth.mjs';
import {Leases} from './leases.mjs';
import {AiQueue} from './ai-queue.mjs';
import {checkOrigin,networkConfig} from './network.mjs';
import {projectFileHeaders} from './file-response.mjs';
import {OfficeTasks} from './office-tasks.mjs';
import {acceptsGzip} from './static-encoding.mjs';
import {Canvas} from './canvas.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const APP_VERSION=JSON.parse(await readFile(path.join(root,'package.json'),'utf8')).version;
const modules=JSON.parse(await readFile(path.join(root,'contracts/modules.json'),'utf8'));
// The no-auth default is for loopback-only programmatic fixtures. The executable entry
// point below always passes auth:true and enforces HTTPS for a non-loopback bind.
export async function createApp({dataDir=path.join(root,'data'),modelProfiles,officeConfig,security={auth:false},queueOptions={},sharedAuth,beforeTask,sqlite=false}={}) {
  const store=await new Store(dataDir,{sqlite}).init();
  const office=await new Office(store,officeConfig?{config:officeConfig}:{}).init();
  const files=await new ProjectFiles(store,office).init(),pdfSearch=new PdfSearch(store,files),chat=new Chat(store,files);
  const officeTasks=new OfficeTasks(store,files,office);
  const canvas=await new Canvas(store,files).init(),revit=new RevitConnector(revitConfig());
  const directory=await new DirectorySearch(store).init();
  const leases=await new Leases(store,files,security.leaseOptions).init();files.leases=leases;
  const auth=sharedAuth||(security.auth?new Auth(dataDir,{secure:!!security.tls,...security.sessionOptions}):null);
  const audit=async(action,user,details={})=>store.mutate(db=>{db.audit??=[];db.audit.push({at:new Date().toISOString(),action,userId:user?.id,...details});db.audit=db.audit.slice(-2000);});
  const queue=await new AiQueue(store,async(input,job,signal)=>{
    if(beforeTask)await beforeTask(input,job,signal);
    if(auth){const user=await auth.user(job.userId);if(user.role==='viewer')throw Object.assign(new Error('此帳戶已無 AI 執行權限'),{status:403});}
    if(input.kind==='office'){
      const user=auth?await auth.user(job.userId):{id:'local',name:'本機測試',role:'admin'};
      const result=await officeTasks.execute(input,user,signal);
      if(input.tool==='pdfcraft'&&input.action==='inspect'){
        if(files.file(input.snapshots[0].id).version!==input.snapshots[0].version)throw Object.assign(new Error('來源已有新版本，請重新讀取'),{status:409});
        await pdfSearch.index(input.snapshots[0].id);
      }
      return result;
    }
    const active=typeof modelProfiles==='function'?modelProfiles():modelProfiles||profiles();
    if(input.kind==='directory-index')return directory.index(input,auth?await auth.user(job.userId):{id:'local',role:'admin'},signal);
    if(input.kind==='directory-ai')return directory.answer(input,active,auth?await auth.user(job.userId):{id:'local',role:'admin'},signal);
    if(input.kind==='image')return canvas.execute(input,active,auth?await auth.user(job.userId):{id:'local'},signal);
    if(input.kind==='chat')return chat.execute(input,active,signal);
    const chosen=Object.hasOwn(active,input.provider)?active[input.provider]:null;if(!chosen)throw new Error('模型設定不存在');
    if(input.routeSignature!==routeSignature(chosen))throw new Error('排隊期間模型路由設定已改，請核對後重新提交');
    return chatCompletion({...chosen,model:input.model},input.messages,{signal});
  },queueOptions).init();
  const handler=async(req,res)=>{
    const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
    try {
      res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','SAMEORIGIN');
      const url=new URL(req.url,'http://localhost');
      if(!checkOrigin(req,!!security.tls,security.allowedHosts||['localhost','127.0.0.1']))return send(403,{error:'Host 或來源不接受；拒絕跨來源寫入'});
      const loopback=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);if(!loopback&&(!auth||!security.tls))return send(403,{error:'跨機連線需要 HTTPS 及登入'});
      const publicApi=(url.pathname==='/api/auth/login'&&req.method==='POST')||(url.pathname==='/api/health'&&req.method==='GET');
      let identity=null;if(auth&&url.pathname.startsWith('/api/')&&!publicApi)identity=await auth.authenticate(req);
      if(req.method==='POST'&&!url.pathname.startsWith('/api/'))return send(405,{error:'不支援此操作'});
      let body=req.companyBody||{};if(req.method==='POST'&&!req.companyBody) {let raw='';const limit=url.pathname==='/api/auth/login'?8192:8_000_000;for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>limit)throw Object.assign(new Error('內容超過限制'),{status:413});}body=JSON.parse(raw||'{}');}
      const prepared=fn=>async()=>({...await fn(),...(req.company?{company:req.company}: {})});
      if(url.pathname==='/api/health'&&req.method==='GET')return send(200,{ok:true,version:APP_VERSION});
      if(req.method==='POST'&&url.pathname==='/api/auth/login'){
        if(!auth)return send(400,{error:'只供本機測試的接口未啟用登入'});
        try{const r=await auth.login(body.username,body.password,req.socket.remoteAddress);res.setHeader('Set-Cookie',r.cookie);await audit('login',r.user);return send(200,{user:r.user,csrf:r.session.csrf});}catch(e){if(e.status!==429)await audit('login-failed',null);throw e;}
      }
      const user=identity?.user||{id:'local',name:'本機測試',role:'admin'},actor=identity?{...user,sessionId:identity.session.id}:null;
      if(url.pathname==='/api/auth/me')return send(200,{user,csrf:identity?.session.csrf||null});
      if(auth&&req.method==='POST'){auth.csrf(req,identity.session);if(user.role==='viewer'&&url.pathname!=='/api/auth/logout')return send(403,{error:'此帳戶只可閱讀及下載'});}
      if(req.method==='POST'&&url.pathname==='/api/auth/logout'){if(auth){await leases.releaseSession(identity.session.id);res.setHeader('Set-Cookie',auth.logout(identity.key));await audit('logout',user);}return send(200,{ok:true});}
      const activeProfiles=req.companyProfiles||(typeof modelProfiles==='function'?modelProfiles():modelProfiles||profiles());
      if(url.pathname==='/api/canvas/boards'&&req.method==='POST')return send(201,await canvas.save(body,user));
      const canvasBoard=url.pathname.match(/^\/api\/canvas\/boards\/([\w-]+)$/);
      if(canvasBoard&&req.method==='GET')return send(200,canvas.board(canvasBoard[1],url.searchParams.has('version')?Number(url.searchParams.get('version')):undefined));
      if(url.pathname==='/api/canvas/generate'&&req.method==='POST'){const job=await queue.submit(user,body.requestId,prepared(()=>canvas.prepare(body,activeProfiles)));return send(202,job);}
      if(url.pathname==='/api/admin/audit'&&req.method==='GET')return user.role==='admin'?send(200,store.db.audit||[]):send(403,{error:'只供管理員'});
      const visibleJob=j=>{if(j.sourceId){if(req.companyView&&!req.companyView.features.includes('search'))return false;try{if(directory.source(j.sourceId,user).revision!==j.sourceRevision)return false;}catch{return false;}}return true;};
      if(url.pathname==='/api/jobs'&&req.method==='GET')return send(200,queue.list(user).filter(visibleJob));
      const queueJob=url.pathname.match(/^\/api\/jobs\/([\w-]+)(\/cancel)?$/);
      if(queueJob){if(req.method==='GET'&&!queueJob[2]){const j=queue.find(queueJob[1],user);if(!visibleJob(j))return send(404,{error:'找不到已批准的任務'});return send(200,queue.view(j,user));}if(req.method==='POST'&&queueJob[2]){const j=await queue.cancel(queueJob[1],user);await audit('ai-cancel',user,{jobId:j.id});return send(200,j);}}
      if(req.method==='POST'&&url.pathname==='/api/chat'){
        if(!auth)return send(200,await chat.send(body,activeProfiles));
        const job=await queue.submit(user,body.requestId,prepared(()=>chat.prepare(body,activeProfiles,user.id)));await audit('ai-submit',user,{jobId:job.id});return send(202,job);
      }
      if(req.method==='POST'&&url.pathname==='/api/models/list'){
        const p=Object.hasOwn(activeProfiles,body.provider)?activeProfiles[body.provider]:null;if(!p)return send(400,{error:'服務不存在'});return send(200,{models:await modelList(p)});
      }
      const leaseRoute=url.pathname.match(/^\/api\/project\/files\/([\w-]+)\/lease$/);
      if(leaseRoute&&req.method==='POST')return send(200,await leases.change(leaseRoute[1],body,actor||{id:'local',name:'local',sessionId:'local'}));
      if(req.method==='POST'&&url.pathname==='/api/project/files'){const f=await files.save(body,actor);if(auth)await audit('file-save',user,{fileId:f.id,version:f.version});return send(201,f);}
      if(req.method==='POST'&&url.pathname==='/api/project/promote')return send(201,await files.promote(body.officeFileId));
      if(req.method==='POST'&&url.pathname==='/api/project/index')return send(200,body.kind==='pdf'?await pdfSearch.index(body.id):await files.indexWorkbook(body.id));
      if(req.method==='POST'&&url.pathname==='/api/project/new-grid'){
        const r=await office.run({tool:'gridcraft',action:'create',title:'新工作簿',tsv:'項目\t數量\t單價\t金額'});return send(201,await files.promote(r.files.find(f=>f.name.endsWith('.xlsx')).id));
      }
      const projectFile=url.pathname.match(/^\/api\/project\/files\/([\w-]+)$/);
      if(projectFile&&req.method==='GET'){
        const f=files.file(projectFile[1]),version=url.searchParams.has('version')?Number(url.searchParams.get('version')):undefined,b=await files.bytes(f.id,version),metadata=files.version(f.id,version);
        res.writeHead(200,projectFileHeaders(f,metadata,{download:url.searchParams.get('download')==='1'}));return res.end(b);
      }
      if(url.pathname==='/api/bim/status'&&req.method==='GET')return send(200,revit.status());
      if(url.pathname==='/api/bim/probe'&&req.method==='POST'){if(Object.keys(body).length)throw Object.assign(Error('只接受固定唯讀連線測試，不能傳送任意工具或參數'),{status:400});const result=await revit.probe();await audit('bim-readonly-probe',user,{status:result.status});return send(200,result);}
      if(url.pathname.startsWith('/api/bim/'))return send(405,{error:'本版只開放固定唯讀連線測試'});
      if(url.pathname==='/api/directory/sources'&&req.method==='GET')return send(200,{sources:directory.list(user)});
      if(url.pathname==='/api/directory/diagnostics'&&req.method==='GET'){if(user.role!=='admin')return send(403,{error:'只供 Admin'});const s=directory.source(url.searchParams.get('sourceId'),user),index=store.db.directoryIndex[s.id];return send(200,{summary:index?.summary||null,errors:index?.errors?.slice(0,100)||[],scope:'最多列100個檔案錯誤；已索引文字不在此回傳'});}
      if(url.pathname==='/api/directory/sources'&&req.method==='POST'){const saved=await directory.save(body,user);await audit('directory-source-save',user,{sourceId:saved.id});return send(200,saved);}
      if(url.pathname==='/api/directory/browse'&&req.method==='GET')return send(200,await directory.browse(Object.fromEntries(url.searchParams),user));
      if(url.pathname==='/api/directory/search'&&req.method==='GET')return send(200,await directory.search(Object.fromEntries(url.searchParams),user));
      const directoryTask=url.pathname.match(/^\/api\/directory\/tasks\/([\w-]+)$/);
      if(directoryTask&&req.method==='GET'){const j=queue.find(directoryTask[1],user);if(!j.sourceId||!visibleJob(j))return send(404,{error:'找不到已批准的任務'});return send(200,queue.view(j,user));}
      if(url.pathname==='/api/directory/file'&&req.method==='GET'){const f=await directory.file(Object.fromEntries(url.searchParams),user),mime={'.pdf':'application/pdf','.txt':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg'}[f.ext]||'application/octet-stream';res.writeHead(200,{'Content-Type':mime,'Content-Disposition':`${url.searchParams.get('download')==='1'||mime==='application/octet-stream'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(f.name)}`,'Cache-Control':'no-store','Content-Security-Policy':"sandbox; default-src 'none'"});return res.end(f.bytes);}
      if(url.pathname==='/api/directory/index'&&req.method==='POST')return send(202,await queue.submit(user,body.requestId,prepared(()=>directory.prepareIndex(body,user))));
      if(url.pathname==='/api/directory/ask'&&req.method==='POST')return send(202,await queue.submit(user,body.requestId,prepared(()=>directory.prepareAi(body,activeProfiles,user))));
      if(url.pathname==='/api/state'){
        const {aiInputs,aiJobs,editLeases,audit:privateAudit,canvasBoards,directorySources,directoryIndex,...shared}=store.db;
        shared.canvasBoards=(canvasBoards||[]).map(({versions,...b})=>({...b,versions:versions.map(({snapshot,...v})=>v)}));
        return send(200,{...shared,workspace:req.companyView,chats:auth?shared.chats.filter(s=>s.userId===user.id):shared.chats,runs:auth?shared.runs.filter(r=>r.userId===user.id):shared.runs,leases:leases.visible(),queue:queue.list(user).filter(visibleJob),user,authenticated:!!auth,modules,profiles:Object.values(activeProfiles).map(p=>({id:p.id,label:p.label,protocol:p.protocol,location:p.location||p.id,inference:p.inference||'unknown',enabled:p.enabled!==false,model:p.model,models:p.models||[],capabilities:p.capabilities||['chat'],configured:!!(p.baseUrl&&p.model)})),skill});
      }
      if(url.pathname==='/api/search')return send(200,search(store.db,url.searchParams.get('q')));
      if(req.method==='POST'&&url.pathname==='/api/assets')return send(201,await store.addAsset(body));
      if(req.method==='POST'&&url.pathname==='/api/documents')return send(201,await store.saveDocument(body));
      if(req.method==='POST'&&url.pathname==='/api/boards')return send(200,await store.saveBoard(body,actor));
      if(req.method==='POST'&&url.pathname==='/api/office/health')return send(200,await office.health());
      if(req.method==='POST'&&url.pathname==='/api/office/import')return send(201,await office.importPdf(body));
      if(req.method==='POST'&&url.pathname==='/api/office/run')return send(200,await office.run(body));
      if(req.method==='POST'&&url.pathname==='/api/office/tasks'){
        const job=await queue.submit(user,body.requestId,prepared(()=>officeTasks.prepare(body)));await audit('office-submit',user,{jobId:job.id});return send(202,job);
      }
      const officeFile=url.pathname.match(/^\/api\/office\/files\/([\w-]+)$/);
      if(officeFile&&req.method==='GET'){
        const f=office.file(officeFile[1]),bytes=await readFile(await office.filePath(f));
        const mime={'.pdf':'application/pdf','.png':'image/png','.json':'application/json; charset=utf-8','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation'}[path.extname(f.name)]||'application/octet-stream';
        res.writeHead(200,{'Content-Type':mime,'Content-Disposition':`attachment; filename="${f.id}${path.extname(f.name)}"`,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});return res.end(bytes);
      }
      const officeSource=url.pathname.match(/^\/api\/office\/files\/([\w-]+)\/source$/);
      if(officeSource&&req.method==='POST'){
        const f=office.file(officeSource[1]);if(!f.text) return send(400,{error:'此檔案尚未抽取文字'});
        const a=await store.addAsset({name:f.name+' 文字',text:f.text});await store.mutate(()=>{a.originOfficeFileId=f.id;a.sources=f.sources;});return send(201,a);
      }
      if(req.method==='POST'&&url.pathname==='/api/model/run') {
        const chosen=Object.hasOwn(activeProfiles,body.provider)?activeProfiles[body.provider]:null;if(!chosen)throw Object.assign(new Error('模型設定不存在'),{status:400});
        if(body.model!==undefined&&(typeof body.model!=='string'||!body.model.trim()||body.model.length>200))throw Object.assign(new Error('模型名稱不正確'),{status:400});
        const p={...chosen,model:body.model?.trim()||chosen.model};
        if(!Array.isArray(body.sourceIds)||!body.sourceIds.length)throw Object.assign(new Error('請先選取來源'),{status:400});
        const selected=body.sourceIds.map(id=>store.asset(id));
        if(auth){const job=await queue.submit(user,body.requestId,prepared(async()=>({kind:'summary',provider:p.id,model:p.model,routeSignature:routeSignature(p),messages:[{role:'system',content:skill.system},{role:'user',content:selected.map(a=>`${a.name}\n${a.text}`).join('\n\n').slice(0,60000)}]})));await audit('ai-submit',user,{jobId:job.id});return send(202,job);}
        const run={id:randomUUID(),provider:p.id,model:p.model,skillId:skill.id,skillVersion:skill.version,sources:selected.map(a=>({assetId:a.id,version:a.version})),status:'running',createdAt:new Date().toISOString()};
        await store.mutate(db=>db.runs.push(run));
        try{const result=await invoke(p,selected.map(a=>`${a.name}\n${a.text}`).join('\n\n'));await store.mutate(()=>Object.assign(run,result,{status:'succeeded'}));return send(200,run);}
        catch(e){await store.mutate(()=>Object.assign(run,{status:'failed',error:e.message}));return send(502,{error:e.message,runId:run.id});}
      }
      const match=url.pathname.match(/^\/api\/documents\/([\w-]+)\/docx$/);
      if(match){const d=store.db.documents.find(d=>d.id===match[1]);if(!d)return send(404,{error:'找不到文件'});const b=await exportDocx(d,store);res.writeHead(200,{'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename="document-${d.id}.docx"`});return res.end(b);}
      if(url.pathname.startsWith('/api/'))return send(404,{error:'找不到接口'});
      if(req.method!=='GET')return send(405,{error:'不支援此操作'});
      if(url.pathname.startsWith('/canvas-web/')){const origin=`${security.tls?'https':'http'}://${req.headers.host}`;res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Content-Security-Policy',`default-src 'none'; script-src ${origin}; style-src ${origin} 'unsafe-inline'; img-src data: blob:; font-src ${origin} data:; connect-src data: blob:; media-src 'none'; worker-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-src 'none'; frame-ancestors 'self'; sandbox allow-scripts allow-downloads`);}
      const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));const file=path.resolve(root,'dist',rel);if(!file.startsWith(path.join(root,'dist')+path.sep))return send(403,{error:'路徑不允許'});
      let bytes,compressed=false;if(acceptsGzip(req.headers['accept-encoding'])&&/\.(wasm|js)$/.test(file)){try{bytes=await readFile(file+'.gz');compressed=true;}catch(e){if(e.code!=='ENOENT')throw e;}}
      bytes??=await readFile(file);const ext=path.extname(file);res.writeHead(200,{'Content-Type':({'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.wasm':'application/wasm','.ico':'image/x-icon','.woff2':'font/woff2','.svg':'image/svg+xml'})[ext]||'application/octet-stream','Cache-Control':/-[a-f0-9]{8,}(?:_bg)?\.(wasm|js)$/.test(file)?'public, max-age=31536000, immutable':'no-cache',...(compressed?{'Content-Encoding':'gzip','Vary':'Accept-Encoding'}:{}),'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(bytes);
    }catch(e){send(e.status||(e instanceof SyntaxError?400:e.code==='ENOENT'?404:500),{error:e.message});}
  };const server=security.tls?https.createServer(security.tls,handler):http.createServer(handler);
  server.requestTimeout=300000;server.headersTimeout=15000;
  return {server,handler,store,office,files,pdfSearch,chat,auth,leases,queue,directory};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const security=await networkConfig(root);
  const dataDir=path.resolve(root,process.env.POC_DATA_DIR||'data');
  const {lockDataDirectory}=await import('./server-lock.mjs');const release=await lockDataDirectory(dataDir);
  let app;try{const {createCompanyApp}=await import('./company.mjs');app=await createCompanyApp({dataDir,security,appFactory:createApp});}catch(e){await release();throw e;}const {server}=app;
  server.on('error',async e=>{await release();console.error(e.message);process.exitCode=1;});
  let stopping=false;const stop=async()=>{if(stopping)return;stopping=true;server.close();await app.close();server.closeAllConnections();await release();process.exit(0);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
  server.listen(security.port,security.host,()=>console.log(`AS Workspace ${APP_VERSION}: ${security.tls?'https':'http'}://${security.host}:${security.port} (company mode)`));
}

