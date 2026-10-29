import {mkdir,writeFile,readFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
const root=path.resolve(import.meta.dirname,'..'),config=JSON.parse(await readFile(path.join(root,'config/gridcraft-web.json'),'utf8'));
let archive;if(process.argv[2])archive=await readFile(path.resolve(process.argv[2]));else{const r=await fetch(config.url,{signal:AbortSignal.timeout(300000)});if(!r.ok)throw Error(`GridCraft patched asset HTTP ${r.status}; use the matching deployment ZIP`);archive=Buffer.from(await r.arrayBuffer());}
if(createHash('sha256').update(archive).digest('hex')!==config.sha256)throw Error('GridCraft patched asset hash mismatch');
const zip=await JSZip.loadAsync(archive),dest=path.join(root,'public/gridcraft');
await mkdir(dest,{recursive:true});
for(const entry of Object.values(zip.files)){
 if(entry.dir)continue;if(!entry.name.startsWith(config.folder+'/'))throw Error('Unexpected asset folder');
 const file=path.resolve(dest,entry.name);
 if(!file.startsWith(dest+path.sep))throw new Error('發行檔路徑不允許');
 await mkdir(path.dirname(file),{recursive:true});await writeFile(file,await entry.async('nodebuffer'));
}
const manifest=JSON.parse(await readFile(path.join(dest,config.folder,'platform-build.json'),'utf8'));
for(const [file,sha] of Object.entries(manifest.files)){const target=path.resolve(dest,config.folder,file);if(path.dirname(target)!==path.join(dest,config.folder))throw Error('Unsafe manifest path');if(createHash('sha256').update(await readFile(target)).digest('hex')!==sha)throw Error('Asset file mismatch: '+file);}
console.log(JSON.stringify({version:config.version,sha256:config.sha256,verifiedFiles:Object.keys(manifest.files).length}));
