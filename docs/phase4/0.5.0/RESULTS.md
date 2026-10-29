# 第④階段 0.5.0 實測及交接

本輪在獨立 Company-AI-Platform-PoC 完成 PdfCraft／WordCraft 真正 Web 編輯器接入及主要工作流程；不再只是背景文字輸入框。只改新平台，沒有修改舊平台、Mac 運行中的4317／4318、Hermes 或 Ollama。

「完整編輯器」指嵌入真正上游 Web app，保留其 ribbon、工具面板及命令；不代表上游所有功能、Microsoft Office 相容性、OCR 或數碼簽章已全部驗收。

## 已實作

- PdfCraft 0.13.0-cjk1：完整頁面／編輯／註記等上游介面，直接開啟共用 PDF、保存新版本及釋放編輯鎖；補入 OFL 繁體 fallback，修正中文檔名方框。
- WordCraft 0.10.0-host1：真正 ribbon／頁面編輯器，新增嚴格同源 host bridge，開啟共用文件、Save 回版本庫、不同格式另存；保留中文編輯、格式、表格等上游介面。
- 兩者沿用共用資料、登入角色、檔案 lease、舊版本、SHA-256、搜尋及右側 AI；未保存／保存失敗時阻止離開，保留待保存內容及備份操作。
- Office 與 AI 共用 FIFO、重複提交識別、per-user 配額、queued 取消、失敗續行與重啟 interrupted。來源按提交時版本固定，輸出新檔並記錄來源；分拆結果一次註冊，避免部分輸出先可見。
- PDF 背景：合併、抽頁、按頁數分拆、旋轉、倒序、刪頁、優化、OpenDataLoader 索引。無較小優化結果時清楚說明，不聲稱已壓縮。
- Word 背景：自由文字、報價單／事故報告待填範本、文字索引、轉 DOCX／PDF、副本式第一處文字替換。範本不編造價格及事實。
- viewer 不載入可保存的編輯器；可讀同來源版本的已轉出 PDF 或索引文字、下載原檔，不能保存、索引或提交 Office／AI。瀏覽器本機註記不會保存回平台。
- 共用檔案支援 DOCX、PDF、ODT、RTF、TXT、MD、HTML、TEX、PNG、DOTX；舊 DOC 僅匯入。背景核心以 DOCX／PDF 作輸出。單檔5MB，分拆最多100份。其他格式及巨集不列為已完成。
- 大型 WASM 提供 gzip 與內容雜湊快取。Mac 安裝包附可攜 Web 成品、授權及每檔 hash，不需要在 Mac 編譯 Rust。

## 本輪實測

| 測試 | 結果及實際範圍 |
|---|---|
| Node 回歸 | 37/37：真實 HTTPS／獨立登入、權限、版本及鎖、來源快照、批次註冊、bridge 偽來源／超額保留、雙模型協定及 queue。AI 模型使用模擬 HTTP 服務。 |
| 真實 Office 流程 | 15/15：已安裝 PdfCraft／WordCraft MCP 真正開檔、替換、轉檔及上述 PDF 整理；錯頁失敗後下一項繼續；兩帳戶共用 AI／Office FIFO、重複提交、來源更新後仍用提交版本。 |
| 共用資料／搜尋 | 14/14：原 GridCraft 公式／重開／來源雜湊、真實 Word PDF 中文、OpenDataLoader 頁碼／bbox、掃描頁 needs-ocr、損壞 PDF；兩個 Office WASM 的 MIME、gzip、immutable cache 及 binary 驗證。 |
| Word Chrome GUI | 中文粗體新增→Save v2→關閉重開；插入2×2表格並保存v3；實際 DOCX ZIP/CRC、文字、粗體、表格及所有原版本 hash 通過。GUI 提交 v3 轉 PDF 成功，表格 PDF 已逐頁檢視。 |
| PDF Chrome GUI | Word 轉出的同一共用 PDF 在 PdfCraft 讀取；中文檔名正常。Organize pages 旋轉90°→Save v2→關閉重開。解析確認v1為0°、v2為90°，兩版本hash均正確，中文保留。 |
| viewer Chrome GUI | 真正顯示對應 Word v3 的轉檔 PDF v1；上載、索引、Office 提交停用，填入非空白問題後 AI 提交仍停用。後端相應POST回403。 |
| viewer 實際下載 | 支援的 downloadMedia 成功下載 DOCX v3，6,955 bytes；SHA-256 `1bd30689ab8910b55818513f833fddc7d645dabc153d68645bdba53ecfff8f21` 與伺服器一致，ZIP/中文/表格核對通過。但下載工具約957秒才回傳，等待來源未定位，不是一般下載速度量測。 |
| PDF 視覺 QA | 4份合成PDF、共6頁均渲染及目視檢查，中文、粗體、表格、頁序及旋轉符合本輪樣本。不是複雜公司文件相容性認證。 |
| 依賴審計 | 0 critical / high / moderate；4 low。 |

證據：本目錄 JSON 與合成截圖；完整原始日誌及本機資料未發布。乾淨解壓 npm ci／build／test 的結果另外附於 Release validation JSON；發布及 ZIP 校驗不代表 Mac 實機成功。

## 未完成及需要使用者驗收

- Mac 0.5.0 Chrome／Safari、新版 Windows→Mac 跨機、真實 Ollama／批准雲端生成、5–10人吞吐及長時間負載。
- OCR 模型／掃描件完整識別、數碼簽章與信任、加密 PDF 背景處理、印表機、Zotero／聽寫／郵件合併等依賴功能；沒有把工具面板存在當作成功。
- 所有上游命令、所有匯入匯出格式、複雜 DOCX／PDF、圖片、修訂／註解／公式及大型文件的兼容矩陣；上游全套原生 CI 未跑，本輪測的是平台及 Web 針對性整合。
- 普通自動點擊下載與下載工具延遲原因，仍需人手下載比較及瀏覽器診斷。沒有降低安全設定或繞過登入。
- 香港地區字形、生僻字及所有字重仍未完整驗收。Word 使用 Noto CJK SC；PDF UI 用 LXGW WenKai TC。既有 PDF 優先使用其內嵌字型。
- 備份／恢復演練、容量配額、多人即時協作、正式部署切換。此版仍用編輯鎖而非同一文件多人同時編輯。

請按 [USER_TEST.md](USER_TEST.md) 驗收；Mac 助手用根目錄 [MAC_INSTALL_050_PROMPT.md](../../../MAC_INSTALL_050_PROMPT.md)，先在新資料夾／4320並行，不覆蓋現有服務。

DeckCraft 為何仍試驗見 [DECKCRAFT_STATUS.md](DECKCRAFT_STATUS.md)；效果圖候選研究見 [INFINITE_CANVAS_RESEARCH.md](INFINITE_CANVAS_RESEARCH.md)。infinite-canvas 沒有在本輪安裝或接公司模型。
