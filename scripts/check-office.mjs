import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {Store} from '../server/store.mjs';
import {Office} from '../server/office.mjs';
const dir=path.resolve('evidence/office-check-data');await mkdir(dir,{recursive:true});const store=await new Store(dir).init(),office=await new Office(store).init();
const result=await office.health();await writeFile('evidence/office-health.json',JSON.stringify(result,null,2));
for(const r of result)console.log(`${r.id}: ${r.available?'MCP connected ('+r.toolCount+' tools)':r.error}`);if(result.some(r=>!r.available))process.exitCode=1;
