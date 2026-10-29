import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {fileDownloadUrl,verifyFileDownload} from '../src/file-links.mjs';
test('download verification distinguishes missing login, stale version and corrupt content',async()=>{
 const bytes=Buffer.from('繁體中文合成測試'),v={version:2,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')},file={id:'synthetic-id'};
 assert.equal(fileDownloadUrl(file.id,2),'/api/project/files/synthetic-id?version=2&download=1');
 const digest=b=>webcrypto.subtle.digest('SHA-256',b),request=async()=>new Response(bytes,{headers:{'X-File-Version':'2'}});
 assert.deepEqual(await verifyFileDownload(file,v,{request,digest}),v);
 await assert.rejects(verifyFileDownload(file,v,{request:async()=>new Response('',{status:401}),digest}),/HTTP 401/);
 await assert.rejects(verifyFileDownload(file,{...v,version:1},{request,digest}),/完整性不一致/);
 await assert.rejects(verifyFileDownload(file,{...v,sha256:'0'.repeat(64)},{request,digest}),/完整性不一致/);
});
