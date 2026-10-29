import {bind,request,notify} from './rpc';
// Upstream preference stores expect Web Storage; provide volatile per-frame stores before imports.
for(const name of ['localStorage','sessionStorage']){const values=new Map<string,string>();Object.defineProperty(window,name,{value:{get length(){return values.size;},key:(i:number)=>[...values.keys()][i]??null,getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,String(value)),removeItem:(key:string)=>values.delete(key),clear:()=>values.clear()},configurable:false});}
// The frame has an opaque origin. Only the direct parent can transfer this private channel.
let initialized=false;
window.addEventListener('message',async e=>{if(initialized||e.source!==parent||e.data?.type!=='as-canvas:init'||!e.ports[0])return;initialized=true;bind(e.ports[0]);try{const {mount}=await import('./mount');await mount(e.data.snapshot,e.data.providers,e.data.selected);notify('ready');}catch(e){notify('failed',{error:String(e)});}});
parent.postMessage({type:'as-canvas:boot'},'*');
