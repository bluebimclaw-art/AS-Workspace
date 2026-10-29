import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdir,readFile,writeFile,realpath} from 'node:fs/promises';
import {createWriteStream,createReadStream} from 'node:fs';
import {pipeline} from 'node:stream/promises';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const versions=JSON.parse(await readFile(path.join(root,'config/office-releases.json'),'utf8'));
if(!['darwin','win32'].includes(process.platform)||!['x64','arm64'].includes(process.arch))throw new Error('此安裝器支援 macOS universal、Windows x64/arm64；其他平台可手動配置 CLI');
const request=async url=>{const r=await fetch(url,{headers:{'User-Agent':'company-platform-poc'},signal:AbortSignal.timeout(300000)});if(!r.ok)throw new Error(`下載失敗 HTTP ${r.status} ${url}`);return r;};
const exec=(command,args)=>new Promise((resolve,reject)=>{const child=spawn(command,args,{stdio:'inherit',windowsHide:true,shell:false});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error('解壓失敗 '+code)));});
const records=[];
async function sha(file){const digest=createHash('sha256');for await(const b of createReadStream(file))digest.update(b);return digest.digest('hex');}
for(const [id,version] of Object.entries(versions)){
 const dir=path.join(root,'tools',id);await mkdir(dir,{recursive:true});const actual=await realpath(dir);if(!actual.startsWith((await realpath(root))+path.sep))throw new Error('工具目錄必須位於新平台資料夾內');
 const asset=process.platform==='darwin'?`${id}-cli-${version}-macos-universal.zip`:`${id}-${version}-windows-${process.arch==='arm64'?'arm64':'x64'}-portable.zip`;
 const base=`https://github.com/storytold/${id}/releases/download/v${version}/`,zip=path.join(dir,asset);
 console.log(`下載 ${id} ${version} (${process.platform}/${process.arch})`);
 const sums=await(await request(base+'SHA256SUMS.txt')).text(),line=sums.split(/\r?\n/).find(l=>l.trim().endsWith(asset)),expected=line?.match(/^[a-fA-F0-9]{64}/)?.[0]?.toLowerCase();if(!expected)throw new Error('官方雜湊清單沒有此封裝 '+asset);
 if(process.argv.includes('--plan')){console.log(asset+' SHA256 '+expected);continue;}
 let existing;try{existing=await sha(zip);}catch(e){if(e.code!=='ENOENT')throw e;}
 if(existing!==expected){const r=await request(base+asset);await pipeline(Readable.fromWeb(r.body),createWriteStream(zip));}
 const hash=await sha(zip);if(hash!==expected)throw new Error('雜湊不符，停止解壓 '+asset);
 if(process.platform==='darwin')await exec('/usr/bin/unzip',['-o','-q',zip,'-d',dir]);
 else {const quote=s=>"'"+s.replaceAll("'","''")+"'";await exec('powershell.exe',['-NoProfile','-NonInteractive','-Command',`Expand-Archive -LiteralPath ${quote(zip)} -DestinationPath ${quote(dir)} -Force`]);}
 await writeFile(path.join(dir,'SHA256SUMS.txt'),sums);records.push({id,version,asset,sha256:hash,url:base+asset});console.log(id+' checksum OK');
}
if(!process.argv.includes('--plan'))await writeFile(path.join(root,'tools/install-manifest.json'),JSON.stringify({platform:process.platform,arch:process.arch,at:new Date().toISOString(),releases:records},null,2));
console.log('完成。執行 npm run office:check 驗證 MCP；沒有修改系統服務、Gatekeeper 或模型設定。');
