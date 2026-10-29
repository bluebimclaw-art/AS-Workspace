import React,{useEffect,useMemo,useRef,useState} from 'react';
import {api,projectUrl} from './client.mjs';
import {formatBytes,createBrowseGeneration} from './directory-browser.mjs';
import {canonicalRelative,breadcrumbs,sortEntries,historyVisit,historyMove,storageKey,readStored,folderRecord,previewKind,fileUrl,displayPath} from './file-explorer.mjs';
import './file-explorer.css';
import ExplorerPdfPreview from './ExplorerPdfPreview.jsx';
import {canReadFile} from './explorer-file-policy.mjs';
const emptyStore=()=>({version:1,favorites:[],recent:[]});
const sameFolder=(a,b)=>a.sourceId===b.sourceId&&a.relative===b.relative;
const stamp=value=>{const d=new Date(value);return value&&Number.isFinite(d.getTime())?d.toLocaleString('zh-TW'):'—';};
const entryType=e=>e.directory?'資料夾':String(e.ext||e.name.split('.').slice(1).pop()||'檔案').replace(/^\./,'').toUpperCase();
export default function FileExplorer({user,onSearch}) {
 const [sources,setSources]=useState([]),[sourceId,setSourceId]=useState(''),[relative,setRelative]=useState('');
 const [history,setHistory]=useState({paths:[''],index:0}),[entries,setEntries]=useState([]),[selected,setSelected]=useState(null);
 const [loading,setLoading]=useState(false),[sourceLoading,setSourceLoading]=useState(true),[error,setError]=useState(''),[sourceError,setSourceError]=useState('');
 const [filter,setFilter]=useState(''),[sort,setSort]=useState({key:'name',direction:'asc'}),[refresh,setRefresh]=useState(0);
 const [expanded,setExpanded]=useState(new Set([''])),[treeStatus,setTreeStatus]=useState({}),[cacheVersion,setCacheVersion]=useState(0);
 const [stored,setStored]=useState(emptyStore),[storageReady,setStorageReady]=useState(false),[notice,setNotice]=useState('');
 const generation=useRef(createBrowseGeneration()),viewTicket=useRef(0),loadedStorageKey=useRef(null),cache=useRef(new Map()),forceReload=useRef(false);
 const key=storageKey(user),source=sources.find(s=>s.id===sourceId);
 const cacheKey=(id,path)=>JSON.stringify([id,path]);
 useEffect(()=>{
  let live=true;loadedStorageKey.current=null;generation.current.invalidate();cache.current.clear();setSources([]);setSourceId('');setRelative('');setSelected(null);setEntries([]);setSourceLoading(true);setSourceError('');setStorageReady(false);setStored(emptyStore());
  api('directory/sources').then(data=>{
   if(!live)return;
   const allowed=(Array.isArray(data.sources)?data.sources:[]).filter(s=>s&&typeof s.id==='string'&&s.id.length<=256&&typeof s.label==='string');
   setSources(allowed);setSourceId(allowed[0]?.id||'');setHistory({paths:[''],index:0});setExpanded(new Set(['']));setTreeStatus({});
   let saved=null;try{saved=localStorage.getItem(key);}catch{setNotice('本瀏覽器無法儲存收藏；仍可唯讀瀏覽。');}
   setStored(readStored(saved,allowed));loadedStorageKey.current=key;setStorageReady(true);
  }).catch(e=>{if(live)setSourceError(e.status===403?'沒有檔案庫存取權限。':e.message||'無法載入檔案庫來源。');}).finally(()=>{if(live)setSourceLoading(false);});
  return ()=>{live=false;generation.current.invalidate();};
 },[key]);
 useEffect(()=>{
  if(!storageReady||loadedStorageKey.current!==key)return;
  try{localStorage.setItem(key,JSON.stringify(stored));}catch{setNotice('本瀏覽器無法儲存收藏；仍可唯讀瀏覽。');}
 },[stored,key,storageReady]);
 function clearNavigation() {
  generation.current.invalidate();setSelected(null);setEntries([]);setFilter('');setError('');setNotice('');setTreeStatus({});
 }
 function navigate(path,id=sourceId) {
  if(canonicalRelative(path)===null||!sources.some(s=>s.id===id))return;
  clearNavigation();
  if(id!==sourceId){setSourceId(id);setHistory({paths:[path],index:0});setExpanded(new Set(['']));}
  else setHistory(h=>historyVisit(h,path));
  setRelative(path);
  // Same-folder links must still resolve a pending request invalidated above.
  setRefresh(n=>n+1);
 }
 function move(delta) {
  const next=historyMove(history,delta);if(next.index===history.index)return;
  clearNavigation();setHistory(next);setRelative(next.paths[next.index]);
 }
 useEffect(()=>{
  const ticket=generation.current.next();viewTicket.current=ticket;const isCurrent=()=>generation.current.isCurrent(ticket);
  if(!sourceId)return ()=>generation.current.invalidate();
  setSelected(null);setLoading(true);setError('');
  const id=sourceId,path=relative,k=cacheKey(id,path),reload=forceReload.current;forceReload.current=false;
  const cached=cache.current.get(k);
  const request=cached&&!reload?Promise.resolve(cached):api('directory/browse?'+new URLSearchParams({sourceId:id,relative:path})).then(data=>{
   if(!Array.isArray(data.entries))throw new Error('檔案清單格式不正確。');
   return data.entries.filter(e=>e&&typeof e.name==='string'&&canonicalRelative(e.relative)!==null&&e.relative!==''&&e.relative.split('/').slice(0,-1).join('/')===path);
  });
  request.then(rows=>{
   if(!isCurrent())return;cache.current.set(k,rows);setCacheVersion(n=>n+1);setEntries(rows);
   if(storageReady){const record=folderRecord(id,path);setStored(s=>({...s,recent:[record,...s.recent.filter(x=>!sameFolder(x,record))].slice(0,12)}));}
  }).catch(e=>{if(!isCurrent())return;setEntries([]);setSelected(null);if(e.status===403){cache.current.clear();setCacheVersion(n=>n+1);setExpanded(new Set(['']));}setError(e.status===403?'沒有此資料夾的存取權限。':e.message||'無法載入資料夾。');})
   .finally(()=>{if(isCurrent())setLoading(false);});
  return ()=>generation.current.invalidate();
 },[sourceId,relative,refresh,storageReady]);
 const visible=useMemo(()=>sortEntries(entries,sort.key,sort.direction,filter),[entries,sort,filter]);
 async function expand(path) {
  if(expanded.has(path)){setExpanded(s=>{const next=new Set(s);next.delete(path);return next;});return;}
  setExpanded(s=>new Set([...s,path]));
  const id=sourceId,k=cacheKey(id,path);if(cache.current.has(k))return;
  const ticket=viewTicket.current;
  // Independent expansions share the view epoch; navigation invalidates them together.
  setTreeStatus(s=>({...s,[path]:{loading:true}}));
  try {
   const data=await api('directory/browse?'+new URLSearchParams({sourceId:id,relative:path}));
   if(!generation.current.isCurrent(ticket))return;
   if(!Array.isArray(data.entries))throw new Error('資料夾清單格式不正確。');
   const rows=data.entries.filter(e=>e&&typeof e.name==='string'&&canonicalRelative(e.relative)!==null&&e.relative!==''&&e.relative.split('/').slice(0,-1).join('/')===path);
   cache.current.set(k,rows);setCacheVersion(n=>n+1);setTreeStatus(s=>({...s,[path]:{}}));
  }catch(e){if(generation.current.isCurrent(ticket)){setTreeStatus(s=>({...s,[path]:{error:e.status===403?'沒有存取權限。':e.message||'無法載入。'}}));if(e.status===403)setSelected(null);}}
 }
 function treeNode(name,path,depth=0) {
  const open=expanded.has(path),rows=cache.current.get(cacheKey(sourceId,path)),status=treeStatus[path]||{};
  const children=rows?.filter(e=>e.directory).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
  return <div className="explorer-tree-node" key={path}>
   <div className="explorer-tree-row">
    <button type="button" className="explorer-expand" aria-label={`${open?'收合':'展開'} ${name}`} aria-expanded={open} disabled={loading||status.loading} onClick={()=>expand(path)}>{open?'▾':'▸'}</button>
    <button type="button" className="explorer-folder" title={name} aria-current={path===relative?'location':undefined} onClick={()=>navigate(path)}><span aria-hidden="true">▱ </span>{name}</button>
   </div>
   {open&&<div className="explorer-tree-children">{status.loading?<p role="status">載入中…</p>:status.error?<p role="alert">{status.error} <button type="button" onClick={()=>{setExpanded(s=>{const n=new Set(s);n.delete(path);return n;});}}>重試展開</button></p>:children?children.length?children.map(e=>treeNode(e.name,e.relative,depth+1)):<p>沒有子資料夾</p>:<p>{loading?'載入中…':'尚未載入；請重新展開'}</p>}</div>}
  </div>;
 }
 const current={sourceId,relative},favorite=stored.favorites.some(f=>sameFolder(f,current));
 function toggleFavorite(){if(!source)return;setStored(s=>({...s,favorites:favorite?s.favorites.filter(f=>!sameFolder(f,current)):[current,...s.favorites].slice(0,30)}));}
 function reload(){forceReload.current=true;cache.current.delete(cacheKey(sourceId,relative));clearNavigation();setRefresh(n=>n+1);}
 const folderLinks=(items)=>items.filter(x=>sources.some(s=>s.id===x.sourceId)).map(x=>{const s=sources.find(s=>s.id===x.sourceId);return <button type="button" className="explorer-saved-folder" key={cacheKey(x.sourceId,x.relative)} title={`${s.label} / ${x.relative}`} onClick={()=>navigate(x.relative,x.sourceId)}>{s.label}{x.relative?' / '+x.relative:''}</button>;});
 const selectedKind=previewKind(selected),canReadSelected=canReadFile(selected);
 return <section className="file-explorer" aria-label="唯讀公司檔案庫">
  <div className="explorer-heading"><div><h2>公司檔案庫</h2><p>直接唯讀瀏覽授權來源，不建立索引、不執行 AI、不修改原檔。</p></div><span className="explorer-badge">唯讀</span></div>
  <div className="explorer-toolbar">
   <select aria-label="檔案庫來源" value={sourceId} disabled={sourceLoading||!sources.length} onChange={e=>navigate('',e.target.value)}>{!sources.length&&<option value="">{sourceLoading?'載入來源中…':'無可用來源'}</option>}{sources.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select>
   <button type="button" onClick={()=>move(-1)} disabled={!history.index}>返回</button><button type="button" onClick={()=>move(1)} disabled={history.index>=history.paths.length-1}>前進</button>
   <button type="button" disabled={!relative} onClick={()=>navigate(relative.split('/').slice(0,-1).join('/'))}>上一層</button><button type="button" disabled={!source} onClick={reload}>重新整理</button>
   <button type="button" aria-pressed={favorite} disabled={!source} onClick={toggleFavorite}><span aria-hidden="true">{favorite?'★':'☆'} </span>收藏目前資料夾</button>
  </div>
  <div className="explorer-breadcrumbs" aria-label="目前資料夾路徑">{source&&<><button type="button" onClick={()=>navigate('')}>{source.label}</button>{breadcrumbs(relative).map(b=><React.Fragment key={b.relative}><span aria-hidden="true">/</span><button type="button" aria-current={b.relative===relative?'location':undefined} onClick={()=>navigate(b.relative)}>{b.name}</button></React.Fragment>)}</>}</div>
  {sourceError&&<p className="explorer-error" role="alert">{sourceError}</p>}
  {!sourceLoading&&!sourceError&&!sources.length&&<p role="status">目前沒有授權的檔案庫來源。請聯絡管理員；此介面不能新增來源。</p>}
  <div className="explorer-layout">
   <div className="explorer-sidebar"><div className="explorer-tree" role="group" aria-label="資料夾樹"><h3>資料夾</h3>{source?treeNode(source.label,''):<p>請選擇授權來源。</p>}</div>
    <div className="explorer-saved"><h3>本瀏覽器收藏</h3>{stored.favorites.length?folderLinks(stored.favorites):<p>尚未收藏資料夾</p>}<h3>最近瀏覽</h3>{stored.recent.length?folderLinks(stored.recent):<p>尚無瀏覽紀錄</p>}<p className="explorer-hint">只儲存在本瀏覽器，不跨電腦同步。</p></div>
   </div>
   <div className={`explorer-content${selected?' explorer-has-preview':''}`}>
    <div className="explorer-files"><input aria-label="篩選目前資料夾" placeholder="依檔名篩選目前資料夾…" value={filter} onChange={e=>setFilter(e.target.value)}/>
     <p className="explorer-count" role="status">{loading?'正在讀取目前資料夾…':`${visible.length} / ${entries.length} 個項目・${entries.filter(e=>!e.directory).length} 個檔案`}<span>{entries.length>=1000?'每層最多顯示 1,000 項，超出部分未列出。':'只載入目前層級中繼資料，不掃描子資料夾。'}</span></p>
     {error&&<p className="explorer-error" role="alert">{error} <button type="button" onClick={reload}>重試</button></p>}
     <div className="explorer-list" aria-busy={loading}>
      <table aria-label="公司檔案清單"><thead><tr>{[['name','名稱'],['ext','類型'],['bytes','大小'],['modifiedAt','修改時間']].map(([column,label])=><th key={column} className={column==='name'?'':'explorer-meta-column'} scope="col" aria-sort={sort.key===column?(sort.direction==='asc'?'ascending':'descending'):'none'}><button type="button" onClick={()=>setSort(s=>({key:column,direction:s.key===column&&s.direction==='asc'?'desc':'asc'}))}>{label}<span aria-hidden="true">{sort.key===column?(sort.direction==='asc'?' ↑':' ↓'):''}</span></button></th>)}</tr></thead>
      <tbody>{!loading&&visible.map(e=><tr key={e.relative} className={selected?.relative===e.relative?'explorer-selected':''}><td><button type="button" className="explorer-entry" title={e.name} onClick={()=>{setNotice('');e.directory?navigate(e.relative):setSelected(e);}}><span aria-hidden="true">{e.directory?'▱':'▤'} </span>{e.name}</button></td><td className="explorer-meta-column">{entryType(e)}</td><td className="explorer-meta-column">{formatBytes(e.bytes,e.directory)}</td><td className="explorer-meta-column">{stamp(e.modifiedAt)}</td></tr>)}</tbody></table>
      {loading?<p className="explorer-empty" role="status">載入檔案清單中…</p>:!error&&!visible.length&&<p className="explorer-empty">{filter?'沒有符合篩選條件的項目。':'此資料夾沒有項目。'}</p>}
     </div>
     {!selected&&<p className="explorer-hint">選擇資料夾以瀏覽，或選擇檔案查看資訊及唯讀預覽。PDF 與安全圖片可預覽；其他格式僅提供下載。</p>}
    </div>
    {selected&&source&&<div className="explorer-preview" aria-label="檔案預覽與資訊"><div className="explorer-preview-heading"><h3 title={selected.name}>{selected.name}</h3><button type="button" aria-label="關閉預覽" onClick={()=>setSelected(null)}>×</button></div>
     {!canReadSelected?<p className="explorer-empty">此檔案超過目前 32 MiB 預覽／下載上限，或大小尚未確認。可複製原路徑，用本機程式開啟；此介面不會自動啟動程式。</p>:selectedKind==='pdf'?<ExplorerPdfPreview url={projectUrl(fileUrl(sourceId,selected.relative))}/>:selectedKind==='image'?<img src={projectUrl(fileUrl(sourceId,selected.relative))} alt={selected.name} onError={()=>setNotice('無法預覽圖片，請下載原檔。')}/>:<p className="explorer-empty">此格式不提供內嵌預覽；可查看中繼資料或下載原檔，不會啟動本機程式。</p>}
     <dl><dt>路徑</dt><dd>{displayPath(source,selected.relative)}</dd><dt>類型</dt><dd>{entryType(selected)}</dd><dt>大小</dt><dd>{formatBytes(selected.bytes)}</dd><dt>修改時間</dt><dd>{stamp(selected.modifiedAt)}</dd></dl>
     <div className="explorer-actions"><button type="button" onClick={async()=>{try{await navigator.clipboard.writeText(displayPath(source,selected.relative));setNotice('已複製檔案路徑。');}catch{setNotice('無法複製；請選取上方路徑。');}}}>複製路徑</button>{canReadSelected&&<><a href={projectUrl(fileUrl(sourceId,selected.relative,true))} download>下載</a><a href={projectUrl(fileUrl(sourceId,selected.relative,selectedKind==='metadata'))} target="_blank" rel="noopener noreferrer">原檔（唯讀）</a></>}</div>
    </div>}
   </div>
  </div><p className="explorer-notice" role="status">{notice}</p>
 </section>;
}
