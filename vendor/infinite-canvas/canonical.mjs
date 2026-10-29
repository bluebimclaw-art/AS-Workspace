// Hydration changes preview object URLs and fills an absent image list with [].
// Neither is a user edit. Node geometry, prompts, sources and non-empty lists are edits.
export function canonicalCanvas(projects){return JSON.stringify(projects.map(p=>({id:p.id,title:p.title,nodes:p.nodes,connections:p.connections,backgroundMode:p.backgroundMode})),(key,value)=>key==='updatedAt'||key==='createdAt'||key==='images'&&Array.isArray(value)&&!value.length?undefined:typeof value==='string'&&value.startsWith('blob:')?'LOCAL_IMAGE':value);}
