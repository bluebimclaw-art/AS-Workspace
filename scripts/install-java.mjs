import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import JSZip from 'jszip';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const os={win32:'windows',darwin:'mac'}[process.platform],arch={x64:'x64',arm64:'aarch64'}[process.arch];
if(!os||!arch)throw new Error('只支援 Windows / Mac x64 / arm64');
const get=async url=>{const r=await fetch(url,{signal:AbortSignal.timeout(300000)});if(!r.ok)throw new Error('下載失敗 HTTP '+r.status);return r;};
const entries=await(await get(`https://api.adoptium.net/v3/assets/latest/17/hotspot?architecture=${arch}&image_type=jre&os=${os}&vendor=eclipse`)).json();
const pkg=entries[0]?.binary?.package;if(!pkg)throw new Error('找不到適合此平台的官方 JRE');
const bytes=Buffer.from(await(await get(pkg.link)).arrayBuffer());
if(createHash('sha256').update(bytes).digest('hex')!==pkg.checksum)throw new Error('Java 發行檔雜湊不一致');
const dest=path.join(root,'tools/java');await mkdir(dest,{recursive:true});
if(pkg.name.endsWith('.zip')){
 const z=await JSZip.loadAsync(bytes);for(const e of Object.values(z.files)){if(e.dir)continue;const f=path.resolve(dest,e.name);if(!f.startsWith(dest+path.sep))throw new Error('不允許的發行檔路徑');await mkdir(path.dirname(f),{recursive:true});await writeFile(f,await e.async('nodebuffer'));}
}else{
 const archive=path.join(dest,pkg.name);await writeFile(archive,bytes);
 await new Promise((resolve,reject)=>{const p=spawn('/usr/bin/tar',['-xzf',archive,'-C',dest],{stdio:'inherit',shell:false});p.on('error',reject);p.on('exit',c=>c===0?resolve():reject(new Error('Java 解壓失敗')));});
}
await writeFile(path.join(dest,'install-manifest.json'),JSON.stringify({version:entries[0].version,source:pkg.link,sha256:pkg.checksum,platform:process.platform,arch:process.arch},null,2));
console.log('Temurin 17 JRE 已加入新平台 tools/java；沒有修改系統 PATH 或 Java 設定。');
