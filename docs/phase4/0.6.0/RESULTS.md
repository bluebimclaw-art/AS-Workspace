# AS Workspace v0.6.0 驗證紀錄

這版將側欄、登入頁、主頁標題改為 **AS Workspace**，並把 DeckCraft 從單張文字試驗介面接入與 Word／PDF 相同的真正 Web 編輯器。只改獨立新平台；沒有改 Mac 舊平台、Hermes、Ollama、系統憑證及防火牆。

## 實作

- DeckCraft v0.10.0 固定來源，Web 同源父框架橋接、PPTX／原生 DeckCraft 共用保存、版本庫、編輯鎖、5MB限制及錯誤保留。Web預設 Save 為 PPTX。父框架收到成功保存後才 ACK；對應快照之後的新修改保留 dirty。
- 完整上游 Web 編輯器入口：多頁、文字、形狀、圖片、表格、圖表等。介面存在不等於每項功能已驗收；動畫、影音及複雜版面待測。
- 背景起草（以 `---` 分頁，最多30張）、PPTX重開／PDF轉出、逐張文字索引及搜尋，與AI／Office共用FIFO；來源版本固定，輸出新檔並記錄來源。
- viewer 不載入可寫編輯器，可下載原檔及閱讀成員已轉出的對應版本PDF，不能保存、取得編輯鎖、索引或提交Office／AI。
- 不改模型協定和左下模型選擇；沒有自動轉雲端。Windows合成預覽模型尚未接通。

## 已實測

| 項目 | 結果及範圍 |
|---|---|
| Node回歸 | 38/38：登入、CSRF、Host、角色、lease／版本、共用隊列、模型路由（模擬）、橋接拒絕異源及Deck格式驗證 |
| Deck真實原生及HTTP | 7/7：三張中文簡報、PPTX ZIP CRC及順序、重開、PDF、逐張搜尋、AI上下文（推理模擬）、viewer、雙帳戶FIFO／衝突／不可變來源及參數限制 |
| 豐富內容原生測試 | 自行生成64×64 PNG、中文形狀、2×2表格、圖表，PPTX保存重開CRC及內容核對、PDF輸出通過。初次無效1×1PNG被拒絕；更換有效合成PNG後通過，沒有放寬解析器 |
| 既有Word／PDF | 15/15真實Craft及HTTP回歸通過，包括中文轉檔、合併、抽頁、旋轉、倒序、刪頁、分拆、優化、OpenDataLoader、viewer及共用隊列 |
| PDF視覺核對 | 三頁文字PDF及兩頁豐富內容PDF，全5頁render後目視核對：中文字、形狀、表格、圖表及圖片均可見。這是原生輸出，不代表Web已通過 |
| Web建置／傳輸 | DeckCraft release WASM 50,556,784 bytes；二進位驗證、HTTP MIME／gzip／immutable資產及整個Vite建置通過。共用搜尋回歸15/15通過（含新增Deck資產） |
| npm audit | 0 critical／high／moderate，4 low |

Web資產、乾淨封裝及其餘可重現檢查的最終機器結果見同目錄 `test-summary.json`；沒有記錄的項目不能視為已通過。

## 未完成及限制

- 本輪瀏覽器工具回報 **Local browser use is disabled in Work settings**；Chrome和內建瀏覽器均不能操作。因此 **DeckCraft Web實際啟動、中文顯示、互動編輯、Save→版本→關閉重開、未保存保護、成功ACK、失敗後保留及viewer畫面仍待瀏覽器驗收**。Rust編譯、WASM二進位驗證及HTTP傳輸不能代替它。
- Mac v0.6.0、Safari、Windows→Mac跨機及真實Ollama／雲端推理未測；未驗證5–10人長時間負載及正式備份還原。
- 未完成全部PowerPoint相容性、動畫、影音、投影片放映、母片／主題、香港罕用字及全部輸出格式驗收。原生測試不等於瀏覽器每項均相同。
- 背景只公開經allowlist的建立／轉檔／索引，沒有把任意MCP／命令交給瀏覽器或模型。AI仍提供問答，不自動改簡報。
- 5MB共用檔案及索引最多300張／200,000字元限制；沒有多人同時編輯同一簡報。
- 原生DeckCraft格式支援結構驗證；正式跨工具交收優先PPTX／PDF。沒有執行上游完整原生CI。
- 上一版瀏覽器自動下載延遲仍未定位；本輪下載hash測試為HTTP內容核對，不能聲稱瀏覽器已落地保存。

Mac安裝用根目錄 `MAC_INSTALL_060_PROMPT.md`，新0.6.0資料夾、獨立4322，先並行測試，不切換原4317。這是待GUI／Mac驗收的prerelease，不能稱正式全面驗收完成。
