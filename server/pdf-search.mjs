import path from 'node:path';
import {mkdir,readdir,readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {buildArgs} from '@opendataloader/pdf';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export async function findJava(dir,depth=0){if(depth>5)return;let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch{return;}for(const e of entries){if(e.isDirectory()){const p=await findJava(path.join(dir,e.name),depth+1);if(p)return p;}else if(e.name===(process.platform==='win32'?'java.exe':'java')&&path.basename(dir)==='bin')return path.join(dir,e.name);}}
function run(command,args){return new Promise((resolve,reject)=>{const p=spawn(command,args,{shell:false,windowsHide:true});let log='';const timer=setTimeout(()=>{p.kill();reject(new Error('PDF 解析逾時（120秒）；沒有啟用雲端或 OCR fallback'));},120000);p.stdout.on('data',b=>{log=(log+b).slice(-3000);});p.stderr.on('data',b=>{log=(log+b).slice(-3000);});p.on('error',e=>{clearTimeout(timer);reject(new Error(e.code==='ENOENT'?'Java 未就緒：執行 npm run search:java，或設定 POC_JAVA_BIN':e.message));});p.on('exit',c=>{clearTimeout(timer);c===0?resolve(log):reject(new Error('PDF 解析失敗（可能加密或格式不支援）：'+log.slice(-500)));});});}
export function pdfChunks(doc){
 const chunks=[];
 function visit(node,inheritedPage){if(!node||typeof node!=='object')return;const page=node['page number']??node.page_number??inheritedPage,box=node['bounding box']??node.bounding_box;const text=typeof node.content==='string'?node.content:typeof node.text==='string'?node.text:'';
  if(text.trim()&&Number.isInteger(page))chunks.push({page,bbox:box,elementId:node.id??chunks.length,type:node.type,text});
  for(const [key,value]of Object.entries(node)){if(key==='content'&&typeof value==='string')continue;if(Array.isArray(value))for(const child of value)visit(child,page);else if(value&&typeof value==='object')visit(value,page);}
 }
 visit(doc);return chunks;
}
export class PdfSearch {
 constructor(store,files){this.store=store;this.files=files;this.active=false;}
 async index(id){
  if(this.active)throw Object.assign(new Error('PDF 解析進行中；稍後再試'),{status:409});const f=this.files.file(id);if(!f.name.toLowerCase().endsWith('.pdf'))throw Object.assign(new Error('只接受 PDF'),{status:400});
  this.active=true;const version=f.version,started=Date.now();
  try{
   await this.store.mutate(()=>{f.index={status:'processing',version,parser:'opendataloader',hybrid:'off'};});
   const dir=path.join(this.store.root,'pdf-index',f.id,String(version));await mkdir(dir,{recursive:true});const input=path.join(dir,'source.pdf');await writeFile(input,await this.files.bytes(id,version));
   const java=process.env.POC_JAVA_BIN||await findJava(path.join(root,'tools/java'))||'java';
   const jar=path.join(root,'node_modules/@opendataloader/pdf/lib/opendataloader-pdf-cli.jar');
   await run(java,['-Xmx1024m','-Djava.awt.headless=true','-jar',jar,...buildArgs({outputDir:dir,format:'json',imageOutput:'off',hybrid:'off',quiet:true}),input]);
   const output=(await readdir(dir)).find(n=>n.endsWith('.json'));if(!output)throw new Error('解析器沒有產生 JSON');const doc=JSON.parse(await readFile(path.join(dir,output),'utf8'));let remaining=200000;const chunks=[];for(const c of pdfChunks(doc)){if(remaining<=0)break;const text=c.text.slice(0,remaining);chunks.push({...c,text});remaining-=text.length;}
   await this.store.mutate(()=>{if(f.version!==version)throw Object.assign(new Error('解析期間檔案已變更，請重新解析'),{status:409});f.chunks=chunks;f.text=chunks.map(c=>c.text).join('\n').slice(0,200000);f.index={status:chunks.length?'partial':'needs-ocr',parser:'opendataloader',parserVersion:'2.5.15',hybrid:'off',version,pages:doc['number of pages'],chunks:chunks.length,elapsedMs:Date.now()-started,scope:'只讀文字層；未執行 OCR，掃描頁可能缺漏；搜尋保存最多200,000字元，分段結果最多500項'};});return f;
  }catch(e){await this.store.mutate(()=>{if(f.version===version)f.index={status:'failed',version,parser:'opendataloader',error:e.message};});throw e;}finally{this.active=false;}
 }
}
