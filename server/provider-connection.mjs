// Transport scope is independent of where inference and tools send data.
// Literal loopback and a pinned localhost alias avoid DNS rebinds in HTTP mode.
export function providerConnection(p) {
  let url;try{url=new URL(p.baseUrl);}catch{throw Error('服務端點不正確');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('端點不可含帳密、query或fragment');
  if(url.hostname==='localhost')url.hostname='127.0.0.1';
  const loopback=['127.0.0.1','[::1]'].includes(url.hostname),scope=p.connectionScope||(loopback?'loopback':'remote');
  if(!['loopback','remote'].includes(scope)||scope==='loopback'&&!loopback)throw Error('loopback 接駁只接受本機固定地址');
  if((p.inference||p.location||(p.id==='local'?'local':'unknown'))==='local'&&!loopback)throw Error('此版地端服務限本機loopback');
  if(scope==='remote'&&url.protocol!=='https:')throw Error('遠端服務必須HTTPS');
  return {baseUrl:url.href.replace(/\/$/,''),connectionScope:scope};
}
