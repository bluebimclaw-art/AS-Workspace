import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {template,unset,omit} from 'lodash-es';

test('patched lodash rejects template imports code injection without executing the expression',()=>{
 globalThis.__companyTemplateProbe=false;
 try{assert.throws(()=>template('Hello',{imports:{'x = (globalThis.__companyTemplateProbe = true)':1}}),/imports/);assert.equal(globalThis.__companyTemplateProbe,false);assert.equal(template('Hello <%= name %>')({name:'Company'}),'Hello Company');}
 finally{delete globalThis.__companyTemplateProbe;}
});
test('patched lodash protects inherited prototype properties from array-path unset/omit',()=>{
 Object.prototype.__companyPrototypeProbe='preserved';
 try{unset({},['__proto__','__companyPrototypeProbe']);assert.equal(Object.prototype.__companyPrototypeProbe,'preserved');omit({},[['__proto__','__companyPrototypeProbe']]);assert.equal(Object.prototype.__companyPrototypeProbe,'preserved');const value={a:{b:1}};assert.equal(unset(value,['a','b']),true);assert.equal(value.a.b,undefined);}
 finally{delete Object.prototype.__companyPrototypeProbe;}
});
test('both Excalidraw Nano ID resolutions retain valid unique IDs; zero/negative sizes finish within timeout',()=>{
 const code=`import{createRequire}from'node:module';import{pathToFileURL}from'node:url';
 const require=createRequire(import.meta.url),results=[];
 for(const parent of ['@excalidraw/excalidraw','@excalidraw/mermaid-to-excalidraw']){
  const resolved=createRequire(require.resolve(parent)).resolve('nanoid'),m=await import(pathToFileURL(resolved));
  const ids=Array.from({length:500},()=>m.nanoid());
  if(new Set(ids).size!==500||ids.some(id=>!/^[A-Za-z0-9_-]{21}$/.test(id)))throw new Error('invalid/colliding IDs');
  if(m.customAlphabet('abc',0)()!==''||m.customRandom('abc',0,n=>new Uint8Array(n))()!=='')throw new Error('zero-size result');
  let negativeRejected=false;try{m.nanoid(-1);}catch{negativeRejected=true;}if(!negativeRejected)throw new Error('negative size not rejected');
  results.push({parent,count:ids.length,zeroSizeFinished:true,negativeRejected});
 }console.log(JSON.stringify(results));`;
 const child=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:5000,windowsHide:true});assert.equal(child.error,undefined);assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).length,2);
});
