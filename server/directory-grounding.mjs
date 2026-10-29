const normalize=value=>String(value||'').normalize('NFC').replace(/\s+/gu,' ').trim();
const folded=value=>normalize(value).toLocaleLowerCase();
export const retrievalLabel='AI 關鍵詞擴展＋本機檢索；引用原文核對；未使用 embedding';
export function noEvidence(outcome='no-match'){
 return {output:outcome==='unverified'?'模型未提供可核對的原文引用；本次不發布答案，請改用關鍵字搜尋或重新提問。':'在已索引及獲批准的範圍內找不到符合條件的可引用內容。',outcome,citations:[],retrieval:retrievalLabel};
}
// Quoted strings and code-like identifiers are literal constraints, never synonyms.
export function literalAnchors(question){
 const result=[];for(const match of String(question).matchAll(/[「“"]([^」”"\n]{1,160})[」”"]/gu))result.push(match[1]);
 for(const match of String(question).matchAll(/(?<![A-Za-z0-9_-])[A-Za-z0-9][A-Za-z0-9_-]{3,79}(?![A-Za-z0-9_-])/gu))if(/\d/.test(match[0]))result.push(match[0]);
 return [...new Set(result.map(folded))].slice(0,8);
}
export function containsAnchor(hit,anchor){return folded(hit.name+' '+hit.snippet).includes(folded(anchor));}
export function decodeAnswer(output,candidates){
 let data;try{data=JSON.parse(output.replace(/^```(?:json)?\s*|\s*```$/g,''));}catch{return noEvidence('unverified');}
 if(!data||typeof data!=='object'||Array.isArray(data))return noEvidence('unverified');
 if(data.status==='no_match'||typeof data.answer==='string'&&/(?:找不到|無法找到|未找到|沒有找到|沒有相關|無法在[\s\S]{0,100}找到|no matching|not found)/iu.test(data.answer))return noEvidence();
 if(data.status!=='answered'||typeof data.answer!=='string'||!data.answer.trim()||data.answer.length>8000||!Array.isArray(data.evidence)||!data.evidence.length||data.evidence.length>12)return noEvidence('unverified');
 const evidence=new Map();for(const e of data.evidence){
  if(!e||!Number.isInteger(e.source)||e.source<1||e.source>candidates.length||typeof e.quote!=='string')return noEvidence('unverified');
  const quote=normalize(e.quote),hit=candidates[e.source-1];
  if(quote.length<4||quote.length>500||!normalize(hit.snippet||hit.name).includes(quote))return noEvidence('unverified');
  evidence.set(e.source,{...hit,evidenceQuote:quote});
 }
 const order=[...evidence.keys()].sort((a,b)=>a-b),mapping=new Map(order.map((n,i)=>[n,i+1]));
 const refs=[...data.answer.matchAll(/\[(\d+)\]/g)].map(m=>Number(m[1]));
 if(!refs.length||refs.some(n=>!mapping.has(n)))return noEvidence('unverified');
 const cited=order.filter(n=>refs.includes(n)),remap=new Map(cited.map((n,i)=>[n,i+1]));
 return {output:data.answer.replace(/\[(\d+)\]/g,(_,n)=>'['+remap.get(Number(n))+']'),outcome:'answered',citations:cited.map(n=>evidence.get(n)),retrieval:retrievalLabel};
}
