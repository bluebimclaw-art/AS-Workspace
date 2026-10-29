# AS Workspace v0.9.0 trial — Windows 後續交接

| 項目 | 現況 |
| --- | --- |
| Release／來源 commit | `v0.9.0`／`ee815fa486376b17675ba20c64a54317ce880d24` |
| 來源 ZIP SHA256 | `40ae692cf6b7577605ec1769183172105b065ef945295e0e9afdaa96afaa988d` |
| Mac 部署目錄 | `/Users/aiden/Projects/Company-AI-Platform-PoC-0.9.0`；專屬 `data/` |
| Mac 本機入口 | `http://127.0.0.1:4330/`，只綁 `127.0.0.1`；health 為 `/api/health`，本輪回 200／`0.9.0` |
| Windows HTTPS 入口 | **未提供**。沒有為 v0.9.0 建立 LAN TLS；Windows 無法連接上述 loopback URL。不得改用明文 LAN 登入或忽略憑證警告。 |
| Mac GUI | Codex 內置瀏覽器登入 member／viewer、資料夾導航、搜尋、PDF 預覽面板及 member 的真實 Ollama GUI 任務（queued → running → succeeded）已操作；嵌入 PDF 頁面視覺繪製未證實。 |
| 真實模型 | 新平台透過既有 loopback Ollama `0.34.0`，`gpt-oss:20b` 兩名 member 排隊生成及 `gpt-oss:20b-64k` 切換生成成功；無雲端。 |

測試帳戶：`searchadmin`（admin）、`search01`／`search02`（member）、`searchview`（viewer）。全部使用新平台獨立帳戶資料；本機受限密碼檔位於新平台 `config/synthetic-accounts.local.json`，不在 GitHub。合成來源最後已批准兩名 member 及 viewer；viewer 只可讀／下載。舊版帳戶不能登入這個獨立資料目錄。

啟動前在 Mac 核對 4330 沒有其他 listener；於上述新平台目錄執行 `npm start`，保持該終端開啟。它讀取新平台 `.env` 並使用獨立 `data/`。只停止這個前景終端用 Ctrl-C；不要按 `node` 程序名稱批量停止，不要碰 v0.4.1／v0.8.0。沒有設開機服務，Mac 重啟後不會自動恢復。服務當前狀態必須即時以 `lsof -nP -iTCP:4330 -sTCP:LISTEN` 和 Mac 本機 health 核對。

Windows 助手的下一步：

1. 先由 Mac 管理者另外提供公司批准的 v0.9.0 LAN HTTPS 入口、相應公開 CA／指紋及網絡准入；此報告未提供可用 Windows URL。
2. 從 Windows 以正常憑證驗證檢查 health、未登入 401，再在獨立瀏覽器 profile 登入 member 和 viewer。不可用 TCP 探測或 Mac 本機測試代替瀏覽器驗收。
3. 在真正 Windows Chrome 核對 PDF 頁面視覺繪製、資料夾上／下層、類型篩選、OCR 頁碼、下載 hash、viewer 禁止索引／AI、雙 member 隊列及撤權後舊任務不可讀。
4. 閱讀 [Mac 實測報告](MAC_ACCEPTANCE_REPORT.md) 及 [去敏測試摘要](test-summary.json)，區分真實 PDF/OCR、合成 LLM smoke、真實 Ollama 和未測項；沒有 embedding／向量搜尋。

本輪沒有更改舊平台、Hermes、Ollama 服務設定、模型、系統 CA、防火牆或 Revit，亦沒有上載任何密碼、私鑰、token、帳戶 hash、完整設定或公司文件。
