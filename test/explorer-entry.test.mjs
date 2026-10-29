import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=fs.readFileSync(new URL('../src/Workbench.jsx',import.meta.url),'utf8');
test('standalone company explorer entry reuses search permission and suppresses cloud chat UI',()=>{
 assert.match(source,/import FileExplorer from '\.\/FileExplorer\.jsx'/,'new readonly component must be integrated');
 assert.match(source,/\['explorer','▣','公司檔案庫'\]/);
 assert.match(source,/features\.includes\(id==='explorer'\?'search':id\)/,'UI must not invent or bypass an application grant');
 assert.match(source,/tab==='explorer'&&<FileExplorer user=\{user\}/);
 assert.equal((source.match(/!\['bim','search','explorer'\]\.includes\(tab\)/g)||[]).length,2,'both AI toggle and chat panel must stay off in readonly explorer');
});
