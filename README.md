# AS Workspace

公司工作平台的原始碼與 **0.11.0 公開預覽版**，供同事查看程式、設定範例及測試。

> Public repository 任何人均可閱讀；這不會公開公司內聯網服務、帳戶或文件。此處不含公司資料庫、用戶資料、私有設定、API／OAuth 憑證或 TLS 私鑰。

## 功能範圍
- 文件／PDF／簡報／試算表及 Canvas 的平台整合程式。
- 文件導航：未保存修改可選擇放棄離開或取消，不再一律強迫先保存。
- 文字助手與 Admin-only Image 2.0 訂閱 Worker 的整合程式；憑證需另外在本機設定，不會由 GitHub 提供。
- Revit、第二機及正式 Canvas 完整驗收仍有未完成項目；不宣稱全部功能已通過公司試用驗收。

## 下載及還原公開預覽版
1. 安裝 Node.js 24 LTS 及 Python 3，clone 本 repository。
2. 執行 `npm ci --ignore-scripts --no-audit --no-fund`。
3. 從 [Public preview Release](https://github.com/bluebimclaw-art/AS-Workspace/releases/tag/v0.11.0-public-preview) 下載 `as-workspace-0.11.0-public-preview-frontend.zip`。
4. 在全新 checkout 執行：
   ```bash
   python scripts/restore-deployed-frontend.py --archive /path/to/as-workspace-0.11.0-public-preview-frontend.zip
   npm run test
   python -m unittest discover -s integrations/codex-image-worker -p 'test_*.py' -v
   ```
5. 還原工具先核對 ZIP SHA256、路徑及逐檔雜湊，並拒絕覆寫現有 dist／public。工具不會啟動服務或建立公司帳戶。
6. 如需運行新環境，另按 `README.quick-start.md` 配置獨立本機資料目錄、HTTPS、認證及服務。不要連接正式公司資料目錄；Java／Poppler／Codex 等原生工具亦須另行安裝。

## 公開版與公司正式備份的差別
- 公司正在運行的版本完全沒有因公開整理而修改或重啟。
- 公開包以原正式前端為基礎，但移除了 PDFCraft WASM 內三個 ArtCraft 標誌 SVG，並將授權材料不明確的舊 Liberation Sans 1.05 換為具完整 OFL 聲明的 2.1.5。其餘 233 個 Excalidraw 字型已對照 v0.18.1 上游 Git blob。
- 加入上游、字型、NPM 及既有 Canvas 的授權聲明。差異記錄見 `deployment/public-variant-changes.json`。
- 因此公開 ZIP **不是與公司正式版本逐位元相同的備份**。原始正式 ZIP 已保留在公司本機，不再作公開下載。
- 目前 source 與正式前端存在先前 Explorer 介面回退造成的差異。`npm run build` 不保證重現預覽快照，亦可能使用原 office-web 設定下載 host 資產；對外再發佈前必須重新整理授權與品牌內容。
- 公開包只作預覽／開發交接，不包含公司資料、密鑰、原生 runtime 或全面 Office-WASM 操作驗收。

## 授權及品牌
請見 [第三方聲明](THIRD_PARTY.md) 及 `third-party/`。本次沒有新增一份宣稱全部內容均屬 AS 或均為 MIT 的統一授權；第三方原授權及商標限制各自適用。AS Workspace 是獨立整合試用項目，不是 ArtCraft、Excalidraw 或任何 AI 供應商的官方產品，也不代表其認可。不要把本地私有設定、公司文件或憑證提交到公開分支。
