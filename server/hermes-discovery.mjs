import {providerConnection} from './provider-connection.mjs';
import {modelList,chatCompletion} from './models.mjs';
// Explicit local candidates only; no process command lines, credential files or subnet scan.
export async function discoverHermes({baseUrl='http://127.0.0.1:8642/v1',key='',generate=false,model=''}={}) {
  if(typeof key!=='string'||key.length>8192||/[\r\n]/.test(key))throw Error('API key格式不正確');
  const connection=providerConnection({baseUrl,connectionScope:'loopback',inference:'mixed'});
  const p={id:'hermes',protocol:'hermes',...connection,inference:'mixed',location:'cloud',key,enabled:true,model,timeoutMs:120000};
  const healthUrl=new URL(connection.baseUrl);healthUrl.pathname='/health';
  const result={baseUrl:connection.baseUrl,connectionScope:'loopback',inference:'mixed',identityVerified:false,healthStatus:null,modelsStatus:null,models:[],generationTested:false,sessionIsolationTested:false,toolsScopeVerified:false};
  try{const r=await fetch(healthUrl,{redirect:'error',signal:AbortSignal.timeout(3000)});result.healthStatus=r.status;await r.body?.cancel();}catch{result.healthError='健康端點不可達或拒絕重新導向';}
  try{result.models=await modelList(p);result.modelsStatus=200;}catch(e){result.modelsStatus=Number(e.message.match(/HTTP (\d+)/)?.[1])||null;result.modelsError=result.modelsStatus===401?'需要API認證；沒有讀取Hermes秘密':'模型清單未通過';}
  if(generate){
    if(!model||!result.models.includes(model))throw Error('先認證並選擇模型清單內的公開model ID');
    const r=await chatCompletion(p,[{role:'system',content:'只回答 AS_SETUP_OK。不要使用工具、瀏覽、記憶或讀取檔案。'},{role:'user',content:'這是合成安裝連線測試，請回答 AS_SETUP_OK。'}]);
    // Never return arbitrary agent output or upstream errors in a public diagnostic report.
    result.generationTested=true;result.generationPassed=r.output.trim()==='AS_SETUP_OK';
  }
  return result;
}
