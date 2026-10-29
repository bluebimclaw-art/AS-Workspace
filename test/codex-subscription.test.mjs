import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateImage,Canvas} from '../server/canvas.mjs';
import {Store} from '../server/store.mjs';
import {ProjectFiles} from '../server/project-files.mjs';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const profile={enabled:true,protocol:'codex-subscription',baseUrl:'http://127.0.0.1:8648/v1',model:'gpt-image-2',inference:'cloud',key:'test-local-worker-access-only'};
const png=readFileSync(new URL('../fixtures/native-teapot.png',import.meta.url));
test('subscription profile discovery is image-only and cannot contact a remote endpoint',async t=>{
 const {ADAPTERS}=await import('../server/gateway.mjs');
 assert.deepEqual(ADAPTERS.find(a=>a.id==='codex-subscription')?.capabilities,['image']);
 const {modelList}=await import('../server/models.mjs');let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('must not contact provider');});
 await assert.rejects(modelList({...profile,baseUrl:'https://api.openai.com/v1'}),/Codex/);
 assert.equal(calls,0);
});
test('subscription profile is withheld from all non-admin users even with globalAccess',async()=>{
 const {Gateway}=await import('../server/gateway.mjs');
 const p={...profile,id:'fixture-subscription',globalAccess:true,allowedUsers:[],allowedProjects:[]};
 const gateway=new Gateway({state:{providers:[p],projects:[{id:'fixture-project',inferencePolicy:'approved-cloud'}]}});
 assert.equal(gateway.allowed({id:'admin',role:'admin'},'fixture-project',p),true);
 assert.equal(gateway.allowed({id:'member',role:'member'},'fixture-project',p),false);
 assert.equal(gateway.allowed({id:'viewer',role:'viewer'},'fixture-project',p),false);
});
test('Codex references are rejected before queue preparation or any fetch',async t=>{
 const p={...profile,id:'reference-test',capabilities:['image']};let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{calls++;throw Error('network must not run');});
 const body={provider:p.id,prompt:'Synthetic unsupported reference',references:['data:image/png;base64,'+png.toString('base64')]};
 await assert.rejects(new Canvas({},{}).prepare(body,{[p.id]:p}),/文字生圖/);
 await assert.rejects(generateImage(p,body),/文字生圖/);assert.equal(calls,0);
});
test('subscription adapter accepts an existing real PNG fixture from the local worker',async t=>{
 let request;
 t.mock.method(globalThis,'fetch',async(url,options)=>{request={url,options};return new Response(JSON.stringify({data:[{b64_json:png.toString('base64')}]}));});
 const images=await generateImage(profile,{prompt:'fixture replay, not a new generation'});
 assert.deepEqual(images[0].bytes,png);
 assert.equal(request.url,'http://127.0.0.1:8648/v1/images/generations');
 assert.equal(request.options.headers.Authorization,'Bearer '+profile.key);
 assert.equal(request.options.redirect,'error');
 assert.equal(JSON.parse(request.options.body).model,'gpt-image-2');
});
test('Codex adapter rejects non-worker routes before any outbound fetch',async t=>{
 let calls=0;t.mock.method(globalThis,'fetch',async()=>{calls++;return new Response(JSON.stringify({data:[{b64_json:png.toString('base64')}]}));});
 for(const change of [{baseUrl:'https://api.openai.com/v1'},{baseUrl:'http://192.168.1.111:8648/v1'},{baseUrl:'http://127.0.0.1:9999/v1'},{inference:'local'},{model:'other-image-model'},{key:''}]){
  await assert.rejects(generateImage({...profile,...change},{prompt:'Do not submit'}),/Codex/);
 }
 assert.equal(calls,0);
});
