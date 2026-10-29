import {access,readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {findJava} from '../server/pdf-search.mjs';
import {runLocal} from '../server/directory-extract.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),results={platform:process.platform,node:process.version};
for(const [name,cmd,args] of [['java',process.env.POC_JAVA_BIN||await findJava(path.join(root,'tools/java'))||'java',['-version']],['pdfRenderer',process.env.POC_PDFTOPPM_BIN||'pdftoppm',['-v']]]){try{await runLocal(cmd,args,{timeoutMs:10000});results[name]='ready';}catch(e){results[name]=e.message;}}
results.ocrLanguages={};for(const l of ['eng','chi_tra','chi_sim']){try{await access(path.resolve(root,process.env.POC_OCR_LANG_DIR||'tools/ocr',l+'.traineddata.gz'));results.ocrLanguages[l]='ready';}catch{results.ocrLanguages[l]='run npm run search:ocr:setup';}}
console.log(JSON.stringify(results,null,2));if(results.java!=='ready'||results.pdfRenderer!=='ready'||Object.values(results.ocrLanguages).some(x=>x!=='ready'))process.exitCode=1;
