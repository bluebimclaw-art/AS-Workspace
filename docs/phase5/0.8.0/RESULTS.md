# AS Workspace v0.8.0 — Infinite Canvas 驗證結果

2026-10-25，Windows Node 24.14.1；只改 Company-AI-Platform-PoC。這是試點增量，未宣稱公司正式上線或真實雲端生圖通過。

## 已交付

- 真正 Infinite Canvas Web，鎖定 basketikun/infinite-canvas commit 9f2bd9f1b27c45fd1b8f5323072b07243f9e0fac，保留 MIT、作者及第三方 notices。
- 按項目保存畫布及不可變版本、舊版本查看、另存副本、畫布副本匯出／匯入入口、409 衝突保留內容。這是版本協作，不是即時多人同編。
- PNG／JPEG／WebP 加入共用項目檔案；可更新圖片版本、插入當時版本快照。畫布保留當時的圖片 bytes、共用 file ID／version／hash，檔案更新不替換舊畫布。
- 生圖由伺服器 Gateway 執行，沿用項目 ACL、viewer 限制、全公司串行隊列、requestId 去重及執行前撤權檢查；不自動重試或 fallback。
- 可設定 Gemini generateContent、Gemini Interactions、OpenAI-compatible Images API。Interactions 明確 store=false，不建立可續接的服務端對話；這不取代供應商的資料保留政策。模型 ID 由管理員設定，未硬編碼。
- 每日公司生圖提交上限預設 0（關閉），香港日曆日，SQLite 持久計數，重啟及跨項目不重置。成功、失敗、取消的已接受任務均佔提交額度；格式不正確而未入隊的請求釋放預留。張數限制不是金額預算封頂。
- 左下模型選單標示對話／生圖能力；image-only 服務不能用來提交 AI chat。右側助手維持文字及已保存／索引來源問答，沒有聲稱看懂未提供的圖片。
- opaque iframe、private MessageChannel、CSP 禁止畫布直接連外。瀏覽器不收到真實 provider key；影片、音訊、遠端插件及畫布內 Agent 不開放。

## 實測

| 範圍 | 結果／證據 |
|---|---|
| 完整 Node 回歸 | 65/65，0 failed；包含 12 個 Canvas 測試及舊功能回歸 |
| 真實 Craft／HTTPS 公司回歸 | 8/8；真 WordCraft DOCX/PDF、PdfCraft 旋轉／OpenDataLoader、DeckCraft 三頁簡報、GridCraft、10 個獨立測試帳戶、重啟及備份還原 |
| Gemini／相容生圖 | 本機合成 HTTP 服務驗證三種 adapter；header、reference payload、單張結果、503 不重試、Interactions stateless／upstream ID、模型清單認證通過。沒有呼叫真實雲端 |
| 畫布及安全 | 不可變版本、同時保存一成功一409、viewer403、跨項目404、搜尋隔離、原圖hash、備份還原後畫布／圖片完整及配額持久通過 |
| 兩帳戶 AI | 合成模型，FIFO 排隊；queued 任務撤回 Canvas 權限後不向模型送出 |
| Windows Chrome GUI | 真編輯器載入、合成圖片生成、保存／重開至v5、雙分頁衝突、保留副本、共用圖片插入即時出現、舊版圖片與新版快照同存、viewer唯讀及瀏覽器下載v2 hash核對。看 canvas-conflict.png、canvas-final.png、canvas-viewer.png |
| 圖片完整性 | image-integrity.json：v1/v2 bytes 與下載 SHA256 相符，舊版不變。GUI 檔案上載未通過，這次更新由已認證 API 完成 |
| 建置 | 平台及鎖定 Canvas Web 實際建置通過；Canvas 乾淨 npm ci 使用專屬 lock，與平台 React 隔離 |
| 部署包 | 包含四款 Craft Web＋Canvas Web、來源及hash。Windows全新解壓 npm ci／build／65項test通過；各Web成品hash核對通過。最終包hash及驗證見release附件 validation-v0.8.0.json；Mac實機仍未測 |
| 依賴審計 | 主平台：0 critical/high/moderate，4 low；Canvas：0 critical/high/moderate，3 low。移除未使用的 ProComponents 與其 moderate 依賴，未強行降級核心 |

GUI 發現並修補：初始化 blob URL／空 images 列表誤報 dirty；外部插圖只更新 store 而未更新編輯器；iframe 高度未填滿。合成模型只返回固定色塊，截圖不是建築生圖品質示例。

## 問題及未完成

1. **真實 Gemini／其它雲端生圖未驗證**：尚欠批准的 key、確切可用模型、額度／計費及資料政策。沒有消耗真實雲端額度，也沒有宣稱免費。
2. **Mac、公司 LAN、跨 Windows→Mac、5–10部真機及長開容量未驗證**；本輪10帳戶是單一Windows測試主機的程序驗證，不是公司網絡容量證明。
3. Chrome 自動上載被擴充功能的 Allow access to file URLs 阻擋；沒有擅自修改此權限。人手普通選檔、畫布匯出／匯入往返、畫布副本下載及跨機留待集中驗收；viewer圖片v2已真瀏覽器下載核對通過。
4. viewer 的畫布閱讀使用靜態圖片＋文字摘要，保留檔案版本下載；尚非完整幾何／連線的唯讀 Infinite Canvas，也非即時多人游標同步。
5. 單檔5MB、畫布 JSON 含圖片合共5MB（base64有額外開銷），最多10子畫布／每個500節點；UI本輪按一個畫布一個共用版本使用。參考圖最多3張且原始 bytes 合共5MB，回應最多10MB，實際圖片最多5MB。
6. 只傳 prompt／references、一次一張，尺寸／品質採供應商預設；上游UI某些尺寸／批量選項尚未對應，不可當作已生效。參考圖保存hash；生成來源的檔案ID／版本映射及完整參數治理待補。
7. Vertex AI、ComfyUI、Imagen predict、任意非相容API、影片／音訊、多Agent、任意插件尚未接駁。已有通用協定可加 provider 設定；新協定仍需 adapter 開發驗證。
8. 共用圖片可下載供 Word／Deck 使用，但**一鍵送往 DeckCraft、比較方案版面及完整跨工具素材插入未完成**。
9. 只有全公司串行執行及張數配額；分類並行、每人每日生圖配額、金額預算封頂、provider 任務對帳／不明結果查詢、上游取消確認待補。中斷不會自動重送。
10. 65項不是所有 Infinite Canvas 上游功能驗收；大型畫布、複雜圖像編輯及商用效果圖品質須另驗。剩餘 low 依賴公告見 test-summary.json，不代表零安全風險。
11. 公司 Windows Service installer、SSO、正式 DNS／TLS、VPN、Revit Connector 仍按開發計劃後續交付。

## 重現與來源

npm ci --ignore-scripts；npm run build；npm test；npm run office:install；npm run search:java；npm run company:regression。原生 Craft 安裝依平台選擇，不能用 Windows 執行檔代替 Mac驗收。詳細安裝：COMPANY_INSTALL_080.md／MAC_INSTALL_080_PROMPT.md。

協定查核（2026-10-25）：[Google image generation](https://ai.google.dev/gemini-api/docs/image-generation)、[Interactions overview](https://ai.google.dev/gemini-api/docs/interactions-overview)、[Images API guide](https://developers.openai.com/api/docs/guides/image-generation)。文件相符不等於使用者帳戶可用或免費。上游：[Infinite Canvas](https://github.com/basketikun/infinite-canvas)。
