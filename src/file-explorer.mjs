export function canonicalRelative(value) {
 if(typeof value!=='string'||value.length>4096||/[\\\\\x00-\x1f]/.test(value))return null;
 if(value==='')return '';
 return value.split('/').some(s=>!s||s==='.'||s==='..')?null:value;
}
export function breadcrumbs(relative) {
 if(canonicalRelative(relative)===null||!relative)return [];
 return relative.split('/').map((name,i,parts)=>({name,relative:parts.slice(0,i+1).join('/')}));
}
export function historyVisit(history,relative) {
 if(canonicalRelative(relative)===null||history.paths[history.index]===relative)return history;
 const paths=[...history.paths.slice(0,history.index+1),relative].slice(-100);
 return {paths,index:paths.length-1};
}
export function historyMove(history,delta) {return {...history,index:Math.max(0,Math.min(history.paths.length-1,history.index+delta))};}
export function storageKey(user) {return `as-explorer-v1:${String(user?.id||user?.username||'anonymous').slice(0,200)}`;}
export function folderRecord(sourceId,relative) {
 return typeof sourceId==='string'&&sourceId.length>0&&sourceId.length<=256&&canonicalRelative(relative)!==null?{sourceId,relative}:null;
}
export function readStored(raw,sources) {
 const empty={version:1,favorites:[],recent:[]};
 try {
  if(typeof raw!=='string'||raw.length>250000)return empty;
  const data=JSON.parse(raw);if(data?.version!==1)return empty;
  const allowed=new Set(sources.map(s=>s.id));
  const clean=(items,max)=>{
   if(!Array.isArray(items))return [];const seen=new Set();const result=[];
   for(const item of items.slice(0,500)) {
    const record=folderRecord(item?.sourceId,item?.relative);if(!record||!allowed.has(record.sourceId))continue;
    const key=JSON.stringify(record);if(seen.has(key))continue;seen.add(key);result.push(record);if(result.length===max)break;
   }return result;
  };
  return {version:1,favorites:clean(data.favorites,30),recent:clean(data.recent,12)};
 }catch{return empty;}
}
export function previewKind(entry) {
 const extension=String(entry?.name||'').split('.').pop().toLowerCase();
 return extension==='pdf'?'pdf':['png','jpg','jpeg','gif','webp','bmp','avif'].includes(extension)?'image':'metadata';
}
export function fileUrl(sourceId,relative,download=false) {return '/api/directory/file?'+new URLSearchParams({sourceId,relative,...(download?{download:'1'}:{})});}
export function displayPath(source,relative) {
 const location=String(source?.location||'').replace(/[\\\\/]+$/,'');const separator=location.includes('\\')?'\\':'/';
 return location+(relative?separator+relative.split('/').join(separator):'');
}
const collator=new Intl.Collator('zh-Hant',{numeric:true,sensitivity:'base'});
export function sortEntries(entries,key='name',direction='asc',filter='') {
 const query=filter.trim().toLocaleLowerCase();
 return entries.filter(e=>e.name.toLocaleLowerCase().includes(query)).sort((a,b)=>{
  const folders=Number(!!b.directory)-Number(!!a.directory); if(folders)return folders;
  const value=e=>key==='bytes'?Number(e.bytes)||0:key==='modifiedAt'?Date.parse(e.modifiedAt)||0:key==='ext'?(e.directory?'資料夾':e.ext||''):e.name;
  const av=value(a),bv=value(b); const cmp=typeof av==='number'?av-bv:collator.compare(av,bv);
  return (direction==='desc'?-1:1)*(cmp||collator.compare(a.name,b.name));
 });
}
