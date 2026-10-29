# 最新：AS Workspace v0.8.0

Infinite Canvas共用版本、圖片版本及可設定的雲端生圖Gateway增量。真實雲端、Mac及公司LAN尚待驗收，不代表已正式上線。

- [本輪結果及未完成項](docs/phase5/0.8.0/RESULTS.md)
- [公司／Windows安裝](COMPANY_INSTALL_080.md)
- [交給Mac mini的部署prompt](MAC_INSTALL_080_PROMPT.md)
- [集中人手驗收](docs/phase5/0.8.0/USER_ACCEPTANCE.md)
- [完整開發計劃](DEVELOPMENT_PLAN.md)

以下保留歷史交付資料，版本限制請以各版本結果為準。

# AS Workspace 0.7.0

完整開發計劃與歷史任務狀態：[DEVELOPMENT_PLAN.md](DEVELOPMENT_PLAN.md)（2026-10-25）。

安全修補及實測：[SECURITY_041_RESULTS.md](SECURITY_041_RESULTS.md)。GitHub與Mac交收：[GITHUB_HANDOFF.md](GITHUB_HANDOFF.md)。源碼clone後先執行npm run grid:install；Release ZIP已包含Web編輯器。

目標：公司專用 Windows PC 提供 HTTPS 中央平台，5–10人先以公司 LAN 瀏覽器使用；生圖運算走批准雲端。家中 Mac mini 保留為獨立 trial。只在此獨立資料夾開發。新增登入／角色、檔案編輯鎖＋版本衝突、個人AI對話及FIFO任務排隊。保留GridCraft Web、檔案版本、OpenDataLoader搜尋及左下可切換模型。

**v0.7公司管理核心已加入Admin、項目隔離、SQLite及可設定文字Gateway；GUI／公司部署待驗收。** 詳見[結果](docs/phase5/0.7.0/RESULTS.md)、[返回後驗收清單](docs/phase5/0.7.0/USER_ACCEPTANCE.md)。

**0.6.0 已接入真正 DeckCraft／PdfCraft／WordCraft Web 編輯器，共用版本、權限及 AI／Office FIFO；Mac 新版仍待驗收。** 詳見 [本輪結果及未完成項](docs/phase4/0.6.0/RESULTS.md)。舊版跨機驗收另見 [Windows 0.4.1 報告](docs/windows-acceptance/2026-10-24/README.md)。Mac 新版請用 [安裝 prompt](MAC_INSTALL_060_PROMPT.md)，先以 4322 並行驗收，保留現有 4317。

## 安裝與本機登入

Node 22.22.3+。解壓新版部署ZIP到新目錄後：

```
npm ci --ignore-scripts
npm run office:install
npm run search:java
npm run users -- add anson --role admin  # 只在首次公司模式啟動前
npm run build
npm start
```

npm start現已要求登入，預設仍只監聽loopback HTTP，適合本機確認。沒有預設帳戶；密碼於終端隱藏輸入，不放對話。模型以config/models.local.json／.env配置，金鑰不傳前端。

跨機使用須依Mac指引設定TLS、允許的Host、每人帳戶及信任憑證，再執行 npm run central:start／Start-Central.command。程式拒絕明文LAN監聽，沒有修改任何系統服務或防火牆。

## 操作

- 左側開啟GridCraft，從項目檔案取得編輯權；編輯器Save儲存新版本。「關閉並釋放」讓其他人編輯。
- 鎖逾期／舊版本回409，保留待保存內容，可下載或另存副本。項目檔案上傳每份上限5MB；背景Office沿用原有限制。
- 保存後按「讀取供搜尋／AI」，右側chat使用提交當刻的內容快照；模型在左下選擇。
- AI任務頁顯示排隊／執行／成功／失敗。預設1項執行，每人最多3項、全域30項。排隊可取消，重啟不自動重發。
- 公司入口按項目隔離；管理員亦須獲內容授權。舊帳戶保留legacy項目，新帳戶由Admin分配項目／功能／操作。viewer只讀。
- PdfCraft／WordCraft／DeckCraft已接入真正 Web 編輯器及背景流程；DeckCraft Web 互動仍待驗收。Excalidraw保留共用資料入口及版本衝突檢查。

## 驗證與限制

- v0.6.0 歷史結果：38項Node、7項Deck、15項Office、15項workspace通過；另有原生豐富內容及PDF視覺核對。模型模擬與真實推理的範圍見版本報告，本次文件更新未重跑。
- Word／PDF主要Chrome流程於v0.5通過；Deck Web互動及Mac v0.6仍待驗收。
- Windows→Mac v0.4.1曾通過三帳戶與真實Ollama排隊；不可當成新版Mac或公司容量證明。
- v0.6記錄的依賴掃描為0 critical/high/moderate、4 low，並非今天重新掃描。
- v0.7已有Admin核心與多項目ACL、離線備份還原；尚無SSO、正式服務installer或高可用。53項Node與8項公司整合流程結果見本版報告；GUI未驗收。
- 瀏覽器自動下載延遲未完全定位；完整編輯器入口不代表所有上游功能已驗收。

備份請先停止平台，再保存完整data/及另行安全保管TLS私鑰與模型設定。不要在兩個程序中同時使用同一data/。

公司模式首次啟動會將帳戶與舊項目遷入SQLite。之後使用Admin UI；忘記admin密碼用離線company:recover。請先在新目錄／資料副本驗證，勿用舊JSON回退。公司試驗指引見[部署](COMPANY_INSTALL_070.md)。
