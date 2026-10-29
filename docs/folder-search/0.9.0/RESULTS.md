# v0.9.0 trial：資料夾搜尋中心驗證

日期：2026-10-25，Windows 開發機，Node 24.14.1。此報告區分實際處理、模擬模型與未完成項；不代表 Mac／公司環境已部署。

## 已交付

| 能力 | 本輪範圍 |
| --- | --- |
| 來源管理 | Admin 指定伺服器絕對目錄、准用帳戶、雲端批准；設定版本衝突保護 |
| 資料夾瀏覽 | 來源／子目錄瀏覽、上一層、類型篩選、搜尋結果顯示所在目錄及複製伺服器路徑 |
| 搜尋 | 檔名／內容／兩者、.pdf／.xls／.xlsx 等類型；PDF 頁碼與 bbox 保留、命中頁預覽入口 |
| 內容 | PDF 文字層、UTF-8 TXT／MD／CSV；其他格式只納入檔名，不冒稱內容已讀 |
| OCR | 本機 Tesseract.js 7，固定 eng／chi_tra／chi_sim 模型；掃描 PDF 缺文字頁才 OCR，圖片可 OCR |
| 索引 | 手動背景建立／更新；SHA256 重用、變更重建、刪除移除；錯誤診斷，不改原檔 |
| AI | 選用左下角模型；AI 關鍵詞擴展→本機檢索→最多12段引用問答，無 embedding；沒有資料不編答案 |
| 權限與隊列 | 程式授權＋來源帳戶白名單；viewer 不可提交；AI／索引沿用公司佇列、配額及執行前撤權檢查；來源批准更改後舊任務結果不再提供 |

來源、索引與文件片段不透過共用 /api/state 洩露；只有獲批准的搜尋／讀取 API 才可取得。雲端需公司政策、provider 與來源均批准；沒有自動轉雲端。原始檔不寫入，OCR 產物只在平台暫存，不向來源加入 OCR 文字層。

## 實測證據

- `npm test`：86/86 通過，0 failed／skipped。覆蓋來源 ACL、direct API、viewer、路徑 traversal、symbolic／hard link、檔案類型、變更／刪除、索引重用、來源撤權、狀態隱私、MCP 及既有應用回歸。
- `npm run build`：通過。畫面未經 GUI 操作驗收，不能用 build 代替。
- `npm run company:regression`：8項真實 Grid／Word／PDF／Deck、HTTPS／10個合成帳戶、重啟及備份回復通過。這8項刻意用歷史 projects 相容模式，**不是**新版單一空間／搜尋 GUI 的驗收。
- `npm run search:doctor`：Windows Java／pdftoppm／3種 OCR 語言均就緒。本機 Poppler 來自現有 runtime，不代表部署機已安裝。
- `npm run search:smoke`：新公司單一空間模式，登入及背景隊列 HTTP 實測。真正 Java/OpenDataLoader 抽取第1頁文字，OCR 後命中混合 PDF 第2頁；PNG 中英辨識能找出「香港」。3份合成原檔 hash 不變，重複索引重用3檔。
- 小樣本首次 PDF 索引約1.04秒、加入 OCR 約2.55秒；只是3份合成資料的開發機測量，不推算公司效能或準確率。
- AI：Ollama 與 OpenAI-compatible、所選 model ID、來源批准雲端／地端、引用頁碼均用**合成 HTTP 模型端點**驗證；真正 LLM／雲端 key 未測，不宣稱推理品質通過。
- 依賴 audit：0 critical／high／moderate，4 low（既有 Excalidraw／Mermaid／KaTeX 依賴鏈）；沒有為消除 low 強制降級既有編輯器。

`synthetic-http-ocr.json` 是去敏的真實 PDF／OCR HTTP 測試摘要；測試文件以 reviewed base64 fixture 提交，沒有公司文件、帳戶密碼、私鑰或原始本機 log。source ZIP 的完整性、乾淨 npm ci／build／test 結果以 release 隨附 `central-package-validation.json` 為準；不是 Mac 部署證據。

## 明確限制／未完成

1. Mac 真機、Windows→Mac 新版 LAN／HTTPS、PDF 預覽 GUI 及跨帳戶瀏覽器驗收未完成。App 本輪回報禁止本機瀏覽器控制，沒有繞過。
2. 未接每位員工 PC 的本機 Connector；只讀平台伺服器或已掛載 NAS。網頁不直接啟動 Explorer／Finder，複製的伺服器路徑未必能在客戶端開啟。
3. `.xls/.xlsx/.doc/.docx/.pptx` 等外部來源文件本輪只搜檔名；既有平台匯入文件搜尋保留，尚未接到外部目錄內容解析。
4. 沒有 embedding／向量庫／reranker，沒有背景 watcher／排程自動同步、日期篩選或 OCR bbox 高亮。更新索引需 Admin 手動提交。
5. 小樣本 OCR 命中不是中文／工程圖準確率認證；低解析、手寫、旋轉、複雜表格、加密 PDF、NAS 斷線及惡意文件隔離仍需專項驗證。
6. 試點限制：20來源；每來源最多3000檔、總文字500萬字元；每檔32 MiB／25萬字元；OCR 最多前30頁、整個 OCR 階段120秒；每層瀏覽1000項、搜尋100個段落、AI最多12個片段。部分／錯誤需看狀態及診斷。
7. 索引與 AI 共用單一執行隊列；大批 OCR 會延後聊天任務。尚未做5–10人公司資料量壓測、優先級或獨立 OCR worker pool。搜尋為索引線性掃描，未宣稱大型企業搜尋效能。
8. 資料來源 ACL 是平台帳戶白名單，並非 NTFS／AD 身分模擬；檔案系統由平台服務帳戶讀取。拒絕連結並做 canonical path 檢查，但仍需受管理的來源目錄／最小 OS 權限；未宣稱抵禦擁有伺服器檔案系統修改權限的惡意管理員競態。
9. 這版包含取消多項目切換的既有增量；不自動合併歷史內容。部署只用新目錄／新 data，現有 Mac、舊平台、Hermes、Ollama 及 Revit 均未改。

## 下一步

用 MAC_INSTALL_090_PROMPT.md 在 Mac 新目錄驗證真實 Ollama／OCR，然後一次過做人手 GUI／Windows 跨機測試；再處理 NAS／容量與 Office 內容解析。Revit Windows 本機唯讀保持已驗成果，遠端 Connector／模型寫入仍待後續。
