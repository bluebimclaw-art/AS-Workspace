import path from 'node:path';

const types={'.pdf':'application/pdf','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation','.txt':'text/plain; charset=utf-8','.csv':'text/csv; charset=utf-8','.json':'application/json; charset=utf-8','.odt':'application/vnd.oasis.opendocument.text','.rtf':'application/rtf','.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.tex':'text/plain; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.doc':'application/msword','.dotx':'application/vnd.openxmlformats-officedocument.wordprocessingml.template'};
// A normal same-origin link uses the existing HttpOnly login cookie. Never put
// session tokens in a download URL or turn a private file into a public URL.
export function projectFileHeaders(file,version,{download=false}={}){
 const ext=path.extname(file.name).toLowerCase();
 const encoded=encodeURIComponent(file.name).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
 return {'Content-Type':types[ext]||'application/octet-stream','Content-Disposition':`${['.pdf','.png','.jpg','.jpeg','.webp'].includes(ext)&&!download?'inline':'attachment'}; filename="file${ext}"; filename*=UTF-8''${encoded}`,'Content-Length':String(version.bytes),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-File-Version':String(version.version),'X-File-SHA256':version.sha256};
}
