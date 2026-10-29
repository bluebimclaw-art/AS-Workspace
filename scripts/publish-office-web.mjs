import {mkdir,readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {gzipSync} from 'node:zlib';
const root=path.resolve(import.meta.dirname,'..'),inputs=[
 {id:'wordcraft',version:'0.10.0-host1',source:'9130181a5fdaee2293e67756fd5458c601489f3c',dir:'tools/office-web-build/source/wordcraft-9130181a5fdaee2293e67756fd5458c601489f3c',fontDir:'tools/office-web-build/fonts/craft-fonts-fff559f5f038112a4135e95c720161d4d0a5b335',licenses:['fonts/biz-ud-pgothic/OFL.txt','fonts/noto-sans-cjk-sc/OFL.txt'],fontSources:['storytold/craft-fonts@fff559f5f038112a4135e95c720161d4d0a5b335'],patch:'scripts/patch-word-web.mjs'},
 {id:'pdfcraft',version:'0.13.0-cjk1',source:'53199fb4fa36f3c95b539add6218c57aeb2f823c',dir:'tools/office-web-build/pdf-source/pdfcraft-53199fb4fa36f3c95b539add6218c57aeb2f823c',fontDir:'tools/office-web-build/pdf-fonts',licenses:['fonts/biz-ud-pgothic/OFL.txt','fonts/lxgw-wenkai-tc/OFL.txt'],fontSources:['storytold/craft-fonts@fff559f5f038112a4135e95c720161d4d0a5b335','lxgw/LxgwWenkaiTC@v1.530'],patch:'scripts/patch-pdf-web.mjs'}
];
const config=JSON.parse(await readFile(path.join(root,'config/office-web.json'),'utf8')).filter(x=>!inputs.some(i=>i.id===x.id));for(const input of inputs){const source=path.join(root,input.dir),built=path.join(source,'dist/web'),folder=`${input.id}-web-${input.version}`,dest=path.join(root,'public/office',folder);await mkdir(dest,{recursive:true});
 const names=(await readdir(built)).filter(n=>/\.(html|js|wasm|ico)$/.test(n));if(!names.includes('index.html')||names.filter(n=>n.endsWith('.wasm')).length!==1)throw Error('Build not complete: '+input.id);
 for(const n of names)await copyFile(path.join(built,n),path.join(dest,n));for(const n of ['LICENSE-MIT','LICENSE-APACHE','NOTICE'])await copyFile(path.join(source,n),path.join(dest,n));
 for(const n of names.filter(n=>/\.(wasm|js)$/.test(n)))await writeFile(path.join(dest,n+'.gz'),gzipSync(await readFile(path.join(dest,n)),{level:9}));
 for(const l of input.licenses)await copyFile(path.join(root,input.fontDir,l),path.join(dest,l.split('/').at(-2)+'-OFL.txt'));
 const wasm=await readFile(path.join(dest,names.find(n=>n.endsWith('.wasm'))));if(!WebAssembly.validate(wasm))throw Error('Invalid WASM');
 const metadata={id:input.id,version:input.version,sourceCommit:input.source,patch:input.patch,fontSources:input.fontSources,rust:'1.99.1',trunk:'0.22.0',profile:'release',files:{}};
 for(const n of (await readdir(dest)).filter(n=>n!=='platform-build.json'))metadata.files[n]=createHash('sha256').update(await readFile(path.join(dest,n))).digest('hex');
 await writeFile(path.join(dest,'platform-build.json'),JSON.stringify(metadata,null,2)+'\n');
 const zip=new JSZip();for(const n of await readdir(dest))zip.file(folder+'/'+n,await readFile(path.join(dest,n)));const bytes=await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),archive=folder+'.zip';await mkdir(path.join(root,'release'),{recursive:true});await writeFile(path.join(root,'release',archive),bytes);
 config.push({id:input.id,version:input.version,folder,archive,wasmBytes:wasm.length,sha256:createHash('sha256').update(bytes).digest('hex'),url:`https://github.com/ansonman/company-ai-platform-pilot/releases/download/v0.5.0/${archive}`});
}
await writeFile(path.join(root,'config/office-web.json'),JSON.stringify(config,null,2)+'\n');console.log(JSON.stringify(config));
