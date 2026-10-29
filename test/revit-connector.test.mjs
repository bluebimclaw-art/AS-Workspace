import {test} from 'node:test';
import assert from 'node:assert/strict';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {RevitConnector,revitConfig} from '../server/revit-connector.mjs';

// Synthetic MCP peer; it never connects to or modifies a real Revit model.
async function fixture(run){
 const dir=await mkdtemp(path.join(os.tmpdir(),'as-revit-'));
 const socket=net.createServer(s=>s.end());
 await new Promise(r=>socket.listen(0,'localhost',r));
 const port=socket.address().port,entry=path.join(dir,'fake.js');
 await writeFile(entry,`const rl=require('node:readline').createInterface({input:process.stdin});
 rl.on('line',line=>{const m=JSON.parse(line);if(!m.id)return;let result={};
 if(m.method==='initialize')result={serverInfo:{name:'synthetic-revit',version:'1.0.0'}};
 if(m.method==='tools/list')result={tools:['get_project_info','get_all_levels','delete_elements'].map(name=>({name}))};
 if(m.method==='tools/call'){
  if(process.env.REVIT_MCP_PORT!=='${port}')throw Error('configured port was not forwarded');
  if(!['get_project_info','get_all_levels'].includes(m.params.name))throw Error('unapproved tool');
  const value=m.params.name==='get_project_info'?{ProjectName:'SYNTHETIC',RevitVersion:'2024'}:{Count:2,Levels:[{Name:'Ground',Elevation:0},{Name:'First',Elevation:4000}]};
  result={content:[{type:'text',text:JSON.stringify(value)}]};
 }process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:m.id,result})+'\\n');});`);
 try{await run({entry,port,expectedRevitYear:'2024',expectedMcpVersion:'1.0.0'});}finally{await new Promise(r=>socket.close(r));await rm(dir,{recursive:true,force:true,maxRetries:10,retryDelay:50});}
}
test('unconfigured and missing MCP entries fail closed',async()=>{
 const a=await new RevitConnector().probe();assert.equal(a.status,'mcp-unavailable');assert.equal(a.writeEnabled,false);
 const b=await new RevitConnector({entry:path.join(os.tmpdir(),'absent-as-revit.js')}).probe();assert.equal(b.mcpReady,false);assert.match(b.error,/不存在/);
});
test('only fixed read tools are exposed; configured port reaches subprocess',async()=>fixture(async config=>{
 const r=await new RevitConnector(config).probe();assert.equal(r.status,'connected-readonly');assert.equal(r.actualRevitYear,'2024');assert.deepEqual(r.readTools,['get_project_info','get_all_levels']);assert.equal(r.levels.count,2);assert.equal(r.writeEnabled,false);
}));
test('MCP version mismatch stops before model query',async()=>fixture(async config=>{
 const r=await new RevitConnector({...config,expectedMcpVersion:'2.0.0'}).probe();assert.equal(r.status,'version-mismatch');assert.equal(r.revitConnected,false);assert.equal(r.project,undefined);
}));
test('Revit year mismatch stops subsequent level query',async()=>fixture(async config=>{
 const r=await new RevitConnector({...config,expectedRevitYear:'2025'}).probe();assert.equal(r.status,'version-mismatch');assert.equal(r.levels,undefined);assert.equal(r.writeEnabled,false);
}));
test('server configuration is explicit and never exposes the entry path',()=>{
 const config=revitConfig({POC_REVIT_MCP_ENTRY:'private-path',POC_REVIT_MCP_PORT:'9001',POC_REVIT_EXPECTED_YEAR:'2025'});
 assert.equal(config.port,9001);assert.equal(config.expectedRevitYear,'2025');assert.ok(!JSON.stringify(new RevitConnector(config).status()).includes('private-path'));
});
