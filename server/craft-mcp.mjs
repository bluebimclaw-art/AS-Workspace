import {spawn} from 'node:child_process';

// One short-lived headless server per job. No shell and no arbitrary browser-supplied commands.
export class CraftMcp {
  constructor(command,args,{cwd,timeoutMs=120000,env={}}={}) {
    this.pending=new Map();this.id=0;this.buffer='';this.timeoutMs=timeoutMs;
    this.child=spawn(command,args,{cwd,shell:false,windowsHide:true,env:{...process.env,...env,WORDCRAFT_NO_PREFS:'1',GRIDCRAFT_NO_PREFS:'1',DECKCRAFT_NO_PREFS:'1',DECKCRAFT_NO_RECOVERY:'1',DECKCRAFT_NO_AUDIO:'1'}});
    this.child.stdin.on('error',()=>{});
    this.child.on('error',e=>this.fail(new Error(`工具無法啟動：${e.code||e.message}`)));
    this.child.on('exit',code=>this.fail(new Error(`工具程序已結束 (${code})`)));
    this.child.stderr.on('data',()=>{}); // Never return raw process environment/logs to the browser.
    this.child.stdout.setEncoding('utf8');
    this.child.stdout.on('data',chunk=>{try{
      this.buffer+=chunk;if(this.buffer.length>20_000_000)throw new Error('MCP 回應過大');
      let n;while((n=this.buffer.indexOf('\n'))>=0){const line=this.buffer.slice(0,n);this.buffer=this.buffer.slice(n+1);if(!line.trim())continue;
        const m=JSON.parse(line),p=this.pending.get(m.id);if(!p)continue;clearTimeout(p.timer);this.pending.delete(m.id);
        if(m.error)p.reject(new Error(m.error.message||'MCP 錯誤'));else p.resolve(m.result);
      }
    }catch(e){this.fail(e);this.close();}});
  }
  fail(e){this.failure=e;for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e);}this.pending.clear();}
  request(method,params={}) {
    if(this.failure)return Promise.reject(this.failure);
    return new Promise((resolve,reject)=>{const id=++this.id,timer=setTimeout(()=>{this.pending.delete(id);reject(new Error('工具逾時；任務未自動重送'));this.close();},this.timeoutMs);
      this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
  }
  async init(){await this.request('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'company-platform',version:'0.2.0'}});this.child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');return this.request('tools/list');}
  async call(name,args={}){const r=await this.request('tools/call',{name,arguments:args});if(r.isError)throw new Error((r.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n').slice(0,1500)||'工具執行失敗');return r;}
  close(){this.fail(new Error('MCP session 已關閉'));this.child.stdin.end();this.child.kill();}
}
export function resultText(r){return (r.content||[]).filter(c=>c.type==='text').map(c=>c.text).join('\n');}
