# AS Workspace — private company pilot snapshot

目前公司 pilot：**0.11.0 + 正式後端／導航修正**。這是獨立匯出的程式庫，不是運行中的資料目錄；不含公司文件、用戶帳戶、資料庫、日誌、OAuth/API 憑證或 TLS 私鑰。

## 包含的目前功能
- 目前正式 server/src、依賴鎖檔、設定範例、啟動／安裝腳本及合成回歸測試。
- Word/PDF/Deck/Canvas 側欄切換不再強制先保存：未保存可明確選擇放棄或取消；真正保存／生成中暫阻。正常 Save、immutable 版本、權限及409衝突處理仍保留。
- Admin-only Codex 訂閱圖片 adapter（gpt-image-2）；專用 loopback8648 Worker 的原始碼及合成測試在 integrations/codex-image-worker。沒有 API key/OAuth 登入資料，沒有付費 Images API fallback。沿用本人帳戶／無 OS 沙盒模式具風險，不可當作公司多人無限制分享或 local inference。
- Hermes 文字助手為另一個既有獨立服務（專用 profile as-workspace／loopback8646），不是把圖片Worker當作文字服務。需要獨立安裝、登入、API key及啟動；這個 repository 不提供任何人的憑證或 Hermes profile 複本。

## 原始碼與正式前端的重要差異
目前正式 HTML 使用 `assets/index-nav-902a12da0676fdb9.js`。先前 Explorer UI 回退留下了原始碼／有效前端入口差異，因此此次導航修正採保留舊介面/CSS的最小發布，沒有把未正式發布的 Explorer UI 夾帶上線。

**直接 npm run build 不等於目前正式介面。** 若要還原目前介面，使用 Private Release 的正式 dist ZIP，不要先重建。`deployment/frontend-manifest.json` 列出全部781個正式檔案及SHA256；`deployment/frontend-archive.json` 記錄ZIP SHA256。快照含既有第三方網頁編輯器/WASM/字型及其隨附檔案，並非聲稱擁有其授權；不要任意改公開repository或轉授權這些第三方內容。後續完整重建前，必須先核對和收斂未發布的 Explorer 變更。

## 從新 checkout 還原程式／正式前端
1. 透過自己的 GitHub 權限 clone 本 Private repository。
2. 使用符合 package.json 的 Node（本次驗證用Node24）執行 `npm ci`。
3. 從本 repository 的 **Private Release** 下載 `as-workspace-0.11.0-formal-frontend.zip`。
4. 在全新 checkout 執行：
   ```bash
   python scripts/restore-deployed-frontend.py --archive /path/to/as-workspace-0.11.0-formal-frontend.zip
   npm test
   ```
   還原器驗證整個ZIP及逐檔SHA256，恢復dist與本機編輯器public資產，拒絕覆寫現有dist/public編輯器。它不啟動服務、不初始化資料庫、不恢復帳戶或公司文件。
5. 依 `docs/original-package-README.md`、設定範例和現有精靈，在**獨立的新 app/data 目錄**設定新環境。IP/port/data root/TLS需按新主機設定；不要指到正式公司的既有data目錄測試。正式公司使用4331並不代表範例的預設port就是4331。
6. API/OAuth/管理員帳戶/TLS須重新安全設定。Native Java17/Craft CLI/Poppler/OCR等不隨本Git repository或前端ZIP附送，請用對應安裝腳本/版本設定準備；未準備時相關處理功能不可視為已恢復。B盤來源、工作站配對及公司政策/帳戶/文件資料均未備份至GitHub。

## 訂閱圖片 Worker
`integrations/codex-image-worker` 包含已安裝Worker的實際Python程式及測試，不含Codex native exe、node_modules、OAuth home或service key。原生 CLI 使用@openai/codex0.165.0的Windows工具鏈；需獨立ChatGPT登入及安全產生Worker key。沿用執行模式需明確 `--accept-summit-unsandboxed`，以 `--minimum-remaining 20` 指定本次pilot授權的停止線；unknown/invalid auth/limit reached仍應拒絕。非訂閱通用預設門檻不必然是20%，請勿省略明確參數。這不是OS隔離，不可使用公司敏感文件做未經批准的雲端測試。

Hermes文字服務的已驗證啟動方法為 `hermes --profile as-workspace gateway run`，前提是**自行安全建立及設定正確專用profile**。不要從GitHub複製別人的auth/token，也不要把一般同事導向主人的原始8642服務。開機自啟／自動故障恢復未納入這次復原，不是已完成的功能。

## 驗證與未完成邊界
見 `deployment/VERIFICATION.md`。這個snapshot不宣稱整個公司pilot全面驗收，也不等於可無登入一鍵復原公司的使用者和文件。正式圖片Canvas瀏覽器生成/保存/重開/下載最後驗收仍未完成；Gemini/Revit整合/未發布Explorer UI不因此Git備份自動完成。文件切頁測試的編輯器訊息是受控fixture，不冒稱原生Office WASM文件持久化驗收。

只有程式／合成fixture／設定範例／安全說明進Git；大型正式前端ZIP只放Private Release。請保持repository為Private。
