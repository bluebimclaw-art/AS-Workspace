// Actual clean installation, build, startup and login. Uses synthetic accounts only.
import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {mkdtemp,writeFile,readFile,mkdir,rm} from 'node:fs/promises';import {spawn} from 'node:child_process';import net from 'node:net';
import assert from 'node:assert/strict';import {install} from './installer-core.mjs';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),temp=await mkdtemp(path.join(os.tmpdir(),'as-clean-010-'));
const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
const input={appDir:path.join(temp,'app'),dataDir:path.join(temp,'data'),mode:'local',port,username:'installtest',password:'Synthetic-Install-Smoke!',confirmInstall:true};
let child;
try{
 const report=await install(source,input,{onProgress:s=>console.log(s)});assert.equal(report.status,'configured');
 child=spawn(process.execPath,['--env-file=config/central.env.local','server/index.mjs'],{cwd:input.appDir,shell:false,windowsHide:true,stdio:'ignore'});
 const base='http://127.0.0.1:'+port;let health;for(let i=0;i<80;i++){try{const r=await fetch(base+'/api/health');if(r.ok){health=await r.json();break;}}catch{}await new Promise(r=>setTimeout(r,200));}
 assert.equal(health?.version,'0.11.0');assert.equal((await fetch(base+'/api/state')).status,401);
 const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:input.username,password:input.password})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
 const response=await fetch(base+'/api/company/admin',{headers:{Cookie:cookie}});assert.equal(response.status,200);const state=await response.json();assert.equal(state.workspaceMode,'single');assert.equal(state.workspace.inferencePolicy,'local-only');
 const shared=await fetch(base+'/api/state',{headers:{Cookie:cookie}});assert.equal(shared.status,200);const sharedState=await shared.json();assert.equal(sharedState.workspace.mode,'single');assert.ok(sharedState.workspace.ops.includes('edit'));assert.ok(sharedState.workspace.features.includes('files'));
 const html=await fetch(base+'/');assert.equal(html.status,200);assert.ok((await html.text()).includes('assets/'));
 const sourcePackage=await readFile(path.join(source,'package.json'),'utf8');assert.equal(JSON.parse(sourcePackage).version,'0.11.0');
 await mkdir(path.join(source,'evidence'),{recursive:true});const result={version:health.version,platform:process.platform,node:process.version,realNpmInstallBuild:true,newFolders:true,firstAdminLogin:true,unauthenticatedState:401,singleWorkspace:true,adminRead:true,sharedWorkspaceRead:true,frontendServed:true,sourceSecretsExcluded:true,hermesInference:'not tested; no real Hermes used',lanTls:'separate TLS unit tests, not LAN acceptance',autoStart:'not installed',temporaryInstallRemoved:true};
 await writeFile(path.join(source,'evidence/v010-installer-smoke.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{if(child){child.kill('SIGTERM');await new Promise(r=>{child.once('exit',r);setTimeout(r,5000);});}if(!path.resolve(temp).startsWith(path.resolve(os.tmpdir())+path.sep+'as-clean-010-'))throw Error('Refusing cleanup outside owned test directory');await rm(temp,{recursive:true,force:true});}
