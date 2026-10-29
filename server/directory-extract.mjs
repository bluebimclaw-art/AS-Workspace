import path from 'node:path';
import {mkdir,readFile,readdir,writeFile,access} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {buildArgs} from '@opendataloader/pdf';
import {findJava,pdfChunks} from './pdf-search.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export function runLocal(command,args,{timeoutMs=120000,maxBytes=2000000}={}){return new Promise((resolve,reject)=>{
 const p=spawn(command,args,{shell:false,windowsHide:true});let settled=false,out='';const finish=(e)=>{if(settled)return;settled=true;clearTimeout(timer);e?reject(e):resolve(out);};
 const timer=setTimeout(()=>{p.kill();finish(Error('本機解析逾時；不自動重送'));},timeoutMs);
 p.stdout.on('data',b=>{out+=b;if(Buffer.byteLength(out)>maxBytes){p.kill();finish(Error('解析輸出超出限制'));}});p.stderr.on('data',()=>{});
 p.on('error',()=>finish(Error('本機解析工具未就緒，請先執行搜尋環境檢查')));p.on('exit',c=>finish(c===0?null:Error('本機解析失敗；可能是加密、損壞或不支援格式')));
});}
export async function extractDirectoryFile(bytes,ext,work,{ocr=false,lang='eng+chi_tra+chi_sim'}={}){
 await mkdir(work,{recursive:true});
 if(['.txt','.md','.csv'].includes(ext))return {chunks:[{text:bytes.toString('utf8').slice(0,250000)}],parser:'utf8',status:bytes.length>250000?'partial':'ready'};
 if(ext!=='.pdf'&&!['.png','.jpg','.jpeg'].includes(ext))return {chunks:[],status:'filename-only',parser:null};
 const input=path.join(work,'input'+ext);await writeFile(input,bytes);let chunks=[],pages=ext==='.pdf'?null:1;
 if(ext==='.pdf'){
  const java=process.env.POC_JAVA_BIN||await findJava(path.join(root,'tools/java'))||'java';
  await runLocal(java,['-Xmx512m','-Djava.awt.headless=true','-jar',path.join(root,'node_modules/@opendataloader/pdf/lib/opendataloader-pdf-cli.jar'),...buildArgs({outputDir:work,format:'json',imageOutput:'off',hybrid:'off',quiet:true}),input]);
  const output=(await readdir(work)).find(n=>n.endsWith('.json'));if(!output)throw Error('PDF 沒有產生文字索引');
  const doc=JSON.parse(await readFile(path.join(work,output),'utf8'));chunks=pdfChunks(doc);pages=doc['number of pages'];
 }
 let ocrPages=0,confidence=[];
 if(ocr){
  const languages=lang.split('+');if(!languages.length||languages.some(l=>!['eng','chi_tra','chi_sim'].includes(l)))throw Error('OCR 語言設定不接受');
  const langPath=path.resolve(root,process.env.POC_OCR_LANG_DIR||'tools/ocr');for(const l of languages)await access(path.join(langPath,l+'.traineddata.gz')).catch(()=>{throw Error('OCR 語言包未就緒，請執行 npm run search:ocr:setup');});
  const {createWorker}=await import('tesseract.js');let worker;
  let timer;
  try{
   const task=(async()=>{worker=await createWorker(lang,1,{langPath,cacheMethod:'none',errorHandler:()=>{}});
    const limit=Math.min(pages||1,30);if(ext==='.pdf'&&!Number.isInteger(pages))throw Error('無法確認 PDF 頁數，未執行 OCR');
    for(let page=1;page<=limit;page++){
     // A mixed PDF needs OCR only on pages with little searchable text.
     if(ext==='.pdf'&&chunks.filter(c=>c.page===page).reduce((n,c)=>n+c.text.trim().length,0)>=30)continue;
     let image=input;if(ext==='.pdf'){const prefix=path.join(work,'page-'+page);await runLocal(process.env.POC_PDFTOPPM_BIN||'pdftoppm',['-f',String(page),'-l',String(page),'-singlefile','-r','150','-scale-to','2400','-png',input,prefix],{timeoutMs:30000});image=prefix+'.png';}
     const r=await worker.recognize(image);ocrPages++;confidence.push(r.data.confidence);
     if(r.data.text.trim())chunks.push({page,text:r.data.text,ocr:true,confidence:r.data.confidence});
    }
   })();await Promise.race([task,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('OCR 逾時；任務不會自動重送')),120000);})]);
  }finally{clearTimeout(timer);if(worker)await worker.terminate();}
 }
 let remaining=250000;chunks=chunks.sort((a,b)=>(a.page||0)-(b.page||0)).flatMap(c=>{if(remaining<=0)return [];const text=c.text.slice(0,remaining);remaining-=text.length;return [{...c,text}];});
 const covered=new Set(chunks.map(c=>c.page)).size;
 return {chunks,pages,ocrPages,confidence,parser:ocr?'opendataloader+tesseract.js':'opendataloader',status:!chunks.length?'needs-ocr':remaining<=0||(pages&&covered<pages)?'partial':'ready'};
}
