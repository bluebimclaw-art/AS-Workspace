import {CraftMcp} from '../server/craft-mcp.mjs';
import {writeFile} from 'node:fs/promises';
const [command,out,...args]=process.argv.slice(2);
const client=new CraftMcp(command,args);
try{const result=await client.init();await writeFile(out,JSON.stringify(result,null,2));console.log(result.tools.map(t=>t.name).join(', '));}finally{client.close();}
