import {readFile,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
const source=path.resolve(process.argv[2]),file=path.join(source,'apps/wordcraft-web/src/web.rs');
let s=await readFile(file,'utf8');
if(!s.includes('mod platform_host;')){
 s=s.replace('mod font_store;','mod font_store;\nmod platform_host;');
 s=s.replace('let inbox: Inbox = Inbox::default();','let inbox: Inbox = Inbox::default();\n                    platform_host::listen(inbox.clone(), cc.egui_ctx.clone());');
 s=s.replace('on_dirty: Some(Box::new(move |d| dirty.set(d))),','on_dirty: Some(Box::new(move |d| { dirty.set(d); platform_host::dirty(d); })),');
 const hook='fn download(saves: &AsyncSaves, ctx: &egui::Context, path: &str, bytes: &[u8]) -> Result<(), String> {';
 if(!s.includes(hook))throw Error('Word save hook changed');
 s=s.replace(hook,hook+'\n    if let Some(result) = platform_host::save(path, bytes) { return result; }');
 await writeFile(file,s);
 const cargo=path.join(source,'apps/wordcraft-web/Cargo.toml');await writeFile(cargo,(await readFile(cargo,'utf8')).replace('"BeforeUnloadEvent"','"MessageEvent", "BeforeUnloadEvent"'));
 const fonts=path.join(source,'crates/fonts/build.rs');let f=await readFile(fonts,'utf8');f=f.replace('if wasm && !(*family == "BIZ UDPGothic" && *style == "Regular") {','if wasm && !((*family == "BIZ UDPGothic" || *family == "Noto Sans CJK SC") && *style == "Regular") {');await writeFile(fonts,f);
}
await copyFile(path.resolve(import.meta.dirname,'../vendor/wordcraft/platform_host.rs'),path.join(source,'apps/wordcraft-web/src/web/platform_host.rs'));
console.log('Word same-origin host bridge and OFL CJK build input patched');
