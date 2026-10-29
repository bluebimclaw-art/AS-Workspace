import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createApp} from '../server/index.mjs';
import {Store} from '../server/store.mjs';
import JSZip from 'jszip';
const parent=path.resolve('evidence/office-live-data');await mkdir(parent,{recursive:true});const dir=await mkdtemp(path.join(parent,'run-'));
const {server,store,office}=await createApp({dataDir:dir});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const report={platform:process.platform,node:process.version,at:new Date().toISOString(),dataDir:dir,steps:[]};
async function request(route,body){const r=await fetch(base+'/api/'+route,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();if(!r.ok)throw new Error(JSON.stringify(data));return data;}
async function step(name,fn){const start=Date.now();try{const result=await fn();report.steps.push({name,status:'passed',ms:Date.now()-start,result});return result;}catch(e){report.steps.push({name,status:'failed',ms:Date.now()-start,error:e.message});throw e;}}
try{
 await step('four real MCP handshakes',async()=>{const h=await request('office/health',{});assert.ok(h.every(t=>t.available),JSON.stringify(h));return h;});
 const a=await request('assets',{name:'Office synthetic source.txt',text:'接待區保留入口。預算未提供。OfficeTrial2026'});const original=a.sha256;
 const word=await step('WordCraft DOCX PDF create and DOCX reopen',()=>request('office/run',{tool:'wordcraft',action:'create',title:'OfficeTrial2026 公司測試報告',sourceIds:[a.id]}));
 const grid=await step('GridCraft formula XLSX save and reopen',async()=>{const r=await request('office/run',{tool:'gridcraft',action:'create',title:'OfficeTrial2026 quotation',sourceIds:[a.id],tsv:'項目\t數量\t單價\t金額\n測試\t2\t123.45\t=B2*C2\n總額\t\t\t=SUM(D2:D2)'});const f=r.files.find(f=>f.name==='readback.json');const read=JSON.parse(await readFile(await office.filePath(f),'utf8'));assert.equal(read.values[1][3],246.9);assert.equal(read.values[2][3],246.9);const book=r.files.find(f=>f.name==='workbook.xlsx'),zip=await JSZip.loadAsync(await readFile(await office.filePath(book))),xml=await zip.file('xl/worksheets/sheet1.xml').async('string');assert.ok(xml.includes('B2*C2'));assert.ok(xml.includes('SUM(D2:D2)'));return r;});
 await step('DeckCraft experimental PPTX save reopen',()=>request('office/run',{tool:'deckcraft',action:'create',title:'OfficeTrial2026 進度匯報',text:'接待區保留入口。\n預算未提供。',sourceIds:[a.id],experimental:true}));
 const pdf=word.files.find(f=>f.name.endsWith('.pdf'));
 async function pdfJob(action,ids,pages,expected){const r=await request('office/run',{tool:'pdfcraft',action,title:'PDF驗證',fileIds:ids,pages});const report=r.files.find(f=>f.name==='analysis.json'),data=JSON.parse(await readFile(await office.filePath(report),'utf8'));assert.equal(data.info.document.pages,expected);assert.ok(data.text.includes('接待區'));assert.ok(r.files.some(f=>f.name==='preview.png'));return r;}
 await step('PdfCraft PDF text and homepage render',()=>pdfJob('inspect',[pdf.id],undefined,1));
 const imported=await step('PDF upload preserves hash',async()=>{const bytes=await readFile(await office.filePath(pdf));const f=await request('office/import',{name:'test.pdf',base64:bytes.toString('base64'),sourceIds:[a.id]});assert.equal(f.sha256,pdf.sha256);return f;});
 await step('PdfCraft merge two PDF inputs gives two pages',()=>pdfJob('merge',[pdf.id,imported.id],undefined,2));
 await step('PdfCraft extract page gives one page',()=>pdfJob('extract',[pdf.id],[1],1));
 await step('artifact search and shared sources',async()=>{const hits=await request('search?q=OfficeTrial2026');const officeHits=hits.filter(h=>h.type==='office');assert.ok(officeHits.length>=3);assert.ok(officeHits.every(h=>h.sources.some(s=>s.assetId===a.id)));return {officeHits:officeHits.length};});
 await step('exported text becomes asset and Excalidraw shared source',async()=>{const f=grid.files.find(f=>f.name.endsWith('.xlsx'));const source=await request(`office/files/${f.id}/source`,{});assert.equal(source.originOfficeFileId,f.id);const b=await request('boards',{name:'Office資料白板',elements:[{type:'text',text:source.text.slice(0,100)}],sourceIds:[source.id]});assert.equal(b.sources[0].assetId,source.id);return {sourceId:source.id,boardId:b.id};});
 await step('download hash and persistence after store reopen',async()=>{const r=await fetch(base+'/api/office/files/'+pdf.id);assert.equal(r.status,200);const bytes=Buffer.from(await r.arrayBuffer());assert.equal(createHash('sha256').update(bytes).digest('hex'),pdf.sha256);const reopened=await new Store(dir).init();assert.equal(reopened.asset(a.id).sha256,original);assert.ok(reopened.db.officeJobs.every(j=>j.status==='succeeded'));return {files:reopened.db.officeFiles.length,jobs:reopened.db.officeJobs.length};});
}catch(e){process.exitCode=1;console.error(e.message);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await writeFile('evidence/office-smoke.json',JSON.stringify(report,null,2));console.log(report.steps.map(s=>s.status+' '+s.name+(s.error?' '+s.error:'')).join('\n'));}
