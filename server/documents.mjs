import {Document,Packer,Paragraph,HeadingLevel,TextRun} from 'docx';
export async function exportDocx(doc,store) {
  const children=[new Paragraph({text:doc.title,heading:HeadingLevel.TITLE}),...doc.body.split('\n').map(text=>new Paragraph({children:[new TextRun(text)]})),new Paragraph({text:'來源資料',heading:HeadingLevel.HEADING_1}),...doc.sources.map(s=>new Paragraph(`${store.asset(s.assetId).name} | asset:${s.assetId} | version:${s.version}`))];
  return Packer.toBuffer(new Document({sections:[{children}]}));
}
