import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('folder-first sorting remains folder-first in either direction and filters locally', async()=>{
 const {sortEntries}=await import('../src/file-explorer.mjs');
 const rows=[{name:'z.txt',bytes:2},{name:'Folder',directory:true},{name:'a.txt',bytes:8}];
 assert.deepEqual(sortEntries(rows,'name','desc').map(x=>x.name),['Folder','z.txt','a.txt']);
 assert.deepEqual(sortEntries(rows,'bytes','asc').map(x=>x.name),['Folder','z.txt','a.txt']);
 assert.deepEqual(sortEntries(rows,'name','asc','TXT').map(x=>x.name),['a.txt','z.txt']);
 assert.equal(rows[0].name,'z.txt');
});
test('exact canonical breadcrumbs and bounded same-source navigation history', async()=>{
 const {canonicalRelative,breadcrumbs,historyMove,historyVisit}=await import('../src/file-explorer.mjs');
 assert.equal(canonicalRelative('A/A/空 白%'),'A/A/空 白%');
 assert.equal(canonicalRelative(''),'');
 assert.equal(canonicalRelative('../escape'),null);
 assert.equal(canonicalRelative('A\\B'),null);
 assert.deepEqual(breadcrumbs('A/A/空 白%'),[{name:'A',relative:'A'},{name:'A',relative:'A/A'},{name:'空 白%',relative:'A/A/空 白%'}]);
 let h={paths:[''],index:0};h=historyVisit(h,'a');h=historyVisit(h,'a/b');
 h=historyMove(h,-1);assert.equal(h.paths[h.index],'a');
 h=historyVisit(h,'c');assert.deepEqual(h.paths,['','a','c']);
 assert.equal(historyMove(h,99).index,2);assert.equal(historyMove(h,-99).index,0);
});
test('browser-only folder storage validates schema, authorization and strict bounds without retaining secrets', async()=>{
 const {readStored,storageKey,folderRecord,previewKind,fileUrl,displayPath}=await import('../src/file-explorer.mjs');
 assert.equal(storageKey({id:'u1',token:'secret'}),'as-explorer-v1:u1');
 assert.equal(storageKey({username:'mary'}),'as-explorer-v1:mary');
 const sources=[{id:'b',label:'B',location:'B:\\公司'}];
 const records=Array.from({length:45},(_,i)=>({sourceId:'b',relative:'A'+i,label:'name',token:'secret'}));
 const parsed=readStored(JSON.stringify({version:1,favorites:[{sourceId:'evil',relative:''},{sourceId:'b',relative:'../x'},...records],recent:records}),sources);
 assert.equal(parsed.favorites.length,30);assert.equal(parsed.recent.length,12);
 assert.doesNotMatch(JSON.stringify(parsed),/secret|token|evil/);
 assert.deepEqual(readStored('{bad',sources),{version:1,favorites:[],recent:[]});
 assert.equal(folderRecord('b','../x'),null);
 assert.equal(previewKind({name:'x.svg'}),'metadata');
 assert.equal(previewKind({name:'x.HTML',ext:'.png'}),'metadata');
 assert.equal(previewKind({name:'x.PDF'}),'pdf');assert.equal(previewKind({name:'x.png'}),'image');
 assert.match(fileUrl('b','空 白/a%.pdf',true),/download=1/);
 assert.equal(displayPath({location:'B:\\公司'},'A/B'),'B:\\公司\\A\\B');
});
test('component wires lazy tree, safe scoped layout, navigation and local persistence controls',async()=>{
 const ui=await source('FileExplorer.jsx');const css=await source('file-explorer.css');
 for(const label of ['檔案庫來源','返回','前進','上一層','重新整理','資料夾樹','公司檔案清單','篩選目前資料夾','收藏目前資料夾','本瀏覽器收藏','最近瀏覽'])assert.ok(ui.includes(label),label);
 for(const cls of ['explorer-breadcrumbs','explorer-tree','explorer-list','explorer-preview'])assert.ok(ui.includes(cls)&&css.includes('.'+cls),cls);
 assert.match(ui,/aria-sort/);assert.match(ui,/aria-hidden/);assert.match(ui,/aria-expanded/);
 assert.match(css,/minmax\(0,\s*1fr\)/);assert.match(css,/clamp\(/);
 assert.match(ui,/invalidate/);assert.match(ui,/isCurrent/);
});
test('storage writes are bound to loaded user and tree expansion reuses view epoch',async()=>{
 const ui=await source('FileExplorer.jsx');
 assert.match(ui,/loadedStorageKey\.current!==key/);
 const expandBody=ui.slice(ui.indexOf('async function expand('),ui.indexOf('function treeNode('));
 assert.match(expandBody,/const ticket=viewTicket\.current/);
 assert.doesNotMatch(expandBody,/generation\.current\.next/);
 assert.match(expandBody,/generation\.current\.isCurrent\(ticket\)/);
});
const source = name => readFile(new URL('../src/'+name, import.meta.url),'utf8');
test('readonly explorer exposes authorized GET browsing and explicit safe preview only', async()=>{
 const ui=await source('FileExplorer.jsx');
 assert.match(ui,/唯讀公司檔案庫/);
 assert.match(ui,/directory\/sources/);
 assert.match(ui,/directory\/browse/);
 assert.doesNotMatch(ui,/dangerouslySetInnerHTML|method:\s*['"]POST|directory\/index|<aside|<nav/);
 assert.match(ui,/ExplorerPdfPreview/);const pdf=await source('ExplorerPdfPreview.jsx');assert.match(pdf,/檔案庫 PDF 預覽/);assert.match(pdf,/isEvalSupported:false/);assert.doesNotMatch(pdf,/https?:\/\//);
});
