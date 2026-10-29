import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createApp} from '../server/index.mjs';
import {Store} from '../server/store.mjs';
import {ProjectFiles} from '../server/project-files.mjs';
import {pdfChunks} from '../server/pdf-search.mjs';
import {gridMessage} from '../src/grid-bridge.mjs';
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(`http://127.0.0.1:${s.address().port}`)));
const close=s=>new Promise(r=>{s.closeAllConnections();s.close(r);});
test('project files: immutable versions, concurrent conflicts, original hashes survive reopen',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'workspace-files-'));try{
  const s=await new Store(dir).init(),files=await new ProjectFiles(s,{}).init();const f=await files.save({name:'規格.txt',base64:Buffer.from('原文').toString('base64')});
  const update={id:f.id,name:f.name,base64:Buffer.from('更新內容').toString('base64'),expectedVersion:1};
  const results=await Promise.allSettled([files.save(update),files.save(update)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.status,409);
  assert.equal((await files.bytes(f.id,1)).toString(),'原文');assert.equal((await files.bytes(f.id,2)).toString(),'更新內容');
  const reopened=await new ProjectFiles(await new Store(dir).init(),{}).init();assert.equal(reopened.file(f.id).versions.length,2);assert.equal((await reopened.bytes(f.id,1)).toString(),'原文');
  await assert.rejects(files.save({name:'../bad.txt',base64:'YQ=='}),/不正確/);await assert.rejects(files.save({name:'bad.xlsx',base64:'YQ=='}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Grid bridge only accepts exact parent origin/frame; output must be binary',()=>{
 const source={},event={source,origin:'http://localhost:4317',data:{type:'gridcraft:save',name:'x.xlsx',bytes:new Uint8Array([1,2])}};
 assert.ok(gridMessage(event,source,event.origin));assert.equal(gridMessage(event,{},event.origin),null);assert.equal(gridMessage({...event,origin:'https://evil.example'},source,event.origin),null);assert.equal(gridMessage({...event,data:{...event.data,bytes:'text'}},source,event.origin),null);
});
test('PDF structured chunks preserve inherited page and bbox, not metadata text',()=>{
 const chunks=pdfChunks({'number of pages':2,kids:[{'page number':2,kids:[{id:9,type:'paragraph',content:'條款 XYZ-123','bounding box':[10,20,30,40]}]}]});assert.equal(chunks.length,1);assert.equal(chunks[0].page,2);assert.deepEqual(chunks[0].bbox,[10,20,30,40]);
});
test('chat routes: two protocols, model switch, history isolation, dirty/version refusal, failures persist (SIMULATED models)',async()=>{
 const requests=[];const mock=http.createServer(async(req,res)=>{res.setHeader('Content-Type','application/json');if(req.method==='GET'){res.end(JSON.stringify(req.url==='/api/tags'?{models:[{name:'local-model'}]}:{data:[{id:'compatible-model'}]}));return;}let raw='';for await(const c of req)raw+=c;const body=JSON.parse(raw);requests.push({path:req.url,body});if(body.model==='failure'){res.writeHead(503);res.end('{}');return;}res.end(JSON.stringify(req.url==='/api/chat'?{message:{content:'模擬回應 [1]'}}:{choices:[{message:{content:'模擬回應 [1]'}}]}));});
 const mockBase=await listen(mock),dir=await mkdtemp(path.join(os.tmpdir(),'workspace-chat-'));
 const modelProfiles={ollama:{id:'ollama',protocol:'ollama',location:'local',inference:'local',baseUrl:mockBase,model:'local-model'},compatible:{id:'compatible',protocol:'openai-compatible',location:'local',inference:'unknown',baseUrl:mockBase+'/v1',model:'compatible-model'}};
 const {server,files,store}=await createApp({dataDir:dir,modelProfiles});const base=await listen(server);
 const post=async(route,body)=>{const r=await fetch(base+'/api/'+route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:r.status,data:await r.json()};};
 try{
  const f=await files.save({name:'規格.txt',base64:Buffer.from('金額未提供；參考 CODE-42').toString('base64')}),input={app:'gridcraft',fileId:f.id,expectedVersion:1,prompt:'列出資料缺口',provider:'ollama'};
  assert.equal((await post('chat',input)).status,200);assert.equal(requests[0].path,'/api/chat');assert.match(requests[0].body.messages.at(-1).content,/金額未提供/);
  assert.equal((await post('chat',{...input,provider:'compatible',model:'custom-model',prompt:'再解釋一次'})).status,200);assert.equal(requests[1].body.model,'custom-model');assert.equal(requests[1].path,'/v1/chat/completions');assert.ok(requests[1].body.messages.length>2);
  assert.equal((await post('chat',{app:'wordcraft',prompt:'新會話',provider:'ollama'})).status,200);assert.equal(requests[2].body.messages.length,2);assert.ok(!requests[2].body.messages.at(-1).content.includes('CODE-42'));
  const count=requests.length;assert.equal((await post('chat',{...input,dirty:true})).status,409);assert.equal((await post('chat',{...input,expectedVersion:0})).status,409);assert.equal(requests.length,count);
  assert.equal((await post('chat',{...input,model:'failure'})).status,500);assert.equal(requests.length,count+1);assert.equal(store.db.chats.find(c=>c.fileId===f.id).messages.at(-1).status,'failed');
  assert.deepEqual((await post('models/list',{provider:'ollama'})).data.models,['local-model']);assert.deepEqual((await post('models/list',{provider:'compatible'})).data.models,['compatible-model']);
 }finally{await close(server);await close(mock);await rm(dir,{recursive:true,force:true});}
});
