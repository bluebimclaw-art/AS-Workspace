export const CANVAS_URL='/canvas-web/index.html';
export function canvasBoot(event,frame){return event.source===frame&&event.origin==='null'&&event.data?.type==='as-canvas:boot';}
export function validCanvasRequest(d){return d?.type==='request'&&Number.isSafeInteger(d.id)&&d.id>0&&d.action==='generate'&&d.payload&&typeof d.payload==='object';}
