# AS Workspace v0.9.0 trial — Mac mini 驗收（2026-10-25）

## 核心結果

- **已部署**：固定 v0.9.0 Release，tag 指向 `ee815fa486376b17675ba20c64a54317ce880d24`；ZIP SHA256 `40ae692cf6b7577605ec1769183172105b065ef945295e0e9afdaa96afaa988d`，與獨立 `.sha256` 及 validation JSON 一致。部署於 `/Users/aiden/Projects/Company-AI-Platform-PoC-0.9.0`，專屬 `data/`，外部合成來源在 `/Users/aiden/Projects/AS-Workspace-v090-Synthetic-Source`。
- **Mac 本機入口**：`http://127.0.0.1:4330/`，只監聽 loopback；核對時 health 200，回報 `0.9.0`。沒有 LAN HTTPS 入口，Windows 不能使用此網址。前景 `npm start` 運行，沒有設定開機自動恢復；結束後須重新核對 listener 和 health。
- **回歸**：Mac 首跑 `npm test` 為 85/86；兩項來源索引修補及一項版本標示修補後為 **87/87**。`npm run build`、`search:doctor`、`search:smoke` 通過。smoke 使用真正 PDF/OCR、模擬 LLM。
- **實際搜尋**：合成 `mixed.pdf` 第 1 頁文字、第 2 頁掃描 OCR、PNG「香港」命中；來源瀏覽、篩選、增量、過時內容拒絕、來源撤權及重啟保留均已在新服務測試。一次有效 JPEG 取代最初故意無效的圖片後，5 檔索引 0 錯誤；重索引重用 5 檔。
- **真實 Ollama**：現有 `0.34.0` 服務列出 `gpt-oss:20b`、`gpt-oss:20b-64k`。透過新平台 Admin provider 配置兩個 ID，沒有改 Ollama；兩名 member 的 `gpt-oss:20b` 任務及一次切換 `gpt-oss:20b-64k` 均真正生成成功，引用合成 PDF。沒有雲端 fallback。

## 環境與安裝證據

Mac 為 macOS 26.2／arm64、32 GiB RAM；本次實際程序使用 Node v26.10.0、npm 11.19.1、Temurin Java 17.0.21、Poppler `pdftoppm` 26.05.0、Tesseract.js 7.0.0。Node 26 高於隨包文件列明的 22.22+／24 LTS，雖然本次測試通過，仍不是該文件明列的 LTS 組合。Java 及 `pdftoppm` 引用 Mac 上既有檔案，後者位於 Codex bundled runtime cache；若該 cache 移動，需重新設定新平台的 `POC_PDFTOPPM_BIN`。未改系統 PATH／Java。

| 步驟 | 本輪結果 | 本機證據（不提交） |
| --- | --- | --- |
| `npm ci --ignore-scripts` | 通過；315 packages audited，4 low | `evidence/mac-2026-10-25/npm-ci.log` |
| `npm run build` | 通過，最後重建含正確 0.9.0 標示 | `evidence/mac-2026-10-25/build-ui-final.log` |
| `npm run search:ocr:setup`、`search:doctor` | 通過；Java、renderer、英／繁／簡 OCR ready | `evidence/mac-2026-10-25/ocr-setup.log`、`search-doctor-npm.log` |
| `npm test` | 首跑 85/86，最後 87/87、0 fail | `evidence/mac-2026-10-25/npm-test.log`、`npm-test-87.log` |
| `npm run search:smoke` | 通過；真正 Java PDF／OCR，LLM 為合成端點 | `evidence/mac-2026-10-25/search-smoke-npm.log` |

Release 的 `central-package-validation.json` 記錄 Windows 開發機結果，**不是**上述 Mac 數字。原始 ZIP、校驗檔及 validation JSON 保存在獨立 Downloads 目錄；沒有改 tag 或 Release。

## 本機 API／檔案實測

- 四個新合成帳戶：`searchadmin` admin、`search01`／`search02` member、`searchview` viewer。密碼只在新平台本機受限檔，未加入此報告。共用空間及來源維持 `local-only`、`dailyImages=0`。來源測試撤銷 `search02` 後已恢復三個測試使用者准用。
- 根目錄可見 `mixed.pdf`、`readme.txt`、`scan.png`、`subfolder`；進入子資料夾及回上一層成功。`.pdf`、`.xls` 篩選正確；啟用類型篩選時仍顯示可導航的資料夾。`.xls` 只驗證檔名，內容搜尋沒有誤命中。
- 不逐檔上載，直接索引外部合成來源。`ALPHA4827` 命中 `mixed.pdf` 第 1 頁，OCR 的 `4827` 命中同檔第 2 頁；`scan.png` 命中「香港」。頁碼與來源檔 SHA256 由測試程式核對。viewer 能下載 `readme.txt`，下載 SHA256 為 `30a8caa9667be99ab4a83af1d4b56e9267a11bee321ba2410e56372a84bd1df9`。
- 重複索引重用 5/5。修改 `readme.txt`、新增 `added.txt`、改名 `legacy.xls`、刪除合成 JPEG 後，舊文字在重建前已無過時命中；手動重建後新文字及新檔命中，舊檔名與已刪圖片不命中，5 檔／重用 2／0 錯誤。來源初始三份 fixture 的 SHA256 在第一次及重複索引後不變。
- 故意加入損壞的合成 PDF，兩次索引均顯示 1 個檔案錯誤，沒有把失敗快取成成功；移除後重建回 0 錯誤。這驗證明確錯誤診斷，不代表加密 PDF、所有損壞格式或大量文件都已驗。
- viewer 直接 API 建索引、提交 AI 回 403，member 管理來源被拒絕。撤銷 `search02` 的來源批准後，來源列表為空，直接搜尋／檔案讀取／已完成舊任務結果均回 404。平台重啟後帳戶、local-only、模型清單、索引、撤權狀態保留；之後恢復 `search02` 測試授權。

