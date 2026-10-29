import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../server/index.mjs';
import {Store} from '../server/store.mjs';
import {search} from '../server/search.mjs';
import {invoke,skill} from '../server/models.mjs';
import {exportDocx} from '../server/documents.mjs';

const listen=s=>new Promise(resolve=>s.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+s.address().port)));
const close=s=>new Promise(resolve=>{s.closeAllConnections();s.close(resolve);});
test('shared source identity survives document + board save, search and disk reopen',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'company-poc-'));
 try{const s=await new Store(dir).init();const a=await s.addAsset({name:'需求.txt',text:'接待區保留入口，預算未提供。'});const hash=a.sha256;
 const d=await s.saveDocument({title:'公司匯報',body:'接待區需覆核',sourceIds:[a.id]});const b=await s.saveBoard({name:'方案白板',elements:[{id:'text-1',type:'text',text:'接待區流線標註'}],sourceIds:[a.id]});
 const hits=search(s.db,'接待區');assert.deepEqual(new Set(hits.map(x=>x.type)),new Set(['asset','document','board']));assert.ok(hits.every(h=>h.sources[0].assetId===a.id));
 const reopened=await new Store(dir).init();assert.equal(reopened.asset(a.id).sha256,hash);assert.equal(reopened.db.documents[0].sources[0].assetId,a.id);assert.equal(reopened.db.boards[0].elements[0].text,'接待區流線標註');
 await reopened.saveBoard({...b,elements:[{type:'text',text:'修訂後'}],sourceIds:[a.id]});assert.equal(reopened.db.boards[0].version,2);assert.equal(reopened.db.documents[0].id,d.id);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('invalid source references rejected; concurrent asset saves persist',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'company-poc-'));try{const s=await new Store(dir).init();await assert.rejects(s.saveDocument({title:'x',body:'x',sourceIds:['missing']}),/找不到/);await Promise.all(Array.from({length:10},(_,i)=>s.addAsset({name:String(i),text:'測試'})));assert.equal((await new Store(dir).init()).assets().length,10);}finally{await rm(dir,{recursive:true,force:true});}
});
test('deleted board elements are not indexed; Chinese multi-keyword query works',()=>{
 const db={assets:[],documents:[],boards:[{id:'b',name:'圖板',sources:[],elements:[{text:'舊資料',isDeleted:true},{text:'接待區 入口'}]}]};assert.equal(search(db,'舊資料').length,0);assert.equal(search(db,'接待區 入口').length,1);assert.equal(search(db,'不存在').length,0);
});
test('cloud/local protocol adapters use identical Skill; failures never fallback (SIMULATED servers)',async()=>{
 const requests=[];const mock=http.createServer(async(req,res)=>{let text='';for await(const c of req)text+=c;requests.push({url:req.url,body:JSON.parse(text),auth:req.headers.authorization});res.setHeader('Content-Type','application/json');if(req.url==='/v1/chat/completions')res.end(JSON.stringify({choices:[{message:{content:'模擬雲端摘要'}}]}));else if(req.url==='/api/chat')res.end(JSON.stringify({message:{content:'模擬地端摘要'}}));else{res.statusCode=503;res.end('{}');}});
 const base=await listen(mock);process.env.POC_TEST_ALLOW_HTTP='1';try{
 const cloud=await invoke({id:'cloud',protocol:'openai-compatible',baseUrl:base+'/v1',model:'mock-cloud',key:'fixture-only'},'接待區');const local=await invoke({id:'local',protocol:'ollama',baseUrl:base,model:'mock-local'},'接待區');
 assert.equal(cloud.output,'模擬雲端摘要');assert.equal(local.output,'模擬地端摘要');assert.deepEqual(requests[0].body.messages,requests[1].body.messages);assert.equal(cloud.skillVersion,skill.version);assert.equal(local.skillVersion,skill.version);assert.equal(requests[1].auth,undefined);
 const before=requests.length;await assert.rejects(invoke({id:'cloud',protocol:'openai-compatible',baseUrl:base+'/fail',model:'mock'},'x'),/503/);assert.equal(requests.length,before+1);
 await assert.rejects(invoke({id:'local',protocol:'ollama',baseUrl:'https://example.com',model:'x'},'x'),/loopback/);
 }finally{delete process.env.POC_TEST_ALLOW_HTTP;await close(mock);}
});
test('missing model config fails before request',async()=>{await assert.rejects(invoke({id:'cloud',baseUrl:'',model:''},'x'),/尚未配置/);});
test('HTTP API saves artifacts, rejects cross-origin writes, hides credentials, exports DOCX',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'company-poc-'));const {server}=await createApp({dataDir:dir,modelProfiles:{cloud:{id:'cloud',label:'test',protocol:'openai-compatible',model:'',baseUrl:'',key:'secret-fixture'}}});const base=await listen(server);
 try{const post=(p,b,headers={})=>fetch(base+p,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(b)});
 const a=await(await post('/api/assets',{name:'HTTP來源.txt',text:'文件共用資料'})).json();const d=await(await post('/api/documents',{title:'匯報',body:'可編輯文字及繁體中文',sourceIds:[a.id]})).json();
 assert.equal((await post('/api/assets',{name:'x',text:'x'},{Origin:'https://untrusted.example'})).status,403);
 const st=await(await fetch(base+'/api/state')).json();assert.ok(!JSON.stringify(st).includes('secret-fixture'));
 const doc=await fetch(`${base}/api/documents/${d.id}/docx`);assert.equal(doc.status,200);const bytes=Buffer.from(await doc.arrayBuffer());assert.equal(bytes.subarray(0,2).toString(),'PK');
 const failed=await post('/api/model/run',{provider:'cloud',sourceIds:[a.id]});assert.equal(failed.status,502);const after=await(await fetch(base+'/api/state')).json();assert.equal(after.runs[0].status,'failed');assert.equal(after.runs[0].sources[0].assetId,a.id);
 }finally{await close(server);await rm(dir,{recursive:true,force:true});}
});
test('generate persistent evidence DOCX from real document renderer',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'company-poc-'));try{const store=await new Store(dir).init();const a=await store.addAsset({name:'驗證來源.txt',text:'接待區保留入口。預算未提供。'});const d=await store.saveDocument({title:'共用資料驗證報告',body:'文件內容為可編輯文字。\n接待區保留入口。\n預算未提供，不自行補價。',sourceIds:[a.id]});const out=path.resolve('evidence');await mkdir(out,{recursive:true});await writeFile(path.join(out,'sample-report.docx'),await exportDocx(d,store));await writeFile(path.join(out,'shared-data.json'),JSON.stringify({asset:a,document:d},null,2));}finally{await rm(dir,{recursive:true,force:true});}
});
