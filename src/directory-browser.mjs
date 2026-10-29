export function createBrowseGeneration() {
  let generation=0;
  return {next:()=>++generation,isCurrent:value=>value===generation,invalidate:()=>{generation++;}};
}
const names = new Intl.Collator(undefined, {numeric:true, sensitivity:'base'});
export function formatBytes(bytes, directory=false) {
  if (directory || typeof bytes!=='number' || !Number.isFinite(bytes) || bytes<0) return '—';
  const units=['B','KB','MB','GB','TB'];
  const unit=bytes===0 ? 0 : Math.min(Math.floor(Math.log(bytes)/Math.log(1024)),units.length-1);
  return `${Number((bytes/1024**unit).toFixed(1))} ${units[unit]}`;
}
export function folderBreadcrumbs(relative) {
  const segments=relative ? relative.split('/') : [];
  return segments.map((name,index)=>({name,relative:segments.slice(0,index+1).join('/')}));
}
export function visibleEntries(entries, filter='') {
  const query=filter.trim().toLocaleLowerCase();
  return entries.filter(e=>e.name.toLocaleLowerCase().includes(query)).sort((a,b) => Number(Boolean(b.directory))-Number(Boolean(a.directory)) || names.compare(a.name,b.name));
}