## 真實 Ollama／隊列

| 任務 | 結果 | 本輪耗時及引用 |
| --- | --- | --- |
| `search01`，`gpt-oss:20b` | queued → running → succeeded；同 requestId 重送同一 job | 43.63 秒；`mixed.pdf` 第 1 頁 |
| `search02`，`gpt-oss:20b` | queued → running → succeeded；不可讀 `search01` job（404） | 約 52.43 秒實際執行；第 1、2 頁 |
| `search01`，`gpt-oss:20b-64k` | queued → running → succeeded | 54.09 秒；第 1 頁 |

首兩項於 12:26:35 UTC 相差 2 毫秒提交；第一項 12:27:19 UTC 完成，第二項 11 毫秒後才開始。這支持一次只執行一項，兩項 wall time 約 96.28 秒。實際回答內容及精確時間見 `test-summary.json`；都是合成內容。一次無匹配字串問答仍真正生成，回答明確表示找不到該字串，但檢索附帶一段不相關引用，屬品質限制；直接內容搜尋該字串為 0 命中，沒有將此例列為嚴格無引用成功。

記憶體只作一次觀察：Mac 32 GiB；v0.9.0 Node RSS 約 20.5 MiB，Ollama 主程序 RSS 約 13.4 MiB；`/api/ps` 曾顯示載入 `gpt-oss:20b`、模型 `size_vram` 約 12.78 GB。這些是觀察點，不是 5–10 人容量或峰值認證。

## Mac GUI 與修補

Codex 內置瀏覽器在 Mac 以 `search01` 真正登入，操作來源、子資料夾、上一層、文字搜尋及 `mixed.pdf` 第 1 頁「預覽／引用」；選定 `gpt-oss:20b` 後從 GUI 提交 AI 搜尋，畫面顯示 queued → running → succeeded，回答引用 `mixed.pdf` 第 1 頁。viewer 另行登出／登入，唯讀提示、搜尋結果及 AI 按鈕保持停用均可見。嵌入的 PDF viewer 在此瀏覽器截圖呈黑色，**不能宣稱 PDF 頁面已視覺繪製成功**；一般 Chrome 仍需人手核對。未做 Windows GUI。

只修改新 v0.9.0 的三個程式檔，交接 PR 亦包含相同差異：

1. `server/directory-search.mjs`：以 canonical path 比較來源與平台／資料目錄，修復 macOS `/var` → `/private/var` 別名繞過；失敗抽取不可被下次索引重用。
2. `test/directory-search.test.mjs`：加入失敗抽取重試的回歸測試。
3. `src/Workbench.jsx`：側欄版本標示由 0.8.0 改為 0.9.0，重建後 GUI 已讀回確認。

## 未完成與限制

- **Windows／LAN HTTPS：未提供。** 本輪只綁 `127.0.0.1:4330` HTTP，沒有產生或改動 TLS／系統 CA／防火牆。Windows 不能直接使用此入口。
- 一般 Chrome 的 PDF 內嵌頁面繪製、GUI 另選檔、雙瀏覽器同時登入及 Windows 跨機：未測。Codex 內置瀏覽器只能證明上述 Mac GUI 操作。
- 真實雲端 AI／生圖未啟用，未下載模型；沒有 embedding、向量搜尋或 Office 舊格式內容抽取。
- 沒有公司文件、NAS 斷線、大樣本 OCR 品質、容量或長時間穩定性測試。測試只使用少量合成檔。
- 此服務沒有 LaunchAgent／自動啟動。最後唯讀檢查 v0.9.0 `127.0.0.1:4330` health 200／`0.9.0`，PID 89627 監聽；程序能否跨本輪持續須再次核對。當時舊 v0.8.0 的 4326 health 200，但舊 v0.4.1 的 4317 連線失敗；本輪沒有對它啟停或修改，原因未調查。

下一步：Windows 驗收前另行規劃受批准的 LAN HTTPS 入口；在一般 Chrome 核對 PDF 視覺預覽，再以獨立瀏覽器 profile 測 member/viewer GUI。勿把此 loopback HTTP 作跨機登入入口。
