import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {profiles,invoke} from '../server/models.mjs';
import {createApp} from '../server/index.mjs';
test('disabled profiles and missing authentication fail before network access',async()=>{
 await assert.rejects(invoke({enabled:false},'fixture'),/尚未啟用/);
 await assert.rejects(invoke({apiKeyEnv:'POC_HERMES_API_KEY',key:''},'fixture'),/尚未設定認證/);
});
test('config profiles reload, optional model names and environment-only keys',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'profiles-'));const file=path.join(dir,'models.json');
 try { const config={profiles:[{id:'hermes',location:'local',protocol:'openai-compatible',baseUrl:'http://127.0.0.1:8642/v1',models:['alpha','beta'],apiKeyEnv:'TEST_KEY'}]};
 await writeFile(file,JSON.stringify(config));let p=profiles({POC_PROFILES_FILE:file,TEST_KEY:'fixture'});assert.equal(p.hermes.key,'fixture');assert.equal(p.hermes.model,'alpha');
 config.profiles[0].models=['gamma'];await writeFile(file,JSON.stringify(config));assert.equal(profiles({POC_PROFILES_FILE:file}).hermes.model,'gamma');
 config.profiles.push({...config.profiles[0]});await writeFile(file,JSON.stringify(config));assert.throws(()=>profiles({POC_PROFILES_FILE:file}),/重複/);
 } finally{await rm(dir,{recursive:true,force:true});}
});
test('local compatible protocol + authentication + runtime model override through HTTP (mock)',async()=>{
 let received;const mock=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;received={body:JSON.parse(body),key:req.headers.authorization,path:req.url};res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'synthetic response'}}]}));});
 await new Promise(r=>mock.listen(0,'127.0.0.1',r));const dir=await mkdtemp(path.join(os.tmpdir(),'model-choice-'));
 const p={id:'hermes',location:'local',protocol:'openai-compatible',baseUrl:`http://127.0.0.1:${mock.address().port}/v1`,model:'default-model',key:'fixture',timeoutMs:2000};
 const {server,store}=await createApp({dataDir:dir,modelProfiles:{hermes:p}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 try {const a=await store.addAsset({name:'source',text:'fixture'});const base=`http://127.0.0.1:${server.address().port}`;
 const response=await fetch(base+'/api/model/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'hermes',model:'other-model',sourceIds:[a.id]})});assert.equal(response.status,200);assert.equal((await response.json()).model,'other-model');assert.equal(received.body.model,'other-model');assert.equal(received.key,'Bearer fixture');assert.equal(received.path,'/v1/chat/completions');assert.equal(received.body.stream,false);
 assert.equal(p.model,'default-model');const state=await(await fetch(base+'/api/state')).json();assert.ok(!JSON.stringify(state.profiles).includes('fixture'));
 await assert.rejects(invoke({...p,baseUrl:'http://192.168.1.5/v1'},'x'),/loopback/);
 await assert.rejects(invoke({...p,timeoutMs:Infinity},'x'),/逾時/);
 }finally{await new Promise(r=>{server.closeAllConnections();server.close(r)});await new Promise(r=>{mock.closeAllConnections();mock.close(r)});await rm(dir,{recursive:true,force:true});}
});
