import {test,before,after} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,link} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import http from 'node:http';
import {Store} from '../server/store.mjs';import {DirectorySearch} from '../server/directory-search.mjs';import {createApp} from '../server/index.mjs';
let dir,root,store,d,source;const admin={id:'admin',username:'admin',role:'admin'},member={id:'member',username:'member',role:'member'},viewer={id:'viewer',username:'viewer',role:'viewer'},other={id:'other',username:'other',role:'member'};
before(async()=>{dir=await mkdtemp(path.join(os.tmpdir(),'as-folder-'));root=path.join(dir,'docs');await mkdir(path.join(root,'sub'),{recursive:true});await writeFile(path.join(root,'alpha.txt'),'香港 drainage alpha 2000');await writeFile(path.join(root,'sub','drawing.pdf'),'synthetic PDF');await writeFile(path.join(root,'legacy.xls'),'not parsed');await writeFile(path.join(root,'.env'),'SECRET');store=await new Store(path.join(dir,'data')).init();d=await new DirectorySearch(store,{extract:async(b,ext)=>ext==='.pdf'?{chunks:[{page:2,bbox:[0,0,10,10],text:'PDF drainage 香港'}],status:'ready'}:ext==='.txt'?{chunks:[{text:b.toString()}],status:'ready'}:{chunks:[],status:'filename-only'}}).init();source=await d.save({label:'TEST',root,users:['member','viewer']},admin);});
after(async()=>{assert.ok(dir.startsWith(path.join(os.tmpdir(),'as-folder-')));await rm(dir,{recursive:true,force:true,maxRetries:5});});
test('only admin registers roots; source ACL applies to listing/browse/search/download',async()=>{
 await assert.rejects(d.save({label:'x'},member),e=>e.status===403);assert.equal(d.list(other).length,0);await assert.rejects(d.browse({sourceId:source.id},other),e=>e.status===404);await assert.rejects(d.search({sourceId:source.id,q:'x'},other),e=>e.status===404);await assert.rejects(d.file({sourceId:source.id,relative:'alpha.txt'},other),e=>e.status===404);assert.equal(d.list(member)[0].location,undefined);
});
test('approved browser navigates children, filters types and rejects traversal/secret files/links',async()=>{
 const all=await d.browse({sourceId:source.id},member);assert.ok(all.entries.some(e=>e.directory&&e.name==='sub'));assert.ok(!all.entries.some(e=>e.name==='.env'));const f=await d.browse({sourceId:source.id,relative:'sub',ext:'.pdf'},viewer);assert.equal(f.entries.length,1);
 for(const relative of ['../outside','.env','sub/../../outside','C:/Windows','sub\\drawing.pdf'])await assert.rejects(d.file({sourceId:source.id,relative},member));
 await mkdir(path.join(dir,'outside'));await writeFile(path.join(dir,'outside','private.txt'),'PRIVATE');await symlink(path.join(dir,'outside'),path.join(root,'shortcut'),process.platform==='win32'?'junction':'dir');await link(path.join(root,'alpha.txt'),path.join(root,'hard.txt'));await assert.rejects(d.file({sourceId:source.id,relative:'shortcut/private.txt'},member));await assert.rejects(d.file({sourceId:source.id,relative:'hard.txt'},member));await rm(path.join(root,'hard.txt'));assert.ok(!(await d.browse({sourceId:source.id},admin)).entries.some(e=>e.name==='shortcut'));
});
test('incremental content/PDF page search and filename-only legacy formats preserve source bytes',async()=>{
 const original=await readFile(path.join(root,'alpha.txt'));const a=await d.index(d.prepareIndex({sourceId:source.id},admin),admin);assert.equal(a.files,3);assert.equal(a.errors,0);
 const hit=await d.search({sourceId:source.id,q:'香港',ext:'.pdf',relative:'sub',mode:'content'},member);assert.equal(hit.hits.length,1);assert.equal(hit.hits[0].page,2);assert.deepEqual(hit.hits[0].bbox,[0,0,10,10]);assert.equal((await d.search({sourceId:source.id,q:'legacy',ext:'.xls',mode:'name'},viewer)).hits.length,1);assert.equal((await d.search({sourceId:source.id,q:'not parsed',ext:'.xls',mode:'content'},viewer)).hits.length,0);
 const b=await d.index(d.prepareIndex({sourceId:source.id},admin),admin);assert.equal(b.reused,3);assert.deepEqual(await readFile(path.join(root,'alpha.txt')),original);
 await writeFile(path.join(root,'alpha.txt'),'UPDATED');assert.equal((await d.search({sourceId:source.id,q:'alpha',mode:'content'},member)).hits.length,0);await rm(path.join(root,'legacy.xls'));const c=await d.index(d.prepareIndex({sourceId:source.id},admin),admin);assert.equal(c.files,2);assert.equal(c.reused,1);assert.equal((await d.search({sourceId:source.id,q:'UPDATED',mode:'content'},member)).hits.length,1);
});
test('root changes, cloud policy and revocation fail closed',async()=>{
 await assert.rejects(d.save({label:'bad',root:store.root,users:[]},admin),/平台/);assert.throws(()=>d.prepareIndex({sourceId:source.id},member),e=>e.status===403);
 const cloud={cloud:{id:'cloud',protocol:'openai-compatible',location:'cloud',inference:'cloud',model:'synthetic',baseUrl:'https://example.invalid/v1'}};assert.throws(()=>d.prepareAi({sourceId:source.id,q:'find',provider:'cloud'},cloud,member),e=>e.status===403);
 const prepared=d.prepareIndex({sourceId:source.id},admin);await d.save({id:source.id,revision:d.source(source.id,admin).revision,label:'TEST',root,users:['viewer']},admin);await assert.rejects(d.index(prepared,admin),e=>e.status===409);await assert.rejects(d.search({sourceId:source.id,q:'PDF'},member),e=>e.status===404);await d.save({id:source.id,revision:d.source(source.id,admin).revision,label:'TEST',root,users:['member','viewer']},admin);
});
test('failed extraction is retried instead of cached as a successful reuse',async()=>{
 const scratch=await mkdtemp(path.join(os.tmpdir(),'as-folder-retry-')),docs=path.join(scratch,'docs');await mkdir(docs);await writeFile(path.join(docs,'retry.pdf'),'synthetic');
 const localStore=await new Store(path.join(scratch,'data')).init();let calls=0;const local=await new DirectorySearch(localStore,{extract:async()=>{calls++;if(calls===1)throw Error('synthetic extractor failure');return {chunks:[{page:1,text:'retry succeeded'}],status:'ready'};}}).init();
 try{const saved=await local.save({label:'retry',root:docs,users:[]},admin),input=local.prepareIndex({sourceId:saved.id},admin),first=await local.index(input,admin),second=await local.index(input,admin),third=await local.index(input,admin);assert.equal(first.errors,1);assert.equal(second.errors,0);assert.equal(second.reused,0);assert.equal(third.reused,1);assert.equal(calls,2);}finally{await rm(scratch,{recursive:true,force:true,maxRetries:5});}
});
test('AI search switches protocols, cites live hits and never transmits to unapproved cloud',async()=>{
 const received=[];const model=http.createServer(async(req,res)=>{let raw='';for await(const b of req)raw+=b;const body=JSON.parse(raw);received.push({url:req.url,body});const messages=body.messages,output=messages[0].content.startsWith('把使用者')?'["drainage"]':JSON.stringify({status:'answered',answer:'有排水內容 [1]',evidence:[{source:1,quote:'PDF drainage 香港'}]});res.setHeader('Content-Type','application/json');res.end(JSON.stringify(req.url==='/api/chat'?{message:{content:output}}:{choices:[{message:{content:output}}]}));});await new Promise(r=>model.listen(0,'127.0.0.1',r));const baseUrl='http://127.0.0.1:'+model.address().port;
 try{for(const protocol of ['ollama','openai-compatible']){const profiles={local:{id:'local',protocol,location:'local',inference:'local',baseUrl,model:'synthetic'}};const input=d.prepareAi({sourceId:source.id,q:'幫我搵排水文件',provider:'local',model:'chosen-model'},profiles,member),result=await d.answer(input,profiles,member);assert.equal(result.citations[0].page,2);assert.match(result.output,/\[1\]/);assert.equal(received.at(-1).body.model,'chosen-model');assert.ok(!JSON.stringify(received).includes('PRIVATE'));}
 const prior=process.env.POC_TEST_ALLOW_HTTP;process.env.POC_TEST_ALLOW_HTTP='1';try{await d.save({id:source.id,revision:d.source(source.id,admin).revision,label:'TEST',root,users:['member','viewer'],cloudAllowed:true},admin);const cloud={approved:{id:'approved',protocol:'openai-compatible',location:'cloud',inference:'cloud',baseUrl,model:'synthetic-cloud'}};const input=d.prepareAi({sourceId:source.id,q:'排水',provider:'approved'},cloud,member);assert.equal((await d.answer(input,cloud,member)).provider,'approved');}finally{if(prior===undefined)delete process.env.POC_TEST_ALLOW_HTTP;else process.env.POC_TEST_ALLOW_HTTP=prior;}
 }finally{model.closeAllConnections();await new Promise(r=>model.close(r));}
});
test('API does not leak index/source data through state; invalid direct paths are rejected',async()=>{
 const app=await createApp({dataDir:path.join(dir,'api-data')});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+app.server.address().port;
 try{const r=await fetch(base+'/api/directory/sources',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({root,label:'API',users:[]})});assert.equal(r.status,200);const saved=await r.json();const state=await (await fetch(base+'/api/state')).json();assert.equal(state.directorySources,undefined);assert.equal(state.directoryIndex,undefined);const invalid=await fetch(base+'/api/directory/file?'+new URLSearchParams({sourceId:saved.id,relative:'../outside/private.txt'}));assert.equal(invalid.status,400);
 }finally{await app.queue.close();app.server.closeAllConnections();await new Promise(r=>app.server.close(r));}
});


