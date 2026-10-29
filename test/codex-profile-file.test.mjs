import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {profiles} from '../server/models.mjs';
test('owner-configured subscription image profile accepts only pinned cloud Worker with server-side env credential',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'codex-profile-'));const file=path.join(dir,'models.json');const p={id:'codex-image2',protocol:'codex-subscription',baseUrl:'http://127.0.0.1:8648/v1',location:'cloud',inference:'cloud',model:'gpt-image-2',capabilities:['image'],apiKeyEnv:'TEST_LOCAL_WORKER'};
 const env={POC_PROFILES_FILE:file,TEST_LOCAL_WORKER:'synthetic-worker-bearer'};
 try{await writeFile(file,JSON.stringify({profiles:[p]}));const result=profiles(env);assert.equal(result[p.id].key,'synthetic-worker-bearer');assert.deepEqual(result[p.id].capabilities,['image']);
 for(const edit of [{baseUrl:'https://remote.example/v1'},{inference:'local'},{model:'other'}]){await writeFile(file,JSON.stringify({profiles:[{...p,...edit}]}));assert.throws(()=>profiles(env));}
 await writeFile(file,JSON.stringify({profiles:[p]}));assert.throws(()=>profiles({POC_PROFILES_FILE:file}));
 }finally{await rm(dir,{recursive:true,force:true});}
});
