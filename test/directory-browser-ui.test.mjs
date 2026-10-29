import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=()=>readFile(new URL('../src/SearchCenter.jsx',import.meta.url),'utf8');
const styles=()=>readFile(new URL('../src/workbench.css',import.meta.url),'utf8');

test('browse effect guards success error and completion and exposes loading/error/empty states',async()=>{
  const jsx=await source();
  assert.match(jsx,/browseGeneration=useRef\(createBrowseGeneration\(\)\)/);
  assert.match(jsx,/const generation=guard.next\(\)/);
  assert.match(jsx,/return\(\)=>guard.invalidate\(\)/);
  assert.ok((jsx.match(/guard.isCurrent\(generation\)/g)||[]).length>=3);
  assert.match(jsx,/aria-busy=\{browseLoading\}/);
  assert.match(jsx,/載入資料夾中/);
  assert.match(jsx,/role="alert"[^>]*>\{browseError\}/);
  assert.match(jsx,/setFolderFilter\(''\)/);
  const effect=jsx.slice(jsx.indexOf('const generation=guard.next()'),jsx.indexOf('[sourceId,relative,ext]'));
  assert.match(effect,/directory\/browse\?/);
  assert.doesNotMatch(effect,/directory\/index|directory\/search/);
});

test('browser markup has accessible compact table, local filter and exact breadcrumb buttons, not sidebar/nav', async()=>{
  const jsx=await source();
  assert.match(jsx,/className="directory-browser"/);
  assert.match(jsx,/className="directory-list"/);
  assert.match(jsx,/<table className="directory-table" aria-label="目前資料夾檔案"/);
  assert.match(jsx,/aria-label="篩選目前資料夾"/);
  assert.match(jsx,/className="directory-breadcrumbs"/);
  assert.match(jsx,/folderBreadcrumbs\(relative\)/);
  assert.match(jsx,/setRelative\(crumb.relative\)/);
  assert.match(jsx,/setRelative\(''\)/);
  assert.match(jsx,/title=\{e.name\}/);
  assert.match(jsx,/visibleEntries\(entries,folderFilter\)/);
  assert.match(jsx,/hits.length>0&&<div className="directory-results"/);
  assert.doesNotMatch(jsx,/<aside\b|<nav\b/);
  const css=await styles();
  assert.match(css,/\.directory-search \.directory-list\s*\{[^}]*max-height:[^}]*overflow:auto/s);
  assert.match(css,/\.directory-search \.directory-table\s*\{[^}]*table-layout:fixed/s);
  assert.match(css,/\.directory-search \.directory-name\s*\{[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/s);
  assert.doesNotMatch(css,/\.directory-columns aside/);
});
