import test from 'node:test';
import assert from 'node:assert/strict';

const helpers = () => import('../src/directory-browser.mjs');

test('browse generation rejects late responses and invalidates on cleanup', async () => {
  const {createBrowseGeneration} = await helpers();
  const requests=createBrowseGeneration();
  const first=requests.next(), second=requests.next();
  assert.equal(requests.isCurrent(first), false);
  assert.equal(requests.isCurrent(second), true);
  requests.invalidate();
  assert.equal(requests.isCurrent(second), false);
  assert.equal(requests.isCurrent(requests.next()), true);
});

test('size formatting distinguishes empty files, unknown values and folder sizes', async () => {
  const {formatBytes} = await helpers();
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(1048576), '1 MB');
  for (const value of [undefined,null,-1,NaN]) assert.equal(formatBytes(value), '—');
  assert.equal(formatBytes(1024,true), '—');
});

test('breadcrumbs preserve exact repeated, Unicode and percent-containing segments', async () => {
  const {folderBreadcrumbs} = await helpers();
  assert.deepEqual(folderBreadcrumbs(''), []);
  assert.deepEqual(folderBreadcrumbs('同名/同名/100% #資料'), [
    {name:'同名',relative:'同名'},
    {name:'同名',relative:'同名/同名'},
    {name:'100% #資料',relative:'同名/同名/100% #資料'}
  ]);
});

test('directory entries sort folders first with numeric locale names without mutating input', async () => {
  const {visibleEntries} = await helpers();
  const entries = [{name:'file10.pdf'}, {name:'Folder10',directory:true}, {name:'file2.pdf'}, {name:'Folder2',directory:true}];
  assert.deepEqual(visibleEntries(entries).map(e=>e.name), ['Folder2','Folder10','file2.pdf','file10.pdf']);
  assert.equal(entries[0].name, 'file10.pdf');
});

test('quick filter only matches current entry names case-insensitively and trims whitespace', async () => {
  const {visibleEntries} = await helpers();
  const entries = [{name:'Alpha.PDF'}, {name:'beta.txt',relative:'Alpha/beta.txt'}, {name:'ALPHA folder',directory:true}];
  assert.deepEqual(visibleEntries(entries,'  alpha ').map(e=>e.name), ['ALPHA folder','Alpha.PDF']);
  assert.deepEqual(visibleEntries(entries,'absent'), []);
});
