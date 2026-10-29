import path from 'node:path';
import {mkdir,writeFile,readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resultText} from './craft-mcp.mjs';
const fail=(message,status=400)=>Object.assign(new Error(message),{status});
const allowed={pdfcraft:['inspect','merge','extract','split','rotate','reverse','delete','reduce'],wordcraft:['create','inspect','convert','replace'],deckcraft:['create','inspect','convert']};
const parse=r=>{const t=resultText(r);try{return JSON.parse(t);}catch{return {text:t};}};
const words=v=>typeof v==='string'?v:Array.isArray(v)?v.map(words).join('\n'):v&&typeof v==='object'?Object.values(v).map(words).join('\n'):'';
export class OfficeTasks{
 constructor(store,files,office){Object.assign(this,{store,files,office});}
 async prepare(body){
  const {tool,action,title='公司文件',text='',inputs=[],pages=[],degrees=90,every=1,find='',replacement=''}=body;
  if(!Object.hasOwn(allowed,tool)||!allowed[tool].includes(action)||typeof title!=='string'||!title.trim()||title.length>150||/[\\/\x00-\x1f]/.test(title)||typeof text!=='string'||text.length>30000||!Array.isArray(inputs)||inputs.length>10)throw fail('文件任務格式不正確');
  if((action==='create'&&inputs.length)||(action!=='create'&&!inputs.length)||(action!=='merge'&&inputs.length>1)||(action==='merge'&&inputs.length<2))throw fail('請核對輸入檔案數目；合併至少兩份，其他操作一份');
  const snapshots=inputs.map(({id,version})=>{const f=this.files.file(id),v=this.files.version(id,version);if(version!==f.version)throw fail('來源已有新版本，請重新選取',409);if(!(tool==='pdfcraft'?/\.pdf$/i:tool==='deckcraft'?/\.(pptx|deckcraft)$/i:/\.(docx|dotx|doc|odt|rtf|txt|md|html?|tex)$/i).test(f.name))throw fail('來源格式不適用');return {id,version,name:f.name,sha256:v.sha256};});
  if(tool==='deckcraft'&&action==='create'&&text.split(/^---\s*$/m).length>30)throw fail('背景起草最多30張投影片');
  if(!Array.isArray(pages)||pages.length>100||pages.some(p=>!Number.isInteger(p)||p<1||p>10000)||new Set(pages).size!==pages.length)throw fail('頁碼須為不重複正整數，最多100頁');
  if(['extract','delete'].includes(action)&&!pages.length)throw fail('請指定頁碼');
  if(action==='rotate'&&![90,180,270].includes(degrees))throw fail('旋轉角度須為90、180或270');
  if(action==='split'&&(!Number.isInteger(every)||every<1||every>1000))throw fail('分拆頁數須為1至1000');
  if(typeof find!=='string'||typeof replacement!=='string'||find.length>1000||replacement.length>5000||(action==='replace'&&!find.trim()))throw fail('尋找或替換文字不正確');
  return {kind:'office',provider:'office',model:tool,label:`${tool} · ${action} · ${title}`,tool,action,title,text,snapshots,pages,degrees,every,find,replacement};
 }
 async execute(input,user,signal){
  signal?.throwIfAborted();const dir=path.join(this.store.root,'office','tasks',randomUUID());await mkdir(dir,{recursive:true});
  const sources=[];for(let i=0;i<input.snapshots.length;i++){const s=input.snapshots[i],ext=path.extname(s.name);const file=path.join(dir,`input-${i}${ext}`);await writeFile(file,await this.files.bytes(s.id,s.version));sources.push(file);}
  const session=await this.office.session(input.tool,dir),m=session.m;const outputs=[],observations={};
  const abort=()=>m.close();signal?.addEventListener('abort',abort,{once:true});
  const call=async(name,args)=>{signal?.throwIfAborted();if(!session.tools.tools.some(t=>t.name===name))throw fail('目前工具缺少能力：'+name);const r=await m.call(name,args);signal?.throwIfAborted();return r;};
  const stage=[];const output=async(file,name)=>{const bytes=await readFile(file);if(!bytes.length||bytes.length>5_000_000)throw fail('輸出檔案為空或超過項目5MB限制，沒有覆寫原檔');stage.push({name,base64:bytes.toString('base64')});};
  try{
   if(input.tool==='deckcraft'){
    if(input.action==='create'){
     await call('new_presentation',{blank:true});
     const sections=(input.text.trim()||input.title).split(/^---\s*$/m);
     for(const section of sections){const [heading,...body]=section.trim().split('\n');await call('add_slide',{layout:'titleAndContent',title:heading||input.title,body:body.join('\n')});}
    }else await call('open_presentation',{path:sources[0]});
    const pptx=path.join(dir,'result.pptx'),pdf=path.join(dir,'result.pdf');
    await call('save_presentation',{path:pptx});await call('open_presentation',{path:pptx});
    const info=parse(await call('inspect_document',{}));observations.info={slides:info.slides?.map(s=>({index:s.index,title:s.title,shapes:s.shapes})),theme:info.theme};
    const slides=info.slides;if(!Array.isArray(slides)||!slides.length||slides.length>300)throw fail('簡報頁數為空或超過300張讀取上限');
    const content=v=>Array.isArray(v)?v.map(content).filter(Boolean).join('\n'):v&&typeof v==='object'?Object.entries(v).map(([k,x])=>['text','table','chart'].includes(k)?words(x):typeof x==='object'?content(x):'').filter(Boolean).join('\n'):'';
    const chunks=[];let remaining=200000;for(let i=0;i<slides.length&&remaining>0;i++){const slide=parse(await call('inspect_slide',{index:i}));const text=content(slide).slice(0,remaining);remaining-=text.length;chunks.push({slide:i+1,text});}
    observations.text=chunks.map(c=>`第${c.slide}張\n${c.text}`).join('\n').slice(0,200000);observations.reopened=true;
    if(input.action==='inspect'){
     const f=this.files.file(input.snapshots[0].id);await this.store.mutate(()=>{if(f.version!==input.snapshots[0].version)throw fail('讀取期間簡報已有新版本，請重試',409);f.text=observations.text;f.chunks=chunks;f.index={status:'partial',parser:'deckcraft-mcp',version:f.version,scope:'最多300張、200,000字元的投影片結構及文字；圖片、影音及講者備註未作完整索引'};});
    }else{await call('export',{path:pdf});await output(pptx,input.title+'.pptx');await output(pdf,input.title+'.pdf');}
   }else if(input.tool==='wordcraft'){
    if(input.action==='create'){await call('new_document',{});await call('type_text',{text:[input.title,input.text].filter(Boolean).join('\n\n'),paragraphs:true});}
    else await call('open_document',{path:sources[0]});
    if(input.action==='replace'){await call('select_text',{text:input.find,occurrence:1});await call('type_text',{text:input.replacement});}
    const docx=path.join(dir,'result.docx'),pdf=path.join(dir,'result.pdf');
    await call('save_document',{path:docx});await call('save_document',{path:pdf});await call('open_document',{path:docx});
    observations.text=words(parse(await call('get_text',{}))).slice(0,200000);observations.reopened=true;
    if(input.action==='create'&&![input.title,...input.text.split(/\n+/)].filter(Boolean).every(line=>observations.text.includes(line)))throw fail('DOCX 重開內容不完整');
    if(input.action==='replace'&&!observations.text.includes(input.replacement))throw fail('替換結果重開不一致');
    if(input.action==='inspect'){
     const f=this.files.file(input.snapshots[0].id);await this.store.mutate(()=>{if(f.version!==input.snapshots[0].version)throw fail('讀取期間文件已有新版本，請重試',409);f.text=observations.text;f.chunks=[{text:observations.text}];f.index={status:'partial',parser:'wordcraft-mcp',version:f.version,scope:'WordCraft DOCX 文字，最多200,000字元；圖片、註解、頁面及表格格式未作結構化索引'};});
    }else{await output(docx,input.title+'.docx');await output(pdf,input.title+'.pdf');}
   }else{
    const opened=parse(await call('doc_open',{path:sources[0]})),doc=opened.doc??opened.id??opened.document?.id;if(!Number.isInteger(doc))throw fail('PdfCraft document ID 不正確');
    const before=parse(await call('doc_info',{doc})),count=before.document?.pages??before.pages;
    if(!Number.isInteger(count)||count<1)throw fail('無法核對 PDF 頁數');
    if(input.pages.some(p=>p>count)||(input.action==='delete'&&input.pages.length>=count))throw fail('頁碼超出範圍，或不能刪除所有頁');
    const target=path.join(dir,'result.pdf');
    if(input.action==='merge')await call('doc_combine',{paths:sources,out:target});
    else if(input.action==='extract')await call('page_extract',{doc,pages:input.pages,out:target});
    else if(input.action==='split'){
     if(Math.ceil(count/input.every)>100)throw fail('分拆會超過100份，請增加每份頁數');
     const out=path.join(dir,'parts');await mkdir(out);await call('doc_split',{doc,every:input.every,out_dir:out});
     const names=(await readdir(out)).filter(n=>n.endsWith('.pdf')).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
     if(!names.length||names.length>100)throw fail('分拆結果為空或超過100份');
     for(let i=0;i<names.length;i++)await output(path.join(out,names[i]),`${input.title}-${i+1}.pdf`);
    }else{
     if(input.action==='rotate')await call('page_rotate',{doc,degrees:input.degrees,...(input.pages.length?{pages:input.pages}:{})});
     if(input.action==='reverse')await call('page_reverse',{doc,...(input.pages.length?{pages:input.pages}:{})});
     if(input.action==='delete')await call('page_delete',{doc,pages:input.pages});
     if(input.action==='reduce'){
      observations.optimization=parse(await call('doc_reduce',{doc,path:target}));
      if(observations.optimization.written===false){await writeFile(target,await readFile(sources[0]));observations.note='沒有更小的結果；輸出保留原內容的副本，未聲稱已壓縮。';}
     }else await call('doc_save',{doc,path:target});
    }
    if(input.action!=='split'){
     const reopened=parse(await call('doc_open',{path:target})),id=reopened.doc??reopened.id??reopened.document?.id;observations.info=parse(await call('doc_info',{doc:id}));observations.text=words(parse(await call('text_extract',{doc:id}))).slice(0,200000);observations.reopened=true;
     if(input.action==='extract'&&observations.info.document?.pages!==input.pages.length)throw fail('抽頁後頁數不一致');
     if(input.action==='delete'&&observations.info.document?.pages!==count-input.pages.length)throw fail('刪頁後頁數不一致');
     if(input.action!=='inspect')await output(target,input.title+'.pdf');
    }
   }
   signal?.throwIfAborted();
   // Validate the whole batch before registering any result; source versions are immutable.
   if(stage.length)outputs.push(...await this.files.createBatch(stage,user,{tool:input.tool,action:input.action,sources:input.snapshots}));
   return {files:outputs,observations,sources:input.snapshots,note:'工具處理及重開核對；版面及業務內容仍需覆核。所有輸出為新檔，原版本不變。'};
  }finally{signal?.removeEventListener('abort',abort);m.close();}
 }
}
