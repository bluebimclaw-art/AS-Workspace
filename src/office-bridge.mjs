export const OFFICE_URLS={pdfcraft:'/office/pdfcraft-web-0.13.0-cjk1/index.html?host=parent',wordcraft:'/office/wordcraft-web-0.10.0-host1/index.html?host=parent',deckcraft:'/office/deckcraft-web-0.10.0-host1/index.html?host=parent&blank'};
export function officeMessage(event,source,origin,app){
 if(!source||event.source!==source||event.origin!==origin||!['pdfcraft','wordcraft','deckcraft'].includes(app))return null;
 const d=event.data;if(!d||typeof d!=='object'||!['ready','dirty','save','failed'].some(type=>d.type===`${app}:${type}`))return null;
 if(d.type.endsWith(':save')&&(typeof d.name!=='string'||!(d.bytes instanceof ArrayBuffer||d.bytes instanceof Uint8Array)))return null;
 if(d.type.endsWith(':save')&&d.bytes.byteLength>5_000_000)return {...d,type:app+':oversize'};
 return d;
}
