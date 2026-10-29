// This is local transport to a cloud subscription, never a paid Images API route.
export function validateCodexProfile(p){
 if(p.protocol!=='codex-subscription')return;
 if(p.baseUrl?.replace(/\/$/,'')!=='http://127.0.0.1:8648/v1'||(p.inference||p.location)!=='cloud'||p.model!=='gpt-image-2'||typeof p.key!=='string'||!p.key)throw Object.assign(new Error('Codex訂閱生圖只接受已認證的固定本機Worker、cloud位置及gpt-image-2；不會轉用付費API'),{status:400});
}
