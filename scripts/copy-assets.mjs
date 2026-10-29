import {cp,mkdir,access,readFile} from 'node:fs/promises';
try{await access('public/gridcraft/gridcraft-web-0.11.1-cjk1/index.html');}catch{throw new Error('GridCraft Web 未就緒；先執行 npm run grid:install，或使用包含 Web 編輯器的0.3部署包');}
for(const app of JSON.parse(await readFile('config/office-web.json','utf8')))await access(`public/office/${app.folder}/index.html`);
await access('public/canvas-web/platform-build.json');
await mkdir('public/excalidraw-assets',{recursive:true});
await cp('node_modules/@excalidraw/excalidraw/dist/prod/fonts','public/excalidraw-assets/fonts',{recursive:true});
console.log('Excalidraw fonts copied locally');
