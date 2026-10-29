import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import JSZip from 'jszip';
import {patchGridFont} from './patch-grid-font.mjs';
const root=path.resolve(import.meta.dirname,'..'),work=path.join(root,'tools/grid-cjk-source');
const sourceCommit='ac8da7d49cbeb4be6aa1ad5869f3d29fe2da8cd9',fontCommit='fff559f5f038112a4135e95c720161d4d0a5b335';
await mkdir(work,{recursive:true});
async function get(url,sha){const r=await fetch(url,{signal:AbortSignal.timeout(600000)});if(!r.ok)throw Error(`HTTP ${r.status}`);const b=Buffer.from(await r.arrayBuffer());if(sha&&createHash('sha256').update(b).digest('hex')!==sha)throw Error('Build input hash mismatch');return b;}
const sourceZip=await get(`https://codeload.github.com/storytold/gridcraft/zip/${sourceCommit}`,'f44936b758fc4572d759f7749086c413f83141db304d5077dfa14bc71d46c299');
for(const entry of Object.values((await JSZip.loadAsync(sourceZip)).files)){if(entry.dir)continue;const dest=path.resolve(work,entry.name);if(!dest.startsWith(work+path.sep))throw Error('Unsafe source archive');await mkdir(path.dirname(dest),{recursive:true});await writeFile(dest,await entry.async('nodebuffer'));}
const font=path.join(work,'NotoSansCJKsc-Regular.otf'),fontBase=`https://raw.githubusercontent.com/storytold/craft-fonts/${fontCommit}/fonts/noto-sans-cjk-sc/`;
await writeFile(font,await get(fontBase+'NotoSansCJKsc-Regular.otf','2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b'));
await writeFile(path.join(work,'OFL.txt'),await get(fontBase+'OFL.txt','6a73f9541c2de74158c0e7cf6b0a58ef774f5a780bf191f2d7ec9cc53efe2bf2'));
const source=path.join(work,'gridcraft-'+sourceCommit);await patchGridFont(source,font);
const trunk=process.env.POC_TRUNK_BIN||'trunk';
await new Promise((resolve,reject)=>{const p=spawn(trunk,['build','--release','--locked','--config',path.join(source,'apps/gridcraft-web/Trunk.toml')],{cwd:source,env:{...process.env,PLATFORM_CJK_FONT:font},stdio:'inherit',shell:false,windowsHide:true});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(Error(`Trunk failed ${c}`)));});
const output=path.join(source,'dist/web');
// Keep results separate until publish-grid-cjk.mjs verifies and installs them.
console.log(JSON.stringify({output,sourceCommit,fontCommit,rust:'Use pinned 1.99.1 toolchain',trunk:'0.22.0'}));
