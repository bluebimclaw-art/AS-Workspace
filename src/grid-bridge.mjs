export const GRID_URL='/gridcraft/gridcraft-web-0.11.1-cjk1/index.html?host=parent&author=Trial';
export function gridMessage(event,source,origin){
 if(event.source!==source||event.origin!==origin||!event.data||typeof event.data!=='object')return null;
 const d=event.data;if(!['gridcraft:ready','gridcraft:save','gridcraft:dirty','gridcraft:failed'].includes(d.type))return null;
 if(d.type==='gridcraft:save'&&((!(d.bytes instanceof ArrayBuffer)&&!(d.bytes instanceof Uint8Array))||typeof d.name!=='string'))return null;
 return d;
}
export function toBase64(bytes){let s='';const b=new Uint8Array(bytes);for(let i=0;i<b.length;i+=16384)s+=String.fromCharCode(...b.subarray(i,i+16384));return btoa(s);}
