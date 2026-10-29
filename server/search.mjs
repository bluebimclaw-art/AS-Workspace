// Local, deterministic substring/keyword search. No embeddings or model dependency.
export function search(db,query) {
  const q=String(query||'').trim().toLocaleLowerCase();if(!q)return [];
  const terms=q.split(/\s+/u);
  const items=[...(db.canvasBoards||[]).map(b=>({type:'canvas',id:b.id,title:b.name,version:b.version,text:b.versions.at(-1)?.snapshot?.projects?.flatMap(p=>p.nodes.map(n=>[n.title,n.type==='text'?n.metadata?.content:undefined,n.metadata?.prompt,n.metadata?.text].filter(v=>typeof v==='string').join(' '))).join(' ')||'',sources:[]})),...db.assets.map(a=>({type:'asset',id:a.id,title:a.name,text:a.text,sources:[{assetId:a.id,version:a.version}]})),
    ...db.documents.map(d=>({type:'document',id:d.id,title:d.title,text:d.body,sources:d.sources})),
    ...db.boards.map(b=>({type:'board',id:b.id,title:b.name,text:b.elements.filter(e=>!e.isDeleted).map(e=>e.text||e.originalText||'').join('\n'),sources:b.sources})),
    ...(db.officeFiles||[]).map(f=>({type:'office',id:f.id,title:f.name,text:f.text||'',sources:f.sources})),
    ...(db.projectFiles||[]).flatMap(f=>!['ready','partial'].includes(f.index?.status)?[]:(f.chunks?.length?f.chunks:[{text:f.text||''}]).map(c=>({type:'project',id:f.id,title:f.name,version:f.version,page:c.page,slide:c.slide,bbox:c.bbox,elementId:c.elementId,sheet:c.sheet,indexStatus:f.index.status,text:c.text,sources:[]})))];
  return items.filter(x=>terms.every(t=>(x.title+' '+x.text).toLocaleLowerCase().includes(t))).map(x=>{
    const at=x.text.toLocaleLowerCase().indexOf(terms[0]);const start=Math.max(0,at-45);return {...x,text:undefined,score:terms.reduce((n,t)=>n+(x.title.toLocaleLowerCase().includes(t)?10:0)+(x.text.toLocaleLowerCase().split(t).length-1),0),snippet:x.text.slice(start,start+500)};
  }).sort((a,b)=>b.score-a.score).slice(0,500);
}
