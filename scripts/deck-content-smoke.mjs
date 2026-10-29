import path from 'node:path';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import {Office} from '../server/office.mjs';
import {Store} from '../server/store.mjs';
import {resultText} from '../server/craft-mcp.mjs';
const dir=path.resolve('evidence/deck-content');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'synthetic.png'),Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAlklEQVR4nO3asQ2EUADDUGMxBCvSMAwNK7LFZwKqK8AnXpsmUtpMYwzKJE7iJE7iJE7iJG6+C5Zt5WXO/fjDBSRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRO4iRu+o6vD5M4iZM4ifPpAr+6ALOECXv2x41yAAAAAElFTkSuQmCC','base64'));const office=await new Office(await new Store(dir).init()).init();const {m}=await office.session('deckcraft',dir),call=async(name,args={})=>JSON.parse(resultText(await m.call(name,args)));
try{
 await call('new_presentation',{blank:true});
 await call('add_slide',{layout:'titleOnly',title:'內容保存驗收'});
 await call('add_shape',{preset:'roundRect',x:60,y:140,w:250,h:70,text:'繁體中文形狀',fill:'#176d68'});
 await call('insert_table',{rows:2,cols:2,data:[['項目','狀態'],['合成資料','待覆核']],x:340,y:140,w:500,h:150});
 await call('add_slide',{layout:'titleOnly',title:'圖表及圖片'});
 await call('insert_chart',{type:'column',title:'合成測試數據',categories:['A','B'],series:[{name:'測試',values:[2,3]}]});
 await call('insert_picture',{path:path.join(dir,'synthetic.png'),name:'synthetic.png',x:850,y:100,w:20,h:20});
 const target=path.join(dir,'rich.pptx');await call('save_presentation',{path:target});await call('open_presentation',{path:target});
 const info=await call('inspect_document'),slides=[];assert.equal(info.slides.length,2);for(let i=0;i<2;i++)slides.push(await call('inspect_slide',{index:i}));const text=JSON.stringify(slides);for(const s of ['繁體中文形狀','待覆核','合成測試數據'])assert.ok(text.includes(s));assert.ok(text.includes('picture'));assert.ok(text.includes('table'));assert.ok(text.includes('chart'));
 await JSZip.loadAsync(await readFile(target),{checkCRC32:true});await call('export',{path:path.join(dir,'rich.pdf')});
 await writeFile(path.join(dir,'result.json'),JSON.stringify({passed:true,slides:2,shape:true,table:true,chart:true,picture:true,reopened:true,crc:true}));console.log('PASS native picture, table, chart, Chinese shape; PPTX save/reopen CRC; PDF export');
}finally{m.close();}
