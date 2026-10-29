import test from 'node:test';import assert from 'node:assert/strict';
const module=await import('../src/explorer-file-policy.mjs').catch(()=>({}));
test('preview.readActions respect the existing 32 MiB server limit',()=>{
 assert.equal(typeof module.canReadFile,'function','Missing explicit 32 MiB policy');
 assert.equal(module.canReadFile({bytes:32*1024*1024}),true);
 assert.equal(module.canReadFile({bytes:32*1024*1024+1}),false);
 assert.equal(module.canReadFile({bytes:-1}),false);
 assert.equal(module.canReadFile({}),false);
});
