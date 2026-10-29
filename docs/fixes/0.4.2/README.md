# 0.4.2 Windows 修補及回歸驗收

本輪只修改獨立 Company-AI-Platform-PoC。Windows 編譯、測試及封裝；沒有操作 Mac 執行中平台、舊開發、Hermes、Ollama、CA 信任或防火牆。

## 修補內容

- GridCraft v0.11.1 的 WASM `load_fallback` 原本回傳空清單；Web 無系統中文字型，因此 egui 畫布出現方框。加入未修改的 Noto Sans CJK SC Regular，再編譯成 `0.11.1-cjk1`。CSS 字型無法修補 WASM 畫布。授權為 SIL OFL 1.1，與 MIT / Apache 2.0 程式授權一併隨成品提供。來源與字型 commit、SHA-256 記於 `platform-build.json`，重建腳本是 `scripts/build-grid-cjk.mjs`。
- 這個字型涵蓋本輪繁體中文樣本，但使用 SC 地區字形；未宣稱符合香港字形標準，生僻字、罕用字及大量工作簿尚未驗收。
- 下載連結加上原生 `download`、明確檔名及固定版本；XLSX / DOCX / PPTX 使用正確 MIME。PDF「預覽」與「下載」分開。回應附版本、長度及 SHA-256，保留登入、無快取及 nosniff。
- 新增「核對檔案完整性」：用現有登入讀取指定版本並核對 SHA-256 / 長度 / 版本；不宣稱已存到電腦，失敗會提示登入或版本問題。
- viewer 的編輯及附加 AI 按鈕停用；成功取得檔案鎖後清除舊衝突通知。
- 納入 Mac 已核對的 TLS 來源修補：CA 與 server 使用不同 CN。只影響將來新建憑證，不重建或替換現有 CA。
- source ZIP 排除未審閱的本機歷史報告，只附核准的文件及合成證據。

## 本輪實測

| 項目 | 結果及範圍 |
|---|---|
| Windows Node 回歸 | 33/33；真實 HTTPS、獨立登入、viewer GET/POST 權限、版本鎖、10 個合成客戶端 queue、雙協定切換及不自動 fallback。模型是模擬服務，並非真實推理容量測試。 |
| 真實 Office / 搜尋 smoke | 12/12；GridCraft MCP 開檔、公式重算、版本保存；WordCraft 中文 PDF → OpenDataLoader 頁碼 / bbox；損壞 PDF、掃描頁狀態及磁碟重開。 |
| Chrome 真實 WASM | 中文「數量／單價／金額／合成測試」正常顯示。B2 由 3 改 4，D2 `=B2*C2` 為 493.8；Save 成 v2，關閉及釋放後重開仍保留。見 `grid-cjk-v2-reopened.png`。 |
| Chrome viewer | 編輯、索引、附加 AI、提交 AI 停用；完整性按鈕讀取 v2 並通過 SHA-256。見 `viewer-integrity.png`。 |
| 支援的自動下載 | Chrome `downloadMedia` 成功，實際檔案 4,198 bytes，與伺服器 v2 的完整 SHA-256 一致；ZIP 10 項 CRC 通過，Unicode、B2=4、公式及 493.8 保留，無巨集／外部連結。見 `download-verification.json`。 |
| 普通自動 click | 修改前後均未觀察到新的本機檔案；與支援的下載工具成功是兩個不同結果，不能宣稱已全面解決。 |
| 依賴審計 | 0 critical / 0 high / 0 moderate；4 low。詳見 `regression-summary.json`。 |
| Mac 部署 ZIP 乾淨解壓 | Windows 新解壓目錄的 npm ci、build、33 項測試通過；修訂 WASM 每檔 hash 通過，封裝沒有帳戶、私密設定、TLS 或原生工具。這不是 Mac 實機證明。 |

## 下載診斷的結論

舊 Mac 0.4.1 已由使用者手動下載，原檔完整性通過；本輪新 Windows 版 viewer 的伺服器 GET、瀏覽器 fetch 核對及支援的下載工具均成功，故沒有證據顯示 viewer 被伺服器拒絕。原本通用 MIME 及模糊連結已改善，但不能單憑一次成功判定它們就是唯一根因。

普通自動點擊仍未存檔，較可能涉及瀏覽器／擴充功能的下載許可或操作方式；確實原因未定位。沒有關閉 Safe Browsing、放寬下載批准或以公開檔案繞過登入。讀取整個 Chrome 下載記錄曾被自動審核拒絕，之後只用本輪合成檔案及請求驗證。

## 未完成

- Mac 0.4.2 部署、Safari / Mac Chrome 字型、Windows → Mac 新版跨機下載與真實 Ollama 排隊須安裝後重驗。
- 普通自動 click 為何沒有下載事件仍未完全定位；支援的下載工具成功不代表所有自動化方法成功。
- 5–10 位真人、長時間並行、真實模型吞吐及大型／複雜 XLSX 未壓測。
- CJK 只測上述繁體樣本；SC 地區字形、斜體／粗體及香港罕用字需另定字型驗收。
- PdfCraft / WordCraft 仍是既有背景文件流程，並非完整 Web 編輯器。本輪沒有擴大功能範圍。

## 是否可以加入 PDF / Word

可以按模組逐項加入，不需等待所有邊緣問題消失。建議先 PDF 合併／拆分／抽頁／壓縮及 Word 報價／事故報告範本，全部沿用項目檔案、版本、角色、AI queue 與可切換模型；長任務須進背景工作隊列。每項以「實際輸出、重新開啟、viewer 下載、錯誤可見、不覆寫原版、無未批准外傳」作驗收。完整 Word 編輯器、OCR、批量 Office 和 5–10 人容量另外驗證；不要把現有背景 MCP 流程說成完整 Office UI。

來源：[GridCraft fallback](https://github.com/storytold/gridcraft/blob/v0.11.1/crates/ui-egui/src/theme.rs)、[固定字型 manifest](https://github.com/storytold/craft-fonts/blob/fff559f5f038112a4135e95c720161d4d0a5b335/fonts/manifest.txt)。
