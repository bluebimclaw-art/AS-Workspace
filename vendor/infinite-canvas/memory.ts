// Company build: opaque sandbox cannot persist credentials or project data in browser storage.
export const stores = new Map<string, Map<string, unknown>>();
function instance(storeName='app_state') {let map=stores.get(storeName);if(!map){map=new Map();stores.set(storeName,map);}return {
 async getItem<T>(key:string){return (map!.get(key)??null) as T|null;},async setItem<T>(key:string,value:T){map!.set(key,value);return value;},async removeItem(key:string){map!.delete(key);},async clear(){map!.clear();},async keys(){return [...map!.keys()];},async length(){return map!.size;},async iterate<T,U>(fn:(value:T,key:string,index:number)=>U){let i=0;for(const [k,v] of map!){const result=fn(v as T,k,++i);if(result!==undefined)return result;}},config(){return true;},ready(){return Promise.resolve();},createInstance(options:{storeName?:string}){return instance(options.storeName);}
};}
export default instance();
