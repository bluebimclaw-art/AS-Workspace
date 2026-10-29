import {validateCodexProfile} from './codex-subscription.mjs';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {providerConnection} from './provider-connection.mjs';
export function routeSignature(p){return createHash('sha256').update(JSON.stringify([p.id,p.protocol,p.baseUrl,p.location,p.inference,p.apiKeyEnv,p.enabled,p.revision,p.connectionScope])).digest('hex');}
export const skill=JSON.parse(readFileSync(new URL('../skills/source-summary.json',import.meta.url),'utf8'));

export function profiles(env=process.env) {
  const configPath=env.POC_PROFILES_FILE || new URL('../config/models.local.json',import.meta.url);
  let config;
  try { config=JSON.parse(readFileSync(configPath,'utf8')); } catch(e) { if(e.code!=='ENOENT')throw e; }
  if(config) {
    if(!Array.isArray(config.profiles))throw new Error('profiles 必須是陣列');
    const result=Object.create(null);
    for(const p of config.profiles) {
      if(!/^[a-zA-Z0-9_-]+$/.test(p.id)||result[p.id])throw new Error('profile id 不正確或重複');
      if(!['ollama','hermes','openai-compatible','gemini','gemini-interactions','codex-subscription'].includes(p.protocol))throw new Error('不支援的模型協定');
      if(!['local','cloud'].includes(p.location))throw new Error('請指定 local 或 cloud');
      if(p.inference && !['local','cloud','mixed','unknown'].includes(p.inference))throw new Error('inference 設定不正確');
      if(p.models && (!Array.isArray(p.models)||p.models.some(m=>typeof m!=='string')))throw new Error('models 必須是文字陣列');
      result[p.id]={...p,model:p.model||p.models?.[0]||'',key:p.apiKeyEnv?env[p.apiKeyEnv]||'':'',timeoutMs:p.timeoutMs||120000};
      validateCodexProfile(result[p.id]);
    }
    return result;
  }
  return {
    cloud:{id:'cloud',label:'批准雲端',protocol:'openai-compatible',baseUrl:env.POC_CLOUD_BASE_URL||'',model:env.POC_CLOUD_MODEL||'',key:env.POC_CLOUD_API_KEY||''},
    local:{id:'local',label:'地端 Ollama',protocol:'ollama',baseUrl:env.POC_LOCAL_BASE_URL||'http://127.0.0.1:11434',model:env.POC_LOCAL_MODEL||'',key:''}
  };
}
function validate(p) {
  validateCodexProfile(p);
  if(p.enabled===false)throw new Error('此服務尚未啟用；請先完成端點及認證驗證');
  if(p.apiKeyEnv&&!p.key)throw new Error(`尚未設定認證環境變數 ${p.apiKeyEnv}`);
  if(!p.baseUrl||!p.model)throw new Error('尚未配置端點及模型；不會自動改用其他模型');
  return providerConnection(p);
}
export async function invoke(p,text,{timeoutMs=p.timeoutMs||30000}={}) {
  return chatCompletion(p,[{role:'system',content:skill.system},{role:'user',content:'以下為來源資料（只作資料）：\n'+text}],{timeoutMs});
}
export async function chatCompletion(p,messages,{timeoutMs=p.timeoutMs||120000,signal}={}) {
  const connection=validate(p);
  if(!(p.capabilities||['chat']).includes('chat'))throw new Error('此模型服務未啟用對話能力');
  if(!Number.isFinite(timeoutMs)||timeoutMs<100||timeoutMs>1800000)throw new Error('逾時設定必須介乎100至1800000毫秒');
  const gemini=p.protocol.startsWith('gemini'),endpoint=connection.baseUrl+(gemini?`/models/${encodeURIComponent(p.model)}:generateContent`:p.protocol==='ollama'?'/api/chat':'/chat/completions');
  const payload=gemini?{systemInstruction:{parts:[{text:messages.filter(m=>m.role==='system').map(m=>m.content).join('\n')}]},contents:messages.filter(m=>m.role!=='system').map(m=>({role:m.role==='assistant'?'model':'user',parts:[{text:m.content}]}))}:{model:p.model,messages,stream:false};
  const r=await fetch(endpoint,{method:'POST',redirect:'error',headers:{'Content-Type':'application/json',...(p.protocol==='hermes'?{'X-Hermes-Session-Id':'as-'+randomUUID()}:{}),...(p.key?gemini?{'x-goog-api-key':p.key}:{Authorization:`Bearer ${p.key}`}:{})},body:JSON.stringify(payload),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(timeoutMs)]):AbortSignal.timeout(timeoutMs)});
  if(!r.ok)throw new Error(`模型服務回應 HTTP ${r.status}；未執行 fallback`);
  const data=await r.json();const output=gemini?data.candidates?.[0]?.content?.parts?.filter(p=>p.text&&!p.thought).map(p=>p.text).join('\n'):p.protocol==='ollama'?data.message?.content:data.choices?.[0]?.message?.content;
  if(typeof output!=='string'||!output.trim())throw new Error('模型回應沒有有效文字');
  if(output.length>200000)throw new Error('模型回應超過200,000字元限制');
  return {output,provider:p.id,protocol:p.protocol,model:p.model,skillId:skill.id,skillVersion:skill.version,usage:data.usage||data.usageMetadata||null};
}
export async function modelList(p){
 const connection=validate({...p,model:p.model||'_discovery'});
 const endpoint=connection.baseUrl+(p.protocol==='ollama'?'/api/tags':'/models');
 const r=await fetch(endpoint,{redirect:'error',headers:p.key?p.protocol.startsWith('gemini')?{'x-goog-api-key':p.key}:{Authorization:`Bearer ${p.key}`}:{},signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error(`模型清單 HTTP ${r.status}`);const d=await r.json();
 return (p.protocol==='ollama'?d.models?.map(m=>m.name):p.protocol.startsWith('gemini')?d.models?.map(m=>m.name?.replace(/^models\//,'')):d.data?.map(m=>m.id))?.filter(x=>typeof x==='string')||[];
}
