import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
const source=path.resolve(process.argv[2]),file=path.join(source,'crates/fonts/build.rs');
let text=await readFile(file,'utf8');
const before='let web_face = (*family == "BIZ UDPGothic" && *style == "Regular")',after='let web_face = ((*family == "BIZ UDPGothic" || *family == "LXGW WenKai TC") && *style == "Regular")';
if(!text.includes(after)){if(!text.includes(before))throw Error('PdfCraft font build hook changed');text=text.replace(before,after);await writeFile(file,text);}
console.log('PdfCraft OFL Traditional Chinese optional build face enabled; no barred font families changed');
