import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
const z=await JSZip.loadAsync(await readFile('release/Company-AI-Platform-PoC-source.zip')),files=Object.keys(z.files);
const forbidden=files.filter(n=>/^(node_modules|tools|data|release|dist)\//.test(n)||n.includes('/office-live-data/')||n.includes('/office-check-data/')||/(^|\/)\.env(?!\.example$)/.test(n)||/\.local\.json$/.test(n)||/\.exe$/.test(n));assert.deepEqual(forbidden,[]);
for(const name of ['server/office.mjs','server/craft-mcp.mjs','src/Office.jsx','config/office-releases.json','config/models.mac-mini.example.json','scripts/install-office.mjs','OFFICE_SETUP.md','MAC_DEPLOY_HANDOFF.md','package-lock.json']){
 assert.ok(z.file(name),'missing '+name);assert.equal(await z.file(name).async('string'),await readFile(name,'utf8'),'source mismatch '+name);
}
const lock=JSON.parse(await z.file('package-lock.json').async('string'));assert.equal(Object.values(lock.packages).filter(p=>p.extraneous).length,0);assert.equal(lock.packages['node_modules/@excalidraw/excalidraw/node_modules/sass'].version,'1.51.0');
const install=await readFile('evidence/package-install-clean.log','utf8'),build=await readFile('evidence/package-build-clean.log','utf8'),test=await readFile('evidence/package-test-clean.log','utf8');
const packages=Number(install.match(/added (\d+) packages/)?.[1]),passed=Number(test.match(/pass\s+(\d+)/)?.[1]),failed=Number(test.match(/fail\s+(\d+)/)?.[1]);assert.ok(packages>0);assert.ok(/built in/.test(build));assert.ok(passed>0);assert.equal(failed,0);
const report={platform:process.platform,node:process.version,archiveChecksPassed:true,entries:files.length,excludedRuntimeBinariesAndSecrets:true,sourceFilesMatch:true,cleanWindowsInstall:{passed:true,packages,log:'package-install-clean.log'},cleanBuild:{passed:true,log:'package-build-clean.log'},cleanTests:{passed,failed,log:'package-test-clean.log'},macRealDeployment:'not tested'};
await writeFile('evidence/package-validation.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
