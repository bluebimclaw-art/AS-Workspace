import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readFile,writeFile,mkdir,readdir,copyFile,realpath} from 'node:fs/promises';
import {randomUUID,createHash} from 'node:crypto';
import {CraftMcp,resultText} from './craft-mcp.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const toolIds=['pdfcraft','wordcraft','gridcraft','deckcraft'];
const hash=b=>createHash('sha256').update(b).digest('hex');
const bad=message=>Object.assign(new Error(message),{status:400});
function json(r){const t=resultText(r);try{return JSON.parse(t);}catch{return {text:t};}}
function strings(v){return typeof v==='string'?v:Array.isArray(v)?v.map(strings).join('\n'):v&&typeof v==='object'?Object.values(v).map(strings).join('\n'):'';}
async function findCli(dir,name,depth=0){if(depth>3)return;let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch{return;}for(const e of entries){if(e.isFile()&&e.name===name)return path.join(dir,e.name);}for(const e of entries){if(e.isDirectory()){const p=await findCli(path.join(dir,e.name),name,depth+1);if(p)return p;}}}
export async function officeConfig(){
  let config={};try{config=JSON.parse(await readFile(process.env.POC_OFFICE_FILE||path.join(root,'config/office.local.json'),'utf8'));}catch(e){if(e.code!=='ENOENT')throw new Error('Office 設定檔無法讀取');}
  const result={};for(const id of toolIds){const c=config.tools?.[id]||{},envName=`POC_${id.toUpperCase()}_CLI`,name=id+'-cli'+(process.platform==='win32'?'.exe':'');
    let command=process.env[envName]||c.command||await findCli(path.join(root,'tools',id),name)||name;
    if(command.includes('/')||command.includes('\\'))command=path.resolve(root,command);
    result[id]={command,enabled:c.enabled!==false,experimental:false,timeoutMs:Math.max(1000,Math.min(Number(c.timeoutMs)||120000,600000))};
  }return result;
}
export class Office {
  constructor(store,{config=officeConfig}={}){this.store=store;this.config=config;this.active=false;}
  async init(){await mkdir(path.join(this.store.root,'office'),{recursive:true});await this.store.mutate(db=>{db.officeJobs??=[];db.officeFiles??=[];for(const j of db.officeJobs)if(j.status==='running'){j.status='interrupted';j.error='平台重啟，未自動重送';}});return this;}
  async session(id,dir){const c=(await this.config())[id];if(!c||!c.enabled)throw bad('工具未啟用');const args=id==='pdfcraft'?['mcp','--root',dir]:id==='gridcraft'?['mcp']:['mcp','--automation-read-root',dir,'--automation-write-root',dir];
    const m=new CraftMcp(c.command,args,{cwd:dir,timeoutMs:c.timeoutMs});try{const tools=await m.init();return {m,tools};}catch(e){m.close();throw e;}}
  async health(){const result=[];for(const id of toolIds){let m;const dir=path.join(this.store.root,'office','health',id);await mkdir(dir,{recursive:true});try{const s=await this.session(id,dir);m=s.m;result.push({id,available:true,experimental:false,toolCount:s.tools.tools.length,tools:s.tools.tools.map(t=>t.name)});}catch(e){result.push({id,available:false,experimental:false,error:e.message});}finally{m?.close();}}return result;}
  file(id){const f=this.store.db.officeFiles.find(f=>f.id===id);if(!f)throw Object.assign(new Error('找不到 Office 檔案'),{status:404});return f;}
  async filePath(f){const base=await realpath(path.join(this.store.root,'office')),target=await realpath(path.resolve(this.store.root,f.storagePath.replaceAll('\\','/')));if(!target.startsWith(base+path.sep))throw bad('Office 路徑不允許');return target;}
  async register(file,{name,tool,jobId,sources=[],text='',input=false,metadata={}}){const bytes=await readFile(file);if(!bytes.length||bytes.length>40_000_000)throw new Error('輸出檔案為空或超過40MB');const record={id:randomUUID(),name,tool,jobId,sources,text:text.slice(0,200000),input,metadata,storagePath:path.relative(this.store.root,file).split(path.sep).join('/'),sha256:hash(bytes),bytes:bytes.length,createdAt:new Date().toISOString()};return record;}
  async importPdf({name,base64,sourceIds=[]}){
    if(typeof name!=='string'||!name.toLowerCase().endsWith('.pdf')||typeof base64!=='string'||!base64||base64.length>6_000_000||!Array.isArray(sourceIds)||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw bad('只接受最多約4MB的 PDF');
    sourceIds.forEach(id=>this.store.asset(id));const bytes=Buffer.from(base64,'base64');if(!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw bad('不是 PDF 檔案');
    const dir=path.join(this.store.root,'office',randomUUID());await mkdir(dir,{recursive:true});const file=path.join(dir,'input.pdf');await writeFile(file,bytes);
    const f=await this.register(file,{name:path.basename(name),tool:'pdfcraft',input:true,sources:sourceIds.map(assetId=>({assetId,version:this.store.asset(assetId).version})),metadata:{textStatus:'待分析；未執行OCR'}});await this.store.mutate(db=>db.officeFiles.push(f));return f;
  }
  async run(body){
    if(this.active)throw Object.assign(new Error('Office 任務執行中，請完成後再提交'),{status:409});
    const {tool,action,title='公司文件',sourceIds=[],fileIds=[],text='',tsv='',experimental=false}=body;
    const allowed={wordcraft:['create'],gridcraft:['create'],deckcraft:['create'],pdfcraft:['inspect','merge','extract']};
    if(!allowed[tool]?.includes(action)||!Array.isArray(sourceIds)||!Array.isArray(fileIds)||fileIds.length>10||typeof title!=='string'||!title.trim()||title.length>200||typeof text!=='string'||text.length>30000||typeof tsv!=='string'||tsv.length>50000)throw bad('Office 任務格式不正確');
    if(tool==='deckcraft'&&experimental!==true)throw bad('請確認使用試驗簡報功能');
    const assets=sourceIds.map(id=>this.store.asset(id));const inputs=fileIds.map(id=>this.file(id));
    if(tool==='pdfcraft'&&(!inputs.length||inputs.some(f=>!f.name.toLowerCase().endsWith('.pdf'))||(action==='merge'&&inputs.length<2)))throw bad('請選取所需 PDF（合併至少兩份）');
    let values;if(tool==='gridcraft'){values=tsv.trim().split(/\r?\n/).map(l=>l.split('\t'));if(!tsv.trim()||values.length>200||values.some(r=>r.length>30))throw bad('請提供 TSV，最多200列、30欄');}
    if(tool==='pdfcraft'&&action==='extract'&&(!Array.isArray(body.pages)||!body.pages.length||body.pages.length>100||body.pages.some(n=>!Number.isInteger(n)||n<1||n>10000)))throw bad('頁碼必須是正整數，最多100頁');
    const sources=[...new Map([...assets.map(a=>({assetId:a.id,version:a.version})),...inputs.flatMap(f=>f.sources)].map(s=>[s.assetId,s])).values()];
    const job={id:randomUUID(),tool,action,title,sources,inputFileIds:fileIds,status:'running',createdAt:new Date().toISOString(),validation:'未驗證'};
    const dir=path.join(this.store.root,'office',job.id);this.active=true;let m;
    try{
      await mkdir(dir,{recursive:true});await this.store.mutate(db=>db.officeJobs.push(job));
      const session=await this.session(tool,dir);m=session.m;const outputs=[];
      const call=async(name,args)=>{if(!session.tools.tools.some(t=>t.name===name))throw new Error('工具版本缺少必要能力：'+name);return m.call(name,args);};
      const output=async(filename,searchText,metadata={})=>{const f=await this.register(path.join(dir,filename),{name:filename,tool,jobId:job.id,sources,text:searchText,metadata});outputs.push(f);};
      const content=[title,text||assets.map(a=>`${a.name}\n${a.text}`).join('\n\n')].filter(Boolean).join('\n\n');
      if(content.length>100000||(tool==='deckcraft'&&content.length>800))throw bad(tool==='deckcraft'?'試驗簡報限制800字元，請先精簡內容':'文件內容超過100,000字元');
      if(tool==='wordcraft'){
        await call('new_document',{});await call('type_text',{text:content,paragraphs:true});
        for(const ext of ['docx','pdf'])await call('save_document',{path:path.join(dir,'document.'+ext)});
        await call('open_document',{path:path.join(dir,'document.docx')});const verified=strings(json(await call('get_text',{})));
        if(!content.split(/\n+/).filter(Boolean).every(line=>verified.includes(line)))throw new Error('DOCX 重開內容不完整');
        await output('document.docx',verified,{reopened:true});await output('document.pdf',verified,{textOrigin:'DOCX 重開讀取；PDF 版面待覆核'});
      } else if(tool==='gridcraft'){
        await call('new_workbook',{});await call('write_range',{range:'A1',values});await call('save_workbook',{path:path.join(dir,'workbook.xlsx')});await call('open_workbook',{path:path.join(dir,'workbook.xlsx')});
        const read=json(await call('read_range',{}));await writeFile(path.join(dir,'readback.json'),JSON.stringify(read,null,2));
        if(!JSON.stringify(read).includes(values[0][0]))throw new Error('XLSX 重開未找到首個儲存格');
        await output('workbook.xlsx',JSON.stringify(read),{reopened:true});await output('readback.json',JSON.stringify(read));
      } else if(tool==='deckcraft'){
        await call('new_presentation',{blank:true});await call('run_command',{command:'slide.new',params:{layout:'titleAndContent',title,body:content.slice(title.length).trim()}});
        await call('save_presentation',{path:path.join(dir,'presentation.pptx')});await call('open_presentation',{path:path.join(dir,'presentation.pptx')});
        const deck=json(await call('inspect_document',{})),slide=json(await call('inspect_slide',{index:0})),inspected=JSON.stringify({deck,slide},null,2),slideText=strings(slide);await writeFile(path.join(dir,'readback.json'),inspected);
        if(deck.slides?.length!==1||!content.split(/\n+/).filter(Boolean).every(line=>slideText.includes(line)))throw new Error('PPTX 重開頁數或內容不完整');
        await output('presentation.pptx',slideText,{reopened:true,experimental:true});await output('readback.json',inspected);
        const rendered=await call('render_slide',{slide:0,scale:1}),image=rendered.content?.find(c=>c.type==='image'&&c.mimeType==='image/png');if(image){await writeFile(path.join(dir,'preview.png'),Buffer.from(image.data,'base64'));await output('preview.png','');}
      } else {
        const paths=[];for(let i=0;i<inputs.length;i++){const p=path.join(dir,`input-${i}.pdf`),source=await this.filePath(inputs[i]);if(hash(await readFile(source))!==inputs[i].sha256)throw new Error('來源 PDF 已被外部修改；雜湊不一致');await copyFile(source,p);paths.push(p);}
        let opened=json(await call('doc_open',{path:paths[0]}));let doc=opened.doc??opened.id??opened.document?.id;
        if(!Number.isInteger(doc))throw new Error('無法辨識 PdfCraft document ID');
        if(action==='merge'){await call('doc_combine',{paths,out:path.join(dir,'result.pdf')});}
        else if(action==='extract'){await call('page_extract',{doc,pages:body.pages,out:path.join(dir,'result.pdf')});}
        else await call('doc_save',{doc,path:path.join(dir,'result.pdf')});
        opened=json(await call('doc_open',{path:path.join(dir,'result.pdf')}));doc=opened.doc??opened.id??opened.document?.id;
        const info=json(await call('doc_info',{doc})),extracted=strings(json(await call('text_extract',{doc})));
        const report={info,text:extracted,textStatus:'文字層抽取；未執行OCR'};await writeFile(path.join(dir,'analysis.json'),JSON.stringify(report,null,2));
        await output('result.pdf',extracted,{reopened:true,textStatus:report.textStatus});await output('analysis.json',JSON.stringify(report));
        const render=await call('page_render',{doc,page:1,dpi:72});const img=render.content?.find(c=>c.type==='image'&&c.mimeType==='image/png');if(img){await writeFile(path.join(dir,'preview.png'),Buffer.from(img.data,'base64'));await output('preview.png','');}
      }
      await this.store.mutate(db=>{db.officeFiles.push(...outputs);Object.assign(job,{status:'succeeded',outputFileIds:outputs.map(f=>f.id),validation:'工具輸出及重開檢查通過；版面及業務內容待覆核',finishedAt:new Date().toISOString()});});return {job,files:outputs};
    }catch(e){await this.store.mutate(()=>Object.assign(job,{status:'failed',error:e.message,finishedAt:new Date().toISOString()}));throw Object.assign(e,{jobId:job.id});}
    finally{m?.close();this.active=false;}
  }
}
