import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dest=path.join(root,'tools/ocr');await mkdir(dest,{recursive:true});const files={};
for(const lang of ['eng','chi_tra','chi_sim']){const bytes=await readFile(path.join(root,'node_modules/@tesseract.js-data',lang,'4.0.0_best_int',lang+'.traineddata.gz'));await writeFile(path.join(dest,lang+'.traineddata.gz'),bytes);files[lang]={sha256:createHash('sha256').update(bytes).digest('hex'),source:`@tesseract.js-data/${lang}@1.0.0/4.0.0_best_int`,bytes:bytes.length};}
await writeFile(path.join(dest,'manifest.json'),JSON.stringify({ocr:'tesseract.js@7.0.0',files},null,2));console.log('OCR 中英文資料已從固定 npm 依賴複製至新平台 tools/ocr；辨識時不下載或外送文件。');
