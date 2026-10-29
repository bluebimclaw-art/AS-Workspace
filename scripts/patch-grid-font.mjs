import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
// Run against the pinned upstream checkout, never against a user's workbook.
export async function patchGridFont(source,font){
 const bytes=await readFile(font),sha=createHash('sha256').update(bytes).digest('hex');
 if(sha!=='2c76254f6fc379fddfce0a7e84fb5385bb135d3e399294f6eeb6680d0365b74b')throw Error('Unverified CJK font');
 const target=path.join(source,'crates/ui-egui/src/theme.rs');
 const before='fn load_fallback(_fonts: &mut FontDefinitions, _han: HanOrder) -> Vec<String> {\n    Vec::new()\n}';
 const after=`fn load_fallback(fonts: &mut FontDefinitions, _han: HanOrder) -> Vec<String> {
    // Company platform patch: the WebAssembly sandbox has no system CJK fonts.
    // Noto Sans CJK SC Regular, unmodified, SIL OFL 1.1; see bundled OFL.txt.
    let key = "platform-noto-cjk".to_string();
    let data = FontData::from_static(include_bytes!(env!("PLATFORM_CJK_FONT")));
    fonts.font_data.insert(key.clone(), Arc::new(data));
    vec![key]
}`;
 let text=await readFile(target,'utf8');if(!text.includes(after)){if(text.split(before).length!==2)throw Error('Upstream font patch no longer matches');text=text.replace(before,after);await writeFile(target,text);}
 return {source,font,sha256:sha};
}
if(process.argv[1]&&path.resolve(process.argv[1])===import.meta.filename)console.log(await patchGridFont(path.resolve(process.argv[2]),path.resolve(process.argv[3])));
