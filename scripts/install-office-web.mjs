import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
const root=path.resolve(import.meta.dirname,'..'),items=JSON.parse(await readFile(path.join(root,'config/office-web.json'),'utf8'));
for(const item of items){let bytes;const local=process.argv[2];if(local)bytes=await readFile(path.join(path.resolve(local),item.archive));else{const r=await fetch(item.url,{signal:AbortSignal.timeout(600000)});if(!r.ok)throw Error(`Office Web HTTP ${r.status}; private repo: download release assets with gh, then pass the folder`);bytes=Buffer.from(await r.arrayBuffer());}
 if(createHash('sha256').update(bytes).digest('hex')!==item.sha256)throw Error(item.id+' archive hash mismatch');
 const zip=await JSZip.loadAsync(bytes),base=path.join(root,'public/office');for(const entry of Object.values(zip.files)){if(entry.dir)continue;const dest=path.resolve(base,entry.name);if(!entry.name.startsWith(item.folder+'/')||!dest.startsWith(base+path.sep))throw Error('Unsafe asset path');await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,await entry.async('nodebuffer'));}
 const baseDir=path.join(base,item.folder),manifest=JSON.parse(await readFile(path.join(baseDir,'platform-build.json'),'utf8'));for(const [name,hash]of Object.entries(manifest.files)){const dest=path.resolve(baseDir,name);if(path.dirname(dest)!==baseDir||createHash('sha256').update(await readFile(dest)).digest('hex')!==hash)throw Error('Asset manifest mismatch');}
 console.log(item.id+' Web '+item.version+' SHA256 OK');
}
