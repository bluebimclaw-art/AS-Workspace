import {projectUrl} from './client.mjs';
export function fileDownloadUrl(id,version){
 return projectUrl(`/api/project/files/${encodeURIComponent(id)}?version=${encodeURIComponent(version)}&download=1`);
}
export async function verifyFileDownload(file,version,{request=fetch,digest=bytes=>crypto.subtle.digest('SHA-256',bytes)}={}){
 const response=await request(fileDownloadUrl(file.id,version.version),{cache:'no-store',credentials:'same-origin'});
 if(!response.ok)throw new Error(`檔案讀取失敗（HTTP ${response.status}），請檢查登入及版本。`);
 const bytes=await response.arrayBuffer(),hash=Array.from(new Uint8Array(await digest(bytes)),b=>b.toString(16).padStart(2,'0')).join('');
 if(bytes.byteLength!==version.bytes||hash!==version.sha256||response.headers.get('X-File-Version')!==String(version.version))throw new Error('檔案版本或完整性不一致；請勿使用此下載，先重新整理。');
 return {version:version.version,bytes:bytes.byteLength,sha256:hash};
}
