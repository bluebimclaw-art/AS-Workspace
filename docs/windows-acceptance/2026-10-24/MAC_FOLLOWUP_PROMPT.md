# 給 Mac mini 助手的修補 prompt

請先讀私人 repo `ansonman/company-ai-platform-pilot` 分支 `codex/windows-acceptance-20261024` 的 `docs/windows-acceptance/2026-10-24/README.md`、結果及圖片，再處理兩項工作：GridCraft 中文方框，以及自動下載問題診斷。

只修改新平台 `~/Projects/Company-AI-Platform-PoC-0.4.1` 所屬開發範圍。先確認實際部署目錄及是否為 Git 工作樹；如是 Release ZIP 部署，在新平台內另建 source/測試副本，不覆蓋運作中的程式、資料或憑證。使用 `codex/gridcraft-font-download-fix` 修補分支。不要改舊平台、Hermes、Ollama、帳戶、系統 PATH、LaunchAgent、防火牆或系統憑證信任，不中斷目前服務。

PR #1 是 TLS 修補，交接時仍未合併。先核對它的最新狀態並保留現用 TLS 修正，不擅自合併、覆寫憑證或移動既有 tag/Release。

## 1. 先處理 GridCraft 中文方框

已知：Windows GridCraft Web 0.11.1 的 canvas 中文顯示方框，但下載 XLSX 的文字完整，數值與公式也正確。這是字形顯示問題，不能靠改編碼、替換文字或改工作簿內容處理。

- 先復現並記錄載入版本、相關字型/資產請求、回應及渲染環境；確認字型缺漏、fallback、canvas/WASM 字型註冊等哪一層有問題，不先假定只改 CSS 即可。
- 優先使用官方公開機制；如需要新增 CJK 字型，核對商用及再分發授權，附授權與來源，只放平台資產，不擅自打包系統字型。
- 保留 upstream 原始檔與校驗資訊；若需要補丁，將來源、補丁及新雜湊寫清楚。確認 copy-assets、production build 與部署包會包含資產，Mac/Windows 均能使用。
- 使用獨立合成工作簿驗證「Windows 試點驗收、數量、單價、金額、合成測試」、繁簡中文、英文及數字。必須看到真正 GridCraft GUI 正常字形，且 Save/關閉/重開後仍保留文字與 =B2*C2，3×123.45=370.35。
- 沒有 Windows 操作能力時，只標記 Mac 實測，提供 Windows 重測步驟，不能寫成兩平台已通過。

## 2. 診斷自動下載，不先改權限

已知：review01/viewer 可手動下載，最新 v2 為4,200 bytes，完整 SHA256 是 `1184047b64b1497de26cb8ab0f10054cf908faf99b08bbb00cae0edcfb63ce35`；兩套解析確認中文與公式完整。舊版4,193 bytes，SHA256 是 `1b3fc90a9c2c7ca58e046bd540f52cdf136ac118351f4c3056876c2925f8a841`。自動工具等候下載事件逾時，曾有 `ERR_BLOCKED_BY_CLIENT`，沒有取得伺服器403證據。

- 比較同一合成檔案的手動與自動下載：member/viewer、普通/無痕、點擊/下載事件、HTTP狀態及 Content-Type、Content-Disposition、Cache-Control、nosniff。只記必要的非機密資訊，不保存 Cookie、token 或完整 HAR。
- 分開判斷伺服器回應、Chrome/擴充功能下載批准、檔案對話框及工具事件捕捉；不要把工具逾時寫成伺服器拒絕。
- 不關閉 TLS、登入、CSRF、角色限制或瀏覽器防護，不靜默擴大網站/擴充功能權限。需要使用者操作的批准由使用者處理。
- 若證據顯示是平台問題，做最小修補；若屬 Windows/擴充功能端而 Mac 不能重現，保留平台邏輯，交代證據缺口及精確 Windows 下一步。
- 用新合成測試檔驗證下載大小、完整 SHA256、內容及公式；修改後檔案雜湊可改變，必須與該次新版本 metadata 比較，不能硬套舊 v2 的雜湊。

## 3. 回歸及交接

執行與改動相稱的檢查及既有必要檢查，記錄真正命令、結果、版本及限制，不沿用舊測試數字。至少保留檔案儲存重開、雙帳戶鎖定、viewer不可寫/不可AI，以及本機模型可選擇的既有行為；未能實測的項目明列。

交付修補 PR、修改清單、根因/仍未知事項、Mac 實測、Windows 待驗收項及可回復方式。如需交付更新部署包，另給帶版本/校驗的修補包，不替換既有 v0.4.1 Release；字型授權及資產必須包含，秘密及資料不得包含。先完成可獨立驗證工作，再回報真正缺口。
