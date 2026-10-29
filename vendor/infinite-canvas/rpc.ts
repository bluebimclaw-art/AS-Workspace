let port:MessagePort;let sequence=0;const pending=new Map<number,{resolve:(v:any)=>void,reject:(v:any)=>void}>();
export function bind(p:MessagePort){port=p;port.onmessage=e=>{const d=e.data;if(d.type==='command')window.dispatchEvent(new CustomEvent('as-canvas-command',{detail:d}));if(d.type==='response'){const item=pending.get(d.id);if(item){pending.delete(d.id);d.error?item.reject(Error(d.error)):item.resolve(d.result);}}};port.start();}
export function request(action:string,payload:any={}){const id=++sequence;return new Promise<any>((resolve,reject)=>{pending.set(id,{resolve,reject});port.postMessage({type:'request',id,action,payload});});}
export function notify(type:string,payload:any={}){port?.postMessage({type,...payload});}
