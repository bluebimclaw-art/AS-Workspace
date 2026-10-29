import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readdir,mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
// docx ships JSZip transitively; use the existing installed dependency for a portable ZIP.
import JSZip from 'jszip';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),zip=new JSZip();
const excluded=new Set(['node_modules','dist','public','data','release','tools','.git','office-live-data','office-check-data','.env','models.local.json','office.local.json','tls','users.json','evidence']);
async function collect(dir,rel=''){for(const e of await readdir(dir,{withFileTypes:true})){if(excluded.has(e.name)||/^WINDOWS_.*_2026-10-24\.md$/.test(e.name)||e.name.endsWith('.local')||e.name.endsWith('.local.json')||/\.(key|pem|pfx|p12|crt)$/i.test(e.name)||(e.name.startsWith('.env')&&e.name!=='.env.example')||e.isSymbolicLink())continue;const next=path.posix.join(rel,e.name);if(e.isDirectory())await collect(path.join(dir,e.name),next);else zip.file(next,await readFile(path.join(dir,e.name)));}}
await collect(root);
// GridCraft WebAssembly is platform independent. Keep the official licenses and verified
// install manifest with it, so a Mac deployment need not fetch a second copy of the editor.
await collect(path.join(root,'public/gridcraft/gridcraft-web-0.11.1-cjk1'),'public/gridcraft/gridcraft-web-0.11.1-cjk1');
const officeWeb=JSON.parse(await readFile(path.join(root,'config/office-web.json'),'utf8'));for(const app of officeWeb)await collect(path.join(root,'public/office',app.folder),'public/office/'+app.folder);
await collect(path.join(root,'public/canvas-web'),'public/canvas-web');
// Reviewed synthetic diagnostics live under docs/. Never ship raw local evidence logs.
await mkdir(path.join(root,'release'),{recursive:true});const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),name='Company-AI-Platform-PoC-source.zip';await writeFile(path.join(root,'release',name),bytes);await writeFile(path.join(root,'release',name+'.sha256'),createHash('sha256').update(bytes).digest('hex')+'  '+name+'\n');console.log(name+' '+bytes.length+' bytes');
