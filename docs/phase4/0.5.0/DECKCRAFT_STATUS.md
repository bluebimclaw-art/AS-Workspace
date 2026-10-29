# DeckCraft 為何仍是試驗功能

「試驗」指本平台目前的接入及驗收程度，並非斷言 DeckCraft 上游只能做簡單簡報。已核對 [上游 v0.10.0](https://github.com/storytold/deckcraft/releases/tag/v0.10.0) 有 Web 版本，但本輪沒有擴展 DeckCraft。

本平台現有 `server/office.mjs` 只接 `new_presentation`、單張 `slide.new`、保存 PPTX、重開檢查文字及渲染第一張圖。介面限800字並要求確認試驗功能。這能證明單張文字投影片的最小流程，不能證明公司多頁簡報、圖片／圖表／母片、中文排版、PPTX 相容性或完整編輯器已可用。

升級為常用功能前，至少要完成：

1. 真正 Web 編輯器與共用 PPTX、檔案鎖、版本、viewer 及隊列整合。
2. 多張文字＋圖片＋圖表範本，保存、重開後核對頁數、內容及物件位置。
3. 所有投影片 PNG / PDF 預覽逐頁檢查，實際 PowerPoint 或公司指定閱讀器驗收。
4. Mac / Windows、模型切換及失敗復原測試；AI 起草與實際檔案修改分開確認。

目前先完成 PdfCraft／WordCraft，再以同一套共用檔案與任務合約整合 DeckCraft，能減少重複開發。上游具備某功能，不等於平台已接駁或本公司文件已驗收通過。
