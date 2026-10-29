import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
const source=path.resolve(process.argv[2]),file=path.join(source,'apps/deckcraft-web/src/web.rs');
let s=await readFile(file,'utf8');
if(!s.includes('mod platform_host;')){
 s=s.replace('use deckcraft_engine::Session;','mod platform_host;\nuse deckcraft_engine::Session;');
 s=s.replace('let inbox: Inbox = Inbox::default();','let inbox: Inbox = Inbox::default();\n                    platform_host::listen(cc.egui_ctx.clone());');
 s=s.replace('self.app.logic(ctx);','platform_host::drain(&mut self.app, &self.inbox);\n        self.app.logic(ctx);\n        platform_host::dirty(self.app.session.active().is_some_and(|d| d.is_dirty()));');
 s=s.replace('self.app.ui(ui);','self.app.ui(ui);\n        platform_host::dirty(self.app.session.active().is_some_and(|d| d.is_dirty()));');
 const hook='fn download(path: &str, bytes: &[u8]) -> Result<(), String> {';
 if(!s.includes(hook))throw Error('Deck save hook changed');
 s=s.replace(hook,hook+'\n    if let Some(result) = platform_host::save(path, bytes) { return result; }');
 await writeFile(file,s);
 const cargo=path.join(source,'apps/deckcraft-web/Cargo.toml');await writeFile(cargo,(await readFile(cargo,'utf8')).replace('"CssStyleDeclaration"','"CssStyleDeclaration", "MessageEvent"'));
 const fonts=path.join(source,'crates/fonts/build.rs');await writeFile(fonts,(await readFile(fonts,'utf8')).replace('("BIZ UDPGothic", "Regular") |','("BIZ UDPGothic", "Regular") | ("LXGW WenKai TC", "Regular") |'));
}
if(!s.includes('platform_host::checkpoint')){
 s=(await readFile(file,'utf8')).replace('self.app.ui(ui);','self.app.ui(ui);\n        platform_host::checkpoint(&self.app);');await writeFile(file,s);
}
// Browser default Save must retain PPTX in the shared version store, rather than
// silently create a differently formatted native file. Native desktop unchanged.
const uiFile=path.join(source,'crates/ui-egui/src/lib.rs');let ui=await readFile(uiFile,'utf8');
ui=ui.replaceAll('self.save_as_dialog("deckcraft")','self.save_as_dialog(if cfg!(target_arch = "wasm32") { "pptx" } else { "deckcraft" })');await writeFile(uiFile,ui);
await mkdir(path.join(source,'apps/deckcraft-web/src/web'),{recursive:true});
const bridge=await readFile(path.resolve(import.meta.dirname,'../vendor/deckcraft/platform_host.rs'),'utf8');
await writeFile(path.join(source,'apps/deckcraft-web/src/web/platform_host.rs'),bridge);
console.log('Deck same-origin bridge + open-licensed TC font filter patched');
