import {mkdir,open,readFile,unlink} from 'node:fs/promises';
import path from 'node:path';
export async function lockDataDirectory(dir){
 await mkdir(dir,{recursive:true});const file=path.join(dir,'server.lock');
 for(let attempt=0;attempt<2;attempt++){
  try{const handle=await open(file,'wx',0o600);await handle.writeFile(JSON.stringify({pid:process.pid,createdAt:new Date().toISOString()}));return async()=>{await handle.close();await unlink(file).catch(()=>{});};}
  catch(e){if(e.code!=='EEXIST')throw e;let previous;try{previous=JSON.parse(await readFile(file,'utf8'));}catch{throw new Error('資料鎖格式不正確，先由管理員核對 data/server.lock');}
   if(!Number.isInteger(previous.pid))throw new Error('資料鎖 PID 不正確');let alive=true;try{process.kill(previous.pid,0);}catch(err){if(err.code==='ESRCH')alive=false;}
   if(alive)throw new Error('此資料目錄已有平台程序；先停止舊服務，不可同時執行兩個寫入程序');await unlink(file);
  }
 }throw new Error('無法取得平台資料鎖');
}
