import {mkdir,writeFile,readFile,realpath} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import JSZip from 'jszip';
import {resultText} from './craft-mcp.mjs';
const bad=(message,status=400)=>Object.assign(new Error(message),{status});
export class ProjectFiles {
 constructor(store,office){this.store=store;this.office=office;this.busy=false;}
 async init(){await mkdir(path.join(this.store.root,'project-files'),{recursive:true});await this.store.mutate(db=>{db.projectFiles??=[];db.chats??=[];for(const chat of db.chats)for(const turn of chat.messages)if(turn.status==='running'){turn.status='interrupted';turn.error='平台重啟；未自動重送';}for(const f of db.projectFiles)if(f.index?.status==='processing')f.index={status:'failed',error:'平台重啟；請重新索引'};});return this;}
 file(id){const f=this.store.db.projectFiles.find(f=>f.id===id);if(!f)throw bad('找不到項目檔案',404);return f;}
 version(id,version){const f=this.file(id),v=f.versions.find(v=>v.version===(version??f.version));if(!v)throw bad('找不到檔案版本',404);return v;}
 async bytes(id,version){const v=this.version(id,version),base=await realpath(path.join(this.store.root,'project-files')),file=await realpath(path.join(this.store.root,v.storagePath));if(!file.startsWith(base+path.sep))throw bad('檔案路徑不允許');const b=await readFile(file);if(createHash('sha256').update(b).digest('hex')!==v.sha256)throw bad('檔案雜湊不一致',409);return b;}
 async validate({id,name,base64,expectedVersion}){
  if(typeof name!=='string'||!name.trim()||name.length>180||/[\\/\x00-\x1f]/.test(name)||typeof base64!=='string'||!base64||base64.length>7_000_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw bad('檔案名稱或內容不正確；上限5MB');
  const ext=path.extname(name).toLowerCase();if(!['.xlsx','.pdf','.txt','.md','.docx','.pptx','.deckcraft','.odt','.rtf','.html','.htm','.tex','.png','.jpg','.jpeg','.webp','.doc','.dotx'].includes(ext))throw bad('此共用檔案格式尚未支援');
  if(id){const current=this.file(id);if(expectedVersion!==current.version)throw bad('檔案版本已改變；請保留目前內容並重開最新版本',409);if(path.extname(current.name).toLowerCase()!==ext)throw bad('另存不同格式請建立新檔');}
  const bytes=Buffer.from(base64,'base64');if(bytes.length>5_000_000)throw bad('檔案超過5MB');
  if(ext==='.pdf'&&!bytes.subarray(0,5).equals(Buffer.from('%PDF-')))throw bad('不是 PDF');
  if(['.xlsx','.docx','.pptx','.deckcraft','.odt','.dotx'].includes(ext)){
   const zip=await JSZip.loadAsync(bytes);const entries=Object.values(zip.files);if(entries.length>5000||entries.reduce((n,e)=>n+(e._data?.uncompressedSize||0),0)>50_000_000)throw bad('Office 檔案解壓後超出限制');
   if(!zip.file({'.xlsx':'xl/workbook.xml','.docx':'word/document.xml','.dotx':'word/document.xml','.pptx':'ppt/presentation.xml','.deckcraft':'presentation.json','.odt':'content.xml'}[ext]))throw bad('Office 檔案結構不正確');
   if(ext==='.deckcraft'){const doc=JSON.parse(await zip.file('presentation.json').async('string'));if(doc.format!=='deckcraft'||doc.version!==1||!Array.isArray(doc.presentation?.slides))throw bad('DeckCraft 格式不正確');}
  }
  if(ext==='.png'&&!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))throw bad('不是 PNG');
  if(['.jpg','.jpeg'].includes(ext)&&!(bytes[0]===255&&bytes[1]===216&&bytes[2]===255))throw bad('不是JPEG');
  if(ext==='.webp'&&!(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP'))throw bad('不是WebP');
  if(ext==='.doc'&&!bytes.subarray(0,8).equals(Buffer.from([208,207,17,224,161,177,26,225])))throw bad('不是舊版 DOC');
  if(ext==='.rtf'&&!bytes.subarray(0,5).equals(Buffer.from('{\\rtf')))throw bad('不是 RTF');
  return {ext,bytes};
 }
 async save(body,actor){
  const {id,name,expectedVersion,originOfficeFileId,leaseToken}=body,{ext,bytes}=await this.validate(body);
  return this.store.mutate(async db=>{
   let f=id?this.file(id):null;if(f&&f.version!==expectedVersion)throw bad('檔案版本衝突',409);
   if(f&&actor)this.leases.check(f.id,actor,leaseToken);
   const version=(f?.version||0)+1,fileId=f?.id||randomUUID(),rel=`project-files/${fileId}/${version}${ext}`;
   await mkdir(path.join(this.store.root,'project-files',fileId),{recursive:true});await writeFile(path.join(this.store.root,rel),bytes,{flag:'wx'});
   const v={version,storagePath:rel,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,createdAt:new Date().toISOString(),createdBy:actor?.id};
   if(!f){f={id:fileId,name,version,versions:[],originOfficeFileId};db.projectFiles.push(f);}
   f.name=name;f.version=version;f.versions.push(v);f.updatedAt=v.createdAt;f.updatedBy=actor?.name;f.text=['.txt','.md'].includes(ext)?bytes.toString('utf8').slice(0,200000):'';
   f.index={status:f.text?'ready':'pending',parser:f.text?'utf8':null,version};return structuredClone(f);
  });
 }
 async createBatch(items,actor,derivation){
  if(!Array.isArray(items)||!items.length||items.length>100||items.some(x=>x.id))throw bad('新檔批次格式不正確');
  const checked=await Promise.all(items.map(x=>this.validate(x))),records=[];derivation={...derivation,batchId:randomUUID()};
  // All content is staged before one metadata commit; no partially visible split batch.
  for(let i=0;i<items.length;i++){
   const {name}=items[i],{ext,bytes}=checked[i],id=randomUUID(),createdAt=new Date().toISOString(),storagePath=`project-files/${id}/1${ext}`;
   await mkdir(path.join(this.store.root,'project-files',id),{recursive:true});await writeFile(path.join(this.store.root,storagePath),bytes,{flag:'wx'});
   records.push({id,name,version:1,versions:[{version:1,storagePath,sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,createdAt,createdBy:actor?.id}],updatedAt:createdAt,updatedBy:actor?.name,derivation,text:['.txt','.md'].includes(ext)?bytes.toString('utf8').slice(0,200000):'',index:{status:'pending',version:1}});
  }
  return this.store.mutate(db=>{db.projectFiles.push(...records);return structuredClone(records);});
 }
 async promote(officeId){const prior=this.store.db.projectFiles.find(f=>f.originOfficeFileId===officeId);if(prior)return prior;const f=this.office.file(officeId);return this.save({name:f.name,base64:(await readFile(await this.office.filePath(f))).toString('base64'),originOfficeFileId:officeId});}
 async indexWorkbook(id){
  if(this.busy)throw bad('試算表讀取進行中；稍後再試',409);const f=this.file(id);if(!f.name.toLowerCase().endsWith('.xlsx'))throw bad('只接受 XLSX');
  const version=f.version;this.busy=true;let m;
  try{
   await this.store.mutate(()=>{f.index={status:'processing',parser:'gridcraft-mcp',version};});
   const dir=path.join(this.store.root,'office','grid-read',randomUUID());await mkdir(dir,{recursive:true});const target=path.join(dir,'snapshot.xlsx');await writeFile(target,await this.bytes(id,version));
   const session=await this.office.session('gridcraft',dir);m=session.m;await m.call('open_workbook',{path:target});
   const inspect=JSON.parse(resultText(await m.call('inspect_workbook',{})));const sheets=inspect.sheets||inspect.workbook?.sheets||[];
   const chunks=[];let remaining=200000;for(const s of sheets.slice(0,12)){
    const sheet=s.name||s.title;if(!sheet)continue;
    const values=JSON.parse(resultText(await m.call('read_range',{sheet,range:'A1:AD200'}))).values;
    const formulas=JSON.parse(resultText(await m.call('read_range',{sheet,range:'A1:AD200',formulas:true}))).values;
    const col=n=>n<26?String.fromCharCode(65+n):'A'+String.fromCharCode(65+n-26);
    const lines=[];for(let row=0;row<(values?.length||0);row++)for(let column=0;column<values[row].length;column++){
     const value=values[row][column],formula=formulas?.[row]?.[column];if(value===null&&formula===null)continue;
     lines.push(`${sheet}!${col(column)}${row+1}: ${JSON.stringify(value)}${typeof formula==='string'&&formula.startsWith('=')?'；公式 '+formula:''}`);
    }
    const text=lines.join('\n').slice(0,remaining);remaining-=text.length;if(text)chunks.push({sheet,text});if(!remaining)break;
   }
   if(!chunks.length)chunks.push({sheet:'active',text:resultText(await m.call('read_range',{range:'A1:AD200'}))});
   await this.store.mutate(()=>{if(f.version!==version)throw bad('索引期間檔案已變更，請重新讀取',409);f.text=chunks.map(c=>c.text).join('\n').slice(0,200000);f.chunks=chunks;f.index={status:'partial',parser:'gridcraft-mcp',version,scope:'最多12張工作表，每張 A1:AD200，文字最多200,000字元；未讀範圍不會被搜尋或交給AI'};});return f;
  }catch(e){await this.store.mutate(()=>{if(f.version===version)f.index={status:'failed',parser:'gridcraft-mcp',version,error:e.message};});throw e;}finally{m?.close();this.busy=false;}
 }
}
