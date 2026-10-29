import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {Store} from '../server/store.mjs';
import {Office} from '../server/office.mjs';
import {search} from '../server/search.mjs';

test('Office rejects unsupported tools, non-PDF uploads, missing sources and unconfirmed experiments',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'office-'));try{const s=await new Store(dir).init(),o=await new Office(s).init();
 await assert.rejects(o.run({tool:'cadcraft',action:'create'}),/格式/);
 await assert.rejects(o.run({tool:'deckcraft',action:'create'}),/試驗/);
 await assert.rejects(o.run({tool:'wordcraft',action:'create',sourceIds:['missing']}),/資產/);
 await assert.rejects(o.run({tool:'gridcraft',action:'create',tsv:''}),/TSV/);
 await assert.rejects(o.importPdf({name:'x.pdf',base64:Buffer.from('not pdf').toString('base64')}),/不是 PDF/);
 await assert.rejects(o.importPdf({name:'x.exe',base64:'JVBERi0='}),/只接受/);
 assert.equal(s.db.officeJobs.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('missing Office executable records failure; restart marks incomplete jobs interrupted',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'office-'));try{const s=await new Store(dir).init();const o=await new Office(s,{config:async()=>({wordcraft:{enabled:true,command:path.join(dir,'absent-cli'),timeoutMs:1000}})}).init();
 await assert.rejects(o.run({tool:'wordcraft',action:'create',title:'test'}),/無法啟動/);assert.equal(s.db.officeJobs[0].status,'failed');assert.equal(s.db.officeFiles.length,0);assert.equal(o.active,false);
 await s.mutate(db=>db.officeJobs.push({id:'unfinished',status:'running'}));const reopened=await new Store(dir).init();await new Office(reopened).init();assert.equal(reopened.db.officeJobs.at(-1).status,'interrupted');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Office PDF import preserves bytes, portable path and source references; traversal rejected',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'office-'));try{const s=await new Store(dir).init(),o=await new Office(s).init(),a=await s.addAsset({name:'來源',text:'接待區'});
 const f=await o.importPdf({name:'test.pdf',base64:Buffer.from('%PDF-1.7\nsynthetic-not-a-complete-document').toString('base64'),sourceIds:[a.id]});assert.ok(!f.storagePath.includes('\\'));assert.equal(f.sources[0].assetId,a.id);
 // Header acceptance is not a parser/validity claim; parsing only happens in the real tool task.
 await s.mutate(()=>{f.text='接待區資料';});assert.ok(search(s.db,'接待區').some(h=>h.type==='office'&&h.sources[0].assetId===a.id));
 const outside=path.join(dir,'outside.txt');await writeFile(outside,'x');await assert.rejects(o.filePath({storagePath:'outside.txt'}),/不允許/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
