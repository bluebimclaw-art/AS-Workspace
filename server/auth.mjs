import {scrypt,randomBytes,randomUUID,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
const derive=promisify(scrypt),fail=(message,status=401)=>Object.assign(new Error(message),{status});
export const publicUser=u=>({id:u.id,username:u.username,name:u.name,role:u.role});
export async function passwordHash(password,salt=randomBytes(24).toString('hex')){
 if(typeof password!=='string'||password.length<12||password.length>256)throw fail('密碼須為12至256字元',400);
 return {salt,hash:(await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024})).toString('hex')};
}
export async function readUsers(dataDir){try{return JSON.parse(await readFile(path.join(dataDir,'auth/users.json'),'utf8'));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
export async function putUser(dataDir,{username,password,role='member',name=username,disabled=false,reset=false}){
 if(!/^[a-z0-9][a-z0-9_.-]{2,39}$/.test(username||'')||!['admin','member','viewer'].includes(role)||typeof name!=='string'||name.length>100)throw fail('帳戶名稱、顯示名稱或角色不正確',400);
 const users=await readUsers(dataDir),old=users.find(u=>u.username===username);if(old&&!reset)throw fail('帳戶已存在，使用 reset 更新',409);if(!old&&reset)throw fail('帳戶不存在',404);
 const credentials=password?await passwordHash(password):old;if(!credentials)throw fail('必須提供密碼',400);
 const next={id:old?.id||randomUUID(),username,name,role,disabled,passwordVersion:(old?.passwordVersion||0)+1,salt:credentials.salt,hash:credentials.hash};
 if(old)users[users.indexOf(old)]=next;else users.push(next);
 const dir=path.join(dataDir,'auth');await mkdir(dir,{recursive:true});const file=path.join(dir,'users.json'),temp=file+'.'+randomUUID()+'.tmp';await writeFile(temp,JSON.stringify(users,null,2),{mode:0o600});await rename(temp,file);return publicUser(next);
}
export class Auth {
 constructor(dataDir,{secure=false,ttlMs=8*60*60*1000,idleMs=60*60*1000,usersReader,cookieName='trial_session'}={}){if(!/^[a-zA-Z0-9_]{1,60}$/.test(cookieName))throw Error('Cookie name invalid');this.cookieName=cookieName;this.root=dataDir;this.usersReader=usersReader||(()=>readUsers(dataDir));this.secure=secure;this.ttlMs=ttlMs;this.idleMs=idleMs;this.sessions=new Map();this.attempts=new Map();this.checking=0;}
 cookie(value,age=this.ttlMs/1000){return `${this.cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(age)}${this.secure?'; Secure':''}`;}
 async user(id){const u=(await this.usersReader()).find(u=>u.id===id&&!u.disabled);if(!u)throw fail('帳戶已停用或不存在');return u;}
 async login(username,password,address){
  if(typeof username!=='string'||username.length>40||typeof password!=='string'||password.length>256)throw fail('帳戶或密碼不正確');
  const now=Date.now();for(const[k,v]of this.attempts)if(v.until<=now)this.attempts.delete(k);
  const keys=[`ip:${address}`,`user:${address}:${username.toLowerCase()}`];if(keys.some((k,i)=>(this.attempts.get(k)?.count||0)>=(i?5:40)))throw fail('嘗試次數過多，請15分鐘後再試',429);
  if(this.checking>=4||this.attempts.size>5000)throw fail('登入繁忙，請稍後再試',429);
  this.checking++;
  try{
   const u=(await this.usersReader()).find(u=>u.username===username.toLowerCase()&&!u.disabled),salt=u?.salt||'0'.repeat(48);
   const candidate=await derive(password,salt,64,{N:32768,r:8,p:1,maxmem:64*1024*1024});
   if(!u||!timingSafeEqual(candidate,Buffer.from(u.hash,'hex'))){for(const k of keys){const prev=this.attempts.get(k);this.attempts.set(k,{count:(prev?.count||0)+1,until:prev?.until||now+15*60*1000});}throw fail('帳戶或密碼不正確');}
   this.attempts.delete(keys[1]);
   for(const[k,s]of this.sessions)if(s.expiresAt<=now||s.lastSeen+this.idleMs<=now)this.sessions.delete(k);
   if(this.sessions.size>=1000)throw fail('登入連線過多',429);
   const token=randomBytes(32).toString('base64url'),key=createHash('sha256').update(token).digest('hex'),session={id:randomUUID(),userId:u.id,passwordVersion:u.passwordVersion,csrf:randomBytes(32).toString('base64url'),expiresAt:now+this.ttlMs,lastSeen:now};this.sessions.set(key,session);return {user:publicUser(u),session,cookie:this.cookie(token)};
  }finally{this.checking--;}
 }
 async authenticate(req){
  const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(this.cookieName+'='))?.slice(this.cookieName.length+1);if(!token)throw fail('請先登入');
  const key=createHash('sha256').update(token).digest('hex'),s=this.sessions.get(key);if(!s||s.expiresAt<=Date.now()||s.lastSeen+this.idleMs<=Date.now()){this.sessions.delete(key);throw fail('登入已過期，請重新登入');}
  const user=await this.user(s.userId);if(user.passwordVersion!==s.passwordVersion){this.sessions.delete(key);throw fail('帳戶已更新，請重新登入');}s.lastSeen=Date.now();return {user:publicUser(user),session:s,key};
 }
 csrf(req,session){const value=req.headers['x-csrf-token'];if(typeof value!=='string'||Buffer.byteLength(value)!==Buffer.byteLength(session.csrf)||!timingSafeEqual(Buffer.from(value),Buffer.from(session.csrf)))throw fail('請更新登入狀態後再操作',403);}
 logout(key){this.sessions.delete(key);return this.cookie('',0);}
}