test('missing literal IDs cannot be replaced by model-expanded generic hits',async()=>{
 const profiles={local:{id:'local',protocol:'ollama',location:'local',inference:'local',baseUrl:'http://127.0.0.1:1',model:'not-called'}};
 for(const q of ['UNMATCHABLEZZZ2026 是什麼','尋找「根本不存在的字串」']){const input=d.prepareAi({sourceId:source.id,q,provider:'local'},profiles,member);const result=await d.answer(input,profiles,member);assert.equal(result.outcome,'no-match');assert.deepEqual(result.citations,[]);}
});

test('canonical data aliases cannot be registered as document sources',async()=>{
 const alias=path.join(dir,'data-alias');await symlink(store.root,alias,process.platform==='win32'?'junction':'dir');await mkdir(path.join(store.root,'private-docs'));
 const aliased=await new DirectorySearch(await new Store(alias).init()).init();await assert.rejects(aliased.save({label:'blocked',root:path.join(store.root,'private-docs'),users:[]},admin),/平台/);
});


test('previously persisted unsafe roots are blocked at read time too',async()=>{
 const unsafe='legacy-unsafe';const root=await import('node:fs/promises').then(fs=>fs.realpath(path.join(store.root,'private-docs')));
 await store.mutate(db=>db.directorySources.push({id:unsafe,root,label:'old unsafe',users:['member'],revision:1}));
 await assert.rejects(d.browse({sourceId:unsafe},member),/平台/);await assert.rejects(d.search({sourceId:unsafe,q:'private'},member),/平台/);
});
