import React,{useEffect,useRef,useState} from 'react';
import * as pdfjs from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc=workerUrl;
// Bundle the CJK maps/fonts locally: never fetch font data from a CDN.
const cmapUrls=import.meta.glob('/node_modules/pdfjs-dist/cmaps/*.bcmap',{eager:true,query:'?url',import:'default'});
const fontUrls=import.meta.glob('/node_modules/pdfjs-dist/standard_fonts/*.{pfb,ttf}',{eager:true,query:'?url',import:'default'});
async function localBytes(map,path){const url=map[path];if(!url)throw new Error('缺少本機 PDF 字型資料。');const r=await fetch(url,{credentials:'same-origin'});if(!r.ok)throw new Error('無法讀取本機 PDF 字型資料。');return new Uint8Array(await r.arrayBuffer());}
class LocalCMapReaderFactory{async fetch({name}){return {cMapData:await localBytes(cmapUrls,'/node_modules/pdfjs-dist/cmaps/'+name+'.bcmap'),compressionType:1};}}
class LocalFontReaderFactory{async fetch({filename}){return localBytes(fontUrls,'/node_modules/pdfjs-dist/standard_fonts/'+filename);}}

export default function ExplorerPdfPreview({url}){
 const holder=useRef(null),canvas=useRef(null);
 const [document,setDocument]=useState(null),[page,setPage]=useState(1),[width,setWidth]=useState(640),[busy,setBusy]=useState(true),[error,setError]=useState('');
 useEffect(()=>{const observer=new ResizeObserver(items=>{const w=items[0]?.contentRect.width;if(w>0)setWidth(Math.max(180,Math.floor(w)));});observer.observe(holder.current);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  let active=true,task;const controller=new AbortController();setDocument(null);setPage(1);setError('');setBusy(true);
  (async()=>{
   const response=await fetch(url,{credentials:'same-origin',signal:controller.signal});
   if(!response.ok)throw new Error(`PDF 讀取失敗（HTTP ${response.status}）。`);
   const bytes=await response.arrayBuffer();if(bytes.byteLength>32*1024*1024)throw new Error('PDF 超過 32 MiB 預覽上限。');if(!active)return;
   task=pdfjs.getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true,useWasm:false,useWorkerFetch:false,CMapReaderFactory:LocalCMapReaderFactory,StandardFontDataFactory:LocalFontReaderFactory});
   const doc=await task.promise;if(!active){doc.destroy();return;}setDocument(doc);
  })().catch(e=>{if(active&&e.name!=='AbortError'){setError(e.message||'PDF 無法顯示，請下載原檔。');setBusy(false);}});
  return()=>{active=false;controller.abort();task?.destroy();};
 },[url]);
 useEffect(()=>{
  if(!document)return;let active=true,render;setBusy(true);setError('');
  (async()=>{
   const pdfPage=await document.getPage(page);if(!active)return;
   const base=pdfPage.getViewport({scale:1}),scale=Math.min(2,window.devicePixelRatio||1),viewport=pdfPage.getViewport({scale:(width-4)/base.width*scale});
   const target=canvas.current;target.width=Math.ceil(viewport.width);target.height=Math.ceil(viewport.height);
   render=pdfPage.render({canvas:target,canvasContext:target.getContext('2d'),viewport});await render.promise;if(active)setBusy(false);
  })().catch(e=>{if(active&&e.name!=='RenderingCancelledException'){setError(e.message||'PDF 頁面無法顯示。');setBusy(false);}});
  return()=>{active=false;render?.cancel();};
 },[document,page,width]);
 return <div ref={holder} className="explorer-pdf" aria-label="檔案庫 PDF 預覽" aria-busy={busy}>
  <div className="explorer-pdf-toolbar"><button type="button" disabled={!document||busy||page===1} onClick={()=>setPage(n=>n-1)}>上一頁</button><span>{document?`${page} / ${document.numPages}`:'讀取 PDF…'}</span><button type="button" disabled={!document||busy||page>=document.numPages} onClick={()=>setPage(n=>n+1)}>下一頁</button></div>
  <p className="explorer-hint">部分未嵌入中文字型的 PDF 可能缺字，請以原檔覆核。</p>
  {error&&<p role="alert">{error} 可使用下方下載連結。</p>}{busy&&!error&&<p role="status">正在顯示 PDF 頁面…</p>}
  <div className="explorer-pdf-pages"><canvas ref={canvas} aria-label={`PDF 第 ${page} 頁`} style={{visibility:error?'hidden':'visible'}}/></div>
 </div>;
}
