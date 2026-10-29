import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {putUser,readUsers,publicUser} from '../server/auth.mjs';
import {access} from 'node:fs/promises';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2),action=args[0],username=args[1],option=n=>args[args.indexOf('--'+n)+1];
const dataDir=path.resolve(root,process.env.POC_DATA_DIR||'data');
try{await access(path.join(dataDir,'company.sqlite'));throw new Error('公司模式已遷移帳戶至SQLite；請使用Admin UI管理。忘記管理員密碼請先停止平台，再用company:recover，不可修改舊users.json。');}catch(e){if(e.code!=='ENOENT')throw e;}
if(action==='list'){console.log(JSON.stringify((await readUsers(dataDir)).map(u=>({...publicUser(u),disabled:u.disabled})),null,2));process.exit(0);}
if(!['add','reset','disable'].includes(action)||!username)throw new Error('用法：npm run users -- add|reset|disable 帳戶 --role admin|member|viewer；或 list');
const old=(await readUsers(dataDir)).find(u=>u.username===username);
let password;
if(action!=='disable'){
 if(args.includes('--password-env')){const key=option('password-env');password=process.env[key];if(!password)throw new Error('密碼環境變數未設定');}
 else {
  if(!process.stdin.isTTY)throw new Error('請在互動終端輸入密碼；自動測試可用 --password-env 指定環境變數名稱');
  const hidden=label=>new Promise((resolve,reject)=>{process.stdout.write(label);let value='';process.stdin.setRawMode(true);process.stdin.resume();const end=()=>{process.stdin.setRawMode(false);process.stdin.off('data',read);process.stdin.pause();process.stdout.write('\n');};const read=buffer=>{for(const ch of buffer.toString()){if(ch==='\r'||ch==='\n'){end();resolve(value);return;}if(ch==='\u0003'){end();reject(new Error('已取消'));return;}if(ch==='\u007f'||ch==='\b'){value=value.slice(0,-1);}else if(ch>=' ')value+=ch;}};process.stdin.on('data',read);});
  password=await hidden('密碼（不顯示，最少12字元）：');if(password!==await hidden('再輸入一次：'))throw new Error('兩次密碼不同');
 }
}
const user=await putUser(dataDir,{username,password,role:args.includes('--role')?option('role'):old?.role||'member',name:args.includes('--name')?option('name'):old?.name||username,disabled:action==='disable',reset:action!=='add'});
console.log('帳戶已更新：'+user.username+' / '+user.role+'；沒有輸出密碼。');
