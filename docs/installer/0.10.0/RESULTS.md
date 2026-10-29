# v0.10.0 安裝精靈與 Hermes adapter — 驗證結果

更新：2026-10-26（香港）。開發／測試平台：Windows，Node v24.14.1。只處理新平台；未更改舊平台、Hermes、Ollama或Revit。公司盤點是使用者交來的報告，本輪沒有連公司主機。

## 已實作

- 新獨立本機安裝精靈：新程式／資料位置、資料夾瀏覽、RAM／空間／端口預檢、LAN HTTPS／公司憑證或pilot CA、首次Admin、Hermes設定、搜尋／原生Craft依賴選項、變更確認、安裝結果及啟動health檢查。
- Windows cmd與Mac command入口；啟動精靈前不需npm ci，但需要已批准Node。目標新目錄內做固定npm依賴安裝、build及中英OCR資料準備；不改全局PATH／系統Java。
- 程式與data獨立，拒絕非空目錄、Hermes相關目錄、彼此包含或覆蓋來源。canonical path防別名；跳過符號連結、秘密及舊資料。Windows新目錄限制ACL；密碼雜湊，Hermes key沿用Gateway後端加密。
- bootstrap只綁127.0.0.1，一次性token、Host／Origin限制、無前端任意命令；完成設定後鎖定寫入入口。結果不含密碼／key。
- Hermes文字adapter、明確loopback偵測／手動URL、Bearer認證及模型清單、明確合成生成測試。只查指定本機端點，不掃網段或讀取Hermes秘密。
- transport connectionScope與inference外送分開；本機HTTP可以接雲端／混合Hermes，遠端HTTP仍拒絕、localhost固定至127.0.0.1、redirect拒絕。local-only與來源cloudAllowed限制保留。
- Hermes每次模型呼叫由後端產生獨立session ID；歷史由平台自行按帳戶提供。保存新Hermes設定預設停用、只指定首次Admin；不能據health／session header宣稱Agent工具／共享記憶已隔離。

## 本輪實測

| 驗證 | 結果與範圍 |
|---|---|
| Node回歸 | 103/103，0失敗／跳過；含既有Office、角色、版本衝突、隊列、搜尋及新增安裝／Hermes測試 |
| Web build | 通過；既有上游bundle警告保留，不是新增建置失敗 |
| 真實Craft／HTTPS回歸 | 8/8：原生Word/PDF/Deck/Grid背景流程、登入／下載、重啟與離線備份還原；使用歷史多項目相容測試模式，不代表公司新部署容量 |
| 真正乾淨安裝 | 新暫存目錄執行npm ci/build/OCR準備，建立首次Admin，啟動真平台，health0.10.0、未登入state401、Admin登入／管理頁及單一共用空間read/edit權限通過；測後移除本輪暫存安裝 |
| 啟動helper | 新程序health版本核對成功；已佔用端口拒絕，不停止未知PID；測試後只停止本輪程序 |
| TLS匯入 | 新生成測試憑證驗匹配私鑰、SAN、serverAuth、有效期及直接簽發CA；錯IP／錯key拒絕；未安裝系統CA |
| 合成Hermes HTTP | health200 vs models401、Bearer模型清單、公開ID限制、非串流格式、每次session ID不同、拒絕redirect、去敏診斷與local-only拒雲端通過；沒有真實模型生成 |
| Windows Chrome GUI | 精靈頁面與資料夾瀏覽通過；指定本輪合成端點，health200／模型清單及合成AS_SETUP_OK生成按鈕成功；畫面仍標sessionIsolationTested=false、toolsScopeVerified=false |

GUI未完整提交首次Admin／整段安裝；首次Admin及真正安裝是獨立程式／HTTP驗證。不能把上述合成服務當作公司Hermes。乾淨安裝沒有勾選原生Craft或Java下載；背景Craft回歸使用開發機既有runtime。手填工具路徑只先檢查檔案存在，功能需doctor另驗。

本機原始證據在忽略的evidence/v010-tests.log、v010-build.log、v010-company.log、v010-installer-smoke.log/json及v010-wizard-hermes.png；GitHub只交去敏摘要。封裝清潔安裝驗證另以release validation JSON為準。

## 未完成及實機門檻

- 公司真實Hermes認證scheme、授權後公開model ID、真實生成、兩帳戶／共享記憶／工具隔離、上游取消及無人登入依賴；沒有連公司8642或讀取OAuth。
- 公司LAN HTTPS、其他PC信任CA／登入、5–10人Office／搜尋混合容量、RAM預算。公司只剩2.2GB可用RAM的歷史盤點不能視為容量通過。
- Mac v0.10.0實機安裝、GUI、OpenSSL／TLS及現有Ollama回歸。
- Windows Service／Mac自啟整合UI、MSI／bundled Node／全離線包、完整公司憑證鏈、半途續行及升級回退精靈。失敗保留checkpoint，這版要求另選新目錄重裝。
- 備份還原管理UI未完成；已有離線指令及歷史回歸不能取代公司目的地的還原演練。外部搜尋來源檔不包含在平台備份中。
- 文字Hermes不會自動取得生圖能力；真實生圖供應商／額度及完整Canvas人手驗收仍待。

定位：可交實機試裝的安裝精靈pilot，並非正式生產或無人值守安裝器。指引見COMPANY_INSTALL_010.md、公司及Mac prompt。
