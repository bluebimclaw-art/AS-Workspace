# 公司管理核心 v0.7.0 — 實測及限制

2026-10-25，Windows Node 24.14.1。這是第⑤階段的第一個增量，並非5A–5D整個公司版完成。只改獨立新平台；未部署公司機、未切換Mac／舊平台、未修改Hermes或原Revit MCP。

## 已實作

- Admin：使用者新增、停用／啟用、密碼重設、角色、撤銷舊登入；最後啟用管理員不可被停用／降級。群組、項目及成員授權、逐功能allow/deny、操作權限、管理事件、程序狀態及跨項目任務配額。
- 帳戶雜湊與權限同在SQLite control事務保存；管理更新帶版本號，過時更新409。管理權與內容權分離；新帳戶不自動取得舊項目內容。
- 各項目獨立資料目錄、SQLite快照及檔案庫；原有單項目資料留在原相對位置作legacy。原store.json與users.json保留作遷移來源，不再是公司模式的更新來源。這是SQLite JSON snapshot，不是已正規化的關聯式資料模型。
- API／狀態／搜尋／下載／版本／Office輸出／白板／AI對話／任務按項目處理。每個分頁的API、預覽與下載固定project參數，避免共用cookie切換造成錯存。
- 使用者／群組／項目明確deny優先；viewer硬上限為read/download。功能開關控制應用操作；對共用檔案內容的閱讀／下載另按項目權限控制。例如停用Word編輯器不等於禁止閱讀已獲授權項目的DOCX。
- 同一公司只執行一項AI／Office工作，跨項目配額預設總30／每人3，可在Admin降低／調整。項目本身的舊上限仍作第二重保護。每項任務執行前重新核對帳戶、項目、功能及provider政策。
- Provider registry：Ollama、OpenAI-compatible、Gemini文字協定；端點／模型可設定，明確模型清單、服務啟停、指定使用者／項目／全域、項目local-only政策。沒有任意adapter上載或前端腳本執行。
- API key使用AES-256-GCM封存，master key在data/auth/gateway.key；或引用伺服器環境變數。公開／管理回應不返回key、密碼salt/hash或加密封包。設定變更使舊排隊路由失效，不自動fallback；連線檢查只查模型清單。
- 離線備份、校驗及新目錄還原：拒絕運行中來源、拒絕覆蓋、SHA256、SQLite integrity_check。離線重設既有啟用admin密碼，不建立後門帳戶。原users CLI在遷移後拒絕修改過時JSON。

## 本輪證據

最終數目見test-summary.json，原始日誌在忽略的evidence目錄。

- Node測試涵蓋舊功能以及公司ACL、跨項目猜ID、viewer、群組deny、撤權後排隊失敗、配額、秘密封存、Gemini原生文字／清單模擬、備份及離線恢復。
- company:regression共8項：真實HTTPS／CA驗證、10個獨立登入連線並發保存、實際Word／PDF／Deck／Grid工具、OpenDataLoader、跨項目拒絕、分頁固定project、SQLite重啟及離線備份／還原。
- 十人登入初次同時提交超過既有最多4個密碼驗證，正確回429。測試改為依序建立登入，再測十個已登入連線並用；沒有降低防護。
- Gemini只對本機合成HTTP伺服器測協定與key header；沒有使用真實帳戶、生成或費用。
- 建置通過；上游套件既有use-client提示不阻擋建置。

## 未完成（開發項目）

- Infinite Canvas未接入；已下載官方來源至忽略的tools目錄，核對commit 9f2bd9f1b27c45fd1b8f5323072b07243f9e0fac。畫布state、圖片Blob、IndexedDB、前端直連、插件及資料版本需要正式host adapter，不能直接iframe後宣稱公司資料共用完成。
- 真實生圖adapter／排隊與預算、參考圖編輯、Canvas→Deck、Vertex AI認證、ComfyUI及跨LAN地端端點未完成。本版Gateway僅文字功能；地端端點仍限loopback。
- Revit Connector、版本握手／阻擋、配對、工具白名單及真實模型驗證未完成。Admin的BIM／Canvas勾選項僅預留權限，不是可用功能。
- Windows服務安裝精靈、DNS／TLS企業流程、自動更新／回退、Connector管理頁、線上備份管理頁及分類資源隊列仍未完成。附帶ZIP是可攜部署來源包，不是完成的公司一鍵installer。
- SQLite快照仍為單程序全量序列化；沒有高可用、多程序寫入、正規化schema、不可篡改審計或細至檔案的額外ACL。
- 配額頁控制未完成任務數，不是生圖張數／費用預算。全域執行閘門等待的項目在本項目隊列可能顯示執行中，尚未細分「等候公司資源」。

## 未完成（人手／環境驗收）

- 瀏覽器工具本輪再次回報Local browser use is disabled in Work settings。沒有繞過；Admin／項目切換／權限撤回時未保存內容的畫面與操作仍需驗收。GUI樣式及編譯不等於互動通過。
- DeckCraft v0.6 Web歷史尾項、下載自動化延遲仍需補測。
- 公司Windows10、Mac Node22、Safari、正式LAN HTTPS、5–10部實體PC、8小時負載、磁碟滿／斷電故障及實際RPO/RTO未測。十個本機HTTPS連線不是容量認證。
- 真實Gemini／Vertex額度、地區／資料政策與真實Ollama在新版回歸未測。
- 既有秘密設定檔仍能作fallback；要完全由Admin控制某舊provider，需用同ID登記覆蓋或在部署前移除其舊設定。不能宣稱所有舊服務已自動納管。

## 升級與備份注意

先停止來源平台並備份整個data；在新版本目錄與資料副本試遷移，不能把正式data指向兩個程序。SQLite採WAL，不能只複製主.sqlite檔。舊JSON不含新修改，直接用舊版讀它會遺失新狀態；回退須恢復對應版本的完整備份至新目錄。

備份含密碼hash與gateway master key，屬敏感資料，不得上傳GitHub。TLS私鑰與環境變數通常在data以外，要另行安全保管。加密封包與master key同機不是抵抗整台伺服器被入侵的保證；Windows服務帳戶ACL尚待公司安裝驗證。

參考：[Gemini文字API](https://ai.google.dev/api/generate-content)、[Infinite Canvas](https://github.com/basketikun/infinite-canvas)。
