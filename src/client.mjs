let csrf=null;
let project=null; // Single company workspace; old project query parameters are not reused.
export function projectUrl(value){if(!project)return value;const [url,hash]=value.split('#');return url+(url.includes('?')?'&':'?')+'project='+encodeURIComponent(project)+(hash?'#'+hash:'');}
export function setCsrf(value){csrf=value;}
export async function api(url,body){
 const r=await fetch(projectUrl('/api/'+url),body!==undefined?{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},body:JSON.stringify(body)}:{credentials:'same-origin'});
 const d=await r.json();if(!r.ok){if(r.status===401)window.dispatchEvent(new Event('trial-auth-required'));throw Object.assign(new Error(d.error||`HTTP ${r.status}`),{status:r.status});}if(url==='state'&&d.workspace?.project)project=d.workspace.project.id;return d;
}
