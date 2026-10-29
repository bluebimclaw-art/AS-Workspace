import {mkdir, readFile, writeFile, rename} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';

export class Store {
  constructor(root,{sqlite=false}={}) { this.root=root; this.tail=Promise.resolve(); this.sqlite=sqlite; }
  async init() {
    await mkdir(this.root,{recursive:true});
    if(this.sqlite){const {DatabaseSync}=await import('node:sqlite');this.sql=new DatabaseSync(path.join(this.root,'workspace.sqlite'));this.sql.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS snapshot (id INTEGER PRIMARY KEY CHECK(id=1), json TEXT NOT NULL)');const row=this.sql.prepare('SELECT json FROM snapshot WHERE id=1').get();if(row){this.db=JSON.parse(row.json);return this;}}
    try { this.db=JSON.parse(await readFile(path.join(this.root,'store.json'),'utf8')); }
    catch(e) { if(e.code!=='ENOENT') throw e; this.db={schemaVersion:1,assets:[],documents:[],boards:[],runs:[]}; await this.flush(); }
    return this;
  }
  async flush() {
    if(this.sql){this.sql.prepare('INSERT INTO snapshot VALUES(1,?) ON CONFLICT(id) DO UPDATE SET json=excluded.json').run(JSON.stringify(this.db));return;}
    const file=path.join(this.root,'store.json');await writeFile(file+'.tmp',JSON.stringify(this.db,null,2));
    // Windows virus scanners can briefly hold the destination. Retry only the atomic rename,
    // never replay the mutation or an external Office/model operation.
    for(let attempt=0;;attempt++){try{await rename(file+'.tmp',file);break;}catch(e){if(process.platform!=='win32'||!['EPERM','EBUSY','EACCES'].includes(e.code)||attempt>=4)throw e;await new Promise(r=>setTimeout(r,25*2**attempt));}}
  }
  mutate(fn) { const job=this.tail.then(async()=>{const result=await fn(this.db);await this.flush();return result;});this.tail=job.catch(()=>{});return job; }
  assets() {return this.db.assets;}
  asset(id) {const a=this.db.assets.find(x=>x.id===id);if(!a) throw Object.assign(new Error('找不到資產'),{status:404});return a;}
  async addAsset({name,text,kind='text'}) {
    if(typeof name!=='string'||!name.trim()||typeof text!=='string'||text.length>200000) throw Object.assign(new Error('名稱及文字必填，最多200,000字元'),{status:400});
    return this.mutate(db=>{const a={id:randomUUID(),version:1,name:name.trim(),kind,text,sha256:createHash('sha256').update(text).digest('hex'),createdAt:new Date().toISOString()};db.assets.push(a);return a;});
  }
  async saveDocument({title,body,sourceIds=[]}) {
    if(typeof title!=='string'||!title.trim()||typeof body!=='string'||!Array.isArray(sourceIds)) throw Object.assign(new Error('文件格式不正確'),{status:400});
    sourceIds.forEach(id=>this.asset(id));
    return this.mutate(db=>{const d={id:randomUUID(),title,body,sources:sourceIds.map(id=>({assetId:id,version:this.asset(id).version})),createdAt:new Date().toISOString()};db.documents.push(d);return d;});
  }
  async saveBoard({id,name,elements,files={},sourceIds=[],expectedVersion},actor) {
    if(typeof name!=='string'||!name.trim()||!Array.isArray(elements)||!Array.isArray(sourceIds)||!files||typeof files!=='object') throw Object.assign(new Error('白板格式不正確'),{status:400});
    sourceIds.forEach(id=>this.asset(id));
    // Assets are immutable; boards retain stable references, not copies masquerading as sources.
    return this.mutate(db=>{let b=db.boards.find(x=>x.id===id);if(id&&!b) throw Object.assign(new Error('找不到白板'),{status:404});const version=(b?.version||0)+1;
      if(b&&actor&&expectedVersion!==b.version)throw Object.assign(new Error('白板已有新版本，請保留內容並重新載入'),{status:409});
      const next={id:b?.id||randomUUID(),version,name,elements,files,sources:sourceIds.map(assetId=>({assetId,version:this.asset(assetId).version})),updatedAt:new Date().toISOString()};
      if(b) db.boards[db.boards.indexOf(b)]=next;else db.boards.push(next);return next;});
  }
}
