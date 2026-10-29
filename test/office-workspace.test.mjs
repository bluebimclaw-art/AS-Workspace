import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {Store} from '../server/store.mjs';
import {ProjectFiles} from '../server/project-files.mjs';
import {OfficeTasks} from '../server/office-tasks.mjs';
import {officeMessage} from '../src/office-bridge.mjs';
import {acceptsGzip} from '../server/static-encoding.mjs';
import JSZip from 'jszip';
test('Deck native format is validated structurally and bridge pins app/frame/origin',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'deck-format-'));try{
  const files=await new ProjectFiles(await new Store(dir).init(),{}).init();
  const zip=new JSZip();zip.file('presentation.json',JSON.stringify({format:'deckcraft',version:1,presentation:{slides:[]}}));const base64=await zip.generateAsync({type:'base64'});
  assert.ok(await files.validate({name:'test.deckcraft',base64}));
  zip.file('presentation.json','{}');await assert.rejects(files.validate({name:'wrong.deckcraft',base64:await zip.generateAsync({type:'base64'})}));
  const source={},origin='https://platform.test',event={source,origin,data:{type:'deckcraft:save',name:'test.pptx',requestId:1,bytes:new Uint8Array([1])}};
  assert.ok(officeMessage(event,source,origin,'deckcraft'));assert.equal(officeMessage(event,source,origin,'wordcraft'),null);assert.equal(officeMessage({...event,origin:'https://other.test'},source,origin,'deckcraft'),null);
  const tasks=new OfficeTasks(files.store,files,{});await assert.rejects(tasks.prepare({tool:'constructor',action:'create'}),e=>e.status===400);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('large editor assets honor gzip negotiation including q=0',()=>{
 assert.equal(acceptsGzip('gzip, deflate, br'),true);assert.equal(acceptsGzip('gzip;q=0.5'),true);assert.equal(acceptsGzip('gzip;q=0'),false);assert.equal(acceptsGzip('gzip; q=0.000, br'),false);assert.equal(acceptsGzip(),false);
});
test('Office bridge rejects foreign origin/frame/app and over-limit saves',()=>{
 const source={},origin='https://platform.test',event={source,origin,data:{type:'wordcraft:save',name:'a.docx',bytes:new Uint8Array([1,2])}};
 assert.ok(officeMessage(event,source,origin,'wordcraft'));assert.equal(officeMessage(event,{},origin,'wordcraft'),null);assert.equal(officeMessage({...event,origin:'https://evil.test'},source,origin,'wordcraft'),null);assert.equal(officeMessage(event,source,origin,'pdfcraft'),null);assert.equal(officeMessage({...event,data:{...event.data,bytes:new Uint8Array(5_000_001)}},source,origin,'wordcraft').type,'wordcraft:oversize');
});
test('Office queue preparation pins immutable source versions and refuses malformed operations before queue entry',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'office-task-contract-'));try{
  const store=await new Store(dir).init(),files=await new ProjectFiles(store,{}).init(),tasks=new OfficeTasks(store,files,{});
  const f=await files.save({name:'sample.pdf',base64:Buffer.from('%PDF-synthetic').toString('base64')});
  const body={tool:'pdfcraft',action:'extract',title:'結果',inputs:[{id:f.id,version:1}],pages:[1]};
  const snapshot=await tasks.prepare(body);assert.equal(snapshot.snapshots[0].sha256,f.versions[0].sha256);await files.save({id:f.id,name:f.name,expectedVersion:1,base64:Buffer.from('%PDF-v2').toString('base64')});assert.equal(snapshot.snapshots[0].version,1);await assert.rejects(tasks.prepare(body),e=>e.status===409);
  const current={...body,inputs:[{id:f.id,version:2}]};for(const bad of [{pages:[1,1]},{pages:[0]},{title:'../outside'},{action:'js_run'},{action:'rotate',degrees:13},{action:'split',every:0},{tool:'wordcraft',action:'inspect'}])await assert.rejects(tasks.prepare({...current,...bad}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('multi-output jobs register all files together; one invalid item cannot publish a partial split batch',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'office-batch-'));try{
  const store=await new Store(dir).init(),files=await new ProjectFiles(store,{}).init(),actor={id:'member',name:'member'};
  await assert.rejects(files.createBatch([{name:'valid.txt',base64:'YQ=='},{name:'invalid.pdf',base64:'YQ=='}],actor,{}));assert.equal(store.db.projectFiles.length,0);
  const outputs=await files.createBatch([{name:'a.txt',base64:'YQ=='},{name:'b.txt',base64:'Yg=='}],actor,{action:'split'});assert.equal(outputs.length,2);assert.equal((await new Store(dir).init()).db.projectFiles.length,2);assert.equal(outputs[1].derivation.action,'split');assert.ok(outputs[0].derivation.batchId);assert.equal(outputs[0].derivation.batchId,outputs[1].derivation.batchId);
 }finally{await rm(dir,{recursive:true,force:true});}
});
