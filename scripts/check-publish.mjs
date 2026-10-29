import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
const files=execFileSync('git',['ls-files','-z'],{encoding:'utf8'}).split('\0').filter(Boolean),problems=[];
if(!files.length)throw new Error('尚未加入專案源碼，無法檢查');
for(const file of files){
 if(/^(data|tools|node_modules|dist|release|evidence|public)\//.test(file)||/(^|\/)(?:users\.json|\.env(?!\.example$))/.test(file)||/\.local(?:\.json)?$|\.(?:key|pem|pfx|p12|crt|docx|pdf|xlsx|pptx|exe|dll)$/i.test(file))problems.push({file,reason:'runtime/private/generated path'});
 const text=await readFile(file,'utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)||/\b(?:ghp_|gho_|github_pat_)[A-Za-z0-9_]{30,}/.test(text)||/\bsk-[A-Za-z0-9_-]{32,}/.test(text))problems.push({file,reason:'possible credential material'});
}
if(problems.length){console.error(JSON.stringify(problems));process.exitCode=1;}else console.log(JSON.stringify({trackedFiles:files.length,forbiddenPaths:0,recognizedCredentials:0,note:'Heuristic check + explicit file exclusions; not a full secret audit'}));
