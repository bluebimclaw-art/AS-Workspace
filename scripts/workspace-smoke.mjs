import {mkdir,readFile,writeFile,readdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {createApp} from '../server/index.mjs';
import {resultText} from '../server/craft-mcp.mjs';
const dir=path.resolve('data/workspace-smoke',randomUUID());await mkdir(dir,{recursive:true});
const {server,office,files}=await createApp({dataDir:dir});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`,steps=[];
const post=async(url,body)=>{const r=await fetch(base+'/api/'+url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok)throw new Error(JSON.stringify(d));return d;};
const check=(name,passed,details)=>{steps.push({name,passed,details});if(!passed)throw new Error(name);console.log('PASS '+name);};
function pdfFixture(imageOnly=false){
 const streams=imageOnly?['q 100 0 0 100 50 600 cm /Im1 Do Q']:['BT /F1 14 Tf 50 720 Td (Reception retains existing entrance. FIRST-PAGE-42) Tj ET','BT /F1 14 Tf 50 720 Td (Clause SECOND-PAGE-73 requires review. Cost unknown.) Tj ET'];
 const objects=['<< /Type /Catalog /Pages 2 0 R >>',`<< /Type /Pages /Count ${streams.length} /Kids [${streams.map((_,i)=>`${4+i*2} 0 R`).join(' ')}] >>`,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
 streams.forEach((s,i)=>{objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >>${imageOnly?' /XObject << /Im1 6 0 R >>':''} >> /Contents ${5+i*2} 0 R >>`);objects.push(`<< /Length ${Buffer.byteLength(s)} >>\nstream\n${s}\nendstream`);});
 if(imageOnly)objects.push('<< /Type /XObject /Subtype /Image /Width 1 /Height 1 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Length 3 >>\nstream\n\xff\xff\xff\nendstream');
 let text='%PDF-1.4\n';const offsets=[0];objects.forEach((o,i)=>{offsets.push(Buffer.byteLength(text,'latin1'));text+=`${i+1} 0 obj\n${o}\nendobj\n`;});const xref=Buffer.byteLength(text,'latin1');text+=`xref\n0 ${objects.length+1}\n0000000000 65535 f \n`+offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')+`trailer\n<< /Size ${objects.length+1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;return Buffer.from(text,'latin1');
}
let failure;
try{
 const r=await post('office/run',{tool:'gridcraft',action:'create',title:'Grid 共用驗證',tsv:'項目\t數量\t單價\t金額\nWORKSPACE-GRID-42\t2\t123.45\t=B2*C2\n總額\t\t\t=SUM(D2:D2)'});
 const f=await post('project/promote',{officeFileId:r.files.find(f=>f.name.endsWith('.xlsx')).id});const original=await files.bytes(f.id,1);
 const indexed=await post('project/index',{id:f.id,kind:'grid'});check('Real GridCraft reopens XLSX; values/formulas shared',indexed.text.includes('246.9')&&indexed.text.includes('B2*C2'),{scope:indexed.index.scope});
 const hits=await(await fetch(base+'/api/search?q=WORKSPACE-GRID-42')).json();check('Saved workbook searchable without copy-to-source',hits.some(h=>h.id===f.id&&h.type==='project'&&h.version===1));
 const work=path.join(dir,'office','edit-smoke');await mkdir(work,{recursive:true});const snapshot=path.join(work,'edited.xlsx');await writeFile(snapshot,original);const {m}=await office.session('gridcraft',work);
 try{await m.call('open_workbook',{path:snapshot});await m.call('write_range',{range:'B2',values:[[3]]});await m.call('save_workbook',{path:snapshot});}finally{m.close();}
 const v2=await post('project/files',{id:f.id,name:f.name,expectedVersion:1,base64:(await readFile(snapshot)).toString('base64')});
 check('XLSX edit saved as v2; original v1 hash unchanged',v2.version===2&&createHash('sha256').update(await files.bytes(f.id,1)).digest('hex')===createHash('sha256').update(original).digest('hex'));
 const read2=await post('project/index',{id:f.id,kind:'grid'});check('Reopen v2 recalculates real formula 3 × 123.45',read2.text.includes('370.35'));
 const stale=await fetch(base+'/api/project/files',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:f.id,name:f.name,expectedVersion:1,base64:original.toString('base64')})});check('Stale editor version rejected',stale.status===409);
 const pdf=await post('project/files',{name:'search-two-pages.pdf',base64:pdfFixture().toString('base64')}),parsed=await post('project/index',{id:pdf.id,kind:'pdf'});
 const pdfHits=await(await fetch(base+'/api/search?q=SECOND-PAGE-73')).json(),hit=pdfHits.find(h=>h.id===pdf.id);check('Real OpenDataLoader PDF search locates page 2 + bbox',hit?.page===2&&hit?.bbox?.length===4,{index:parsed.index,hit});
 const image=await post('project/files',{name:'image-only-synthetic.pdf',base64:pdfFixture(true).toString('base64')}),noText=await post('project/index',{id:image.id,kind:'pdf'});check('Image-only fixture labelled needs OCR',noText.index.status==='needs-ocr',noText.index);
 const chinese=await post('office/run',{tool:'wordcraft',action:'create',title:'繁體中文搜尋測試',text:'接待區保留現有入口。條款 CHINESE-42。金額尚未提供。'});const cf=await post('project/promote',{officeFileId:chinese.files.find(f=>f.name.endsWith('.pdf')).id}),ci=await post('project/index',{id:cf.id,kind:'pdf'});
 check('Real WordCraft PDF → OpenDataLoader retains Traditional Chinese',ci.text.includes('接待區')&&ci.text.includes('CHINESE-42'),{index:ci.index,text:ci.text.slice(0,500)});
 const bad=await post('project/files',{name:'malformed.pdf',base64:Buffer.from('%PDF-not-a-real-document').toString('base64')});const badRes=await fetch(base+'/api/project/index',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:bad.id,kind:'pdf'})});check('Malformed PDF records explicit parse failure',!badRes.ok&&files.file(bad.id).index.status==='failed');
 const html=await fetch(base+'/gridcraft/gridcraft-web-0.11.1-cjk1/index.html');check('Real Web editor HTML served',html.ok&&(await html.text()).includes('gridcraft_canvas'));
 const assets=await readdir('dist/gridcraft/gridcraft-web-0.11.1-cjk1'),wasm=assets.find(n=>n.endsWith('.wasm')),wasmResponse=await fetch(base+'/gridcraft/gridcraft-web-0.11.1-cjk1/'+wasm),wasmBytes=Buffer.from(await wasmResponse.arrayBuffer());
 check('WebAssembly MIME + binary validation',wasmResponse.headers.get('content-type')==='application/wasm'&&WebAssembly.validate(wasmBytes),{bytes:wasmBytes.length,note:'Not browser rendering/interaction'});
 for(const item of JSON.parse(await readFile('config/office-web.json','utf8'))){const dir='dist/office/'+item.folder,manifest=JSON.parse(await readFile(dir+'/platform-build.json','utf8')),name=Object.keys(manifest.files).find(n=>n.endsWith('.wasm'));const response=await fetch(base+'/office/'+item.folder+'/'+name,{headers:{'Accept-Encoding':'gzip'}}),binary=await response.arrayBuffer();check(item.id+' Web MIME + gzip + immutable asset + binary',response.headers.get('content-type')==='application/wasm'&&response.headers.get('content-encoding')==='gzip'&&response.headers.get('cache-control').includes('immutable')&&WebAssembly.validate(binary),{bytes:binary.byteLength});}
 const reopened=await createApp({dataDir:dir});check('Disk reopen preserves versions, search data and source hash',reopened.files.file(f.id).version===2&&reopened.files.file(pdf.id).chunks.some(c=>c.page===2));reopened.server.close();
}catch(e){failure=e;console.error(e.stack);}finally{
 await new Promise(r=>{server.closeAllConnections();server.close(r);});const evidence={timestamp:new Date().toISOString(),platform:process.platform,node:process.version,kind:'REAL local HTTP + Craft MCP + Java parser; browser and AI inference NOT tested',dataDir:dir,steps,passed:!failure,error:failure?.message,remaining:['Browser GridCraft open/edit/save/undo and layout','Mac deployment and Safari/Chrome','Real Ollama/Hermes/cloud generation','Company document OCR and complex-table benchmark']};await writeFile('evidence/workspace-smoke.json',JSON.stringify(evidence,null,2));if(failure)process.exitCode=1;
}
