import test from 'node:test';import assert from 'node:assert/strict';
test('navigation never requires saving: clean leaves, dirty can cancel or discard, only active operations block',async()=>{
 const mod=await import('../src/document-navigation.mjs').catch(()=>({}));assert.equal(typeof mod.mayLeaveDocument,'function','Navigation decision helper is required');
 let prompts=0,notice='';const ask=answer=>()=>{prompts++;return answer;};
 assert.equal(mod.mayLeaveDocument({unsaved:false,confirm:ask(false)}),true);assert.equal(prompts,0);
 assert.equal(mod.mayLeaveDocument({unsaved:true,confirm:ask(false)}),false);
 assert.equal(mod.mayLeaveDocument({unsaved:true,confirm:ask(true)}),true);
 assert.equal(mod.mayLeaveDocument({unsaved:true,busy:true,confirm:ask(true),notify:m=>notice=m}),false);
 assert.equal(prompts,2);assert.match(notice,/進行中/);
});
test('all conditional document editors report active work and sidebar uses discard navigation',async()=>{
 const {readFileSync}=await import('node:fs');const read=n=>readFileSync(new URL('../src/'+n,import.meta.url),'utf8');
 assert.match(read('Workbench.jsx'),/mayLeaveDocument\(\{unsaved:officeUnsaved,busy:officeBusy/);
 assert.doesNotMatch(read('Workbench.jsx'),/請先保存文件或另存副本，再切換功能/);
 for(const file of ['OfficeWorkspace.jsx','CanvasWorkspace.jsx'])assert.match(read(file),/onBusy\?\.\(/);
});
