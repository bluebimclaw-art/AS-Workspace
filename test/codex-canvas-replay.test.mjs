// Integration replay of an independently generated native artifact. NO new generation.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {Canvas} from '../server/canvas.mjs';import {Store} from '../server/store.mjs';import {ProjectFiles} from '../server/project-files.mjs';
test('native image fixture survives SQLite Canvas save, reopen, file bytes and immutable versions',async t=>{
 const png=readFileSync(new URL('../fixtures/native-teapot.png',import.meta.url));
 t.mock.method(globalThis,'fetch',async()=>new Response(JSON.stringify({data:[{b64_json:png.toString('base64')}]})));
 const dir=await mkdtemp(path.join(os.tmpdir(),'as-codex-canvas-'));let store;
 try{
  store=await new Store(dir,{sqlite:true}).init();let files=await new ProjectFiles(store).init(),canvas=await new Canvas(store,files).init();
  const p={id:'subscription-test',enabled:true,protocol:'codex-subscription',baseUrl:'http://127.0.0.1:8648/v1',model:'gpt-image-2',inference:'cloud',key:'test-local-worker-access-only',capabilities:['image']};
  const profiles={[p.id]:p},user={id:'fixture-admin',name:'Fixture replay only'};
  const input=await canvas.prepare({provider:p.id,prompt:'Replay existing teapot artifact; no generation'},profiles);
  assert.equal((await canvas.execute(input,profiles,user)).files.length,1);
  const snapshot={schema:1,projects:[{id:'fixture-board',title:'Native image replay',nodes:[{id:'image-one',type:'image',metadata:{storageKey:'teapot'}}],connections:[]}],stores:[['image_files',[['teapot',{__asBlob:true,type:'image/png',base64:png.toString('base64')}]]]]};
  const saved=await canvas.save({name:'Codex fixture acceptance',snapshot},user);assert.equal(saved.version,1);
  store.sql.close();store=await new Store(dir,{sqlite:true}).init();files=await new ProjectFiles(store).init();canvas=await new Canvas(store,files).init();
  const reopened=canvas.board(saved.id);assert.equal(reopened.board.version,1);
  const ref=reopened.snapshot.images[0];assert.deepEqual(await files.bytes(ref.fileId,ref.version),png);
  const next=structuredClone(snapshot);next.projects[0].nodes.push({id:'text-v2',type:'text',metadata:{content:'v2'}});
  assert.equal((await canvas.save({id:saved.id,name:'Codex fixture acceptance',snapshot:next,expectedVersion:1},user)).version,2);
  assert.equal(canvas.board(saved.id,1).snapshot.snapshot.projects[0].nodes.length,1);
  assert.deepEqual(await files.bytes(ref.fileId,1),png);
 }finally{try{store?.sql?.close();}catch{}await rm(dir,{recursive:true,force:true});}
});
