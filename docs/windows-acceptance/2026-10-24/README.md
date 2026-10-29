# Windows → Mac mini 跨機驗收整合報告

日期：2026-10-24（香港）

## 結論

**本次已測範圍通過：Windows Chrome 登入、共用 XLSX 儲存及版本保留、雙帳戶編輯互斥、真實 Ollama 排隊、正常 GUI 的個人對話隔離，以及 viewer 可讀、可手動下載、不可編輯及不可提交 AI。**

最新手動下載檔案的完整 SHA256 與 Mac 平台 v2 記錄完全一致，兩套讀取方式均確認數值及公式正確，中文字完整保存在檔案內。先前報告的「下載尚未通過」已由本次結果更新；**自動下載事件捕捉及瀏覽器封鎖仍未解決**。

此結論適用於已測的兩名 member 加一名 viewer，不代表 5–10 人容量、全部平台功能、後端權限安全或正式上線驗收已完成。建議先修正中文顯示及下載自動化問題，再進行 5–10 人受控試點。

## 環境及證據範圍

| 項目 | 核實範圍 |
|---|---|
| 平台 | Mac mini 上的新平台，介面/health 顯示 0.4.1；入口 https://<MAC_LAN_IP>:4317/ |
| Windows 瀏覽器 | 實際 Chrome＋ChatGPT 擴充功能；member 普通/無痕視窗分開登入，viewer 接續無痕登入；未記錄精確 Chrome 版本 |
| 帳戶 | trial01/member、pilot02/member、review01/viewer；使用者自行輸入密碼，沒有取得或保存秘密 |
| 模型 | 本機 profile ollama-local / gpt-oss:20b；本輪累積五項真實 AI 任務完成，沒有經 Hermes 提交 |
| 合成檔案 | Book1.xlsx，file ID 6c843983-5ed1-4172-abd3-9bffbabda7b5；既有 workbook.xlsx 未修改 |
| TLS | Windows Chrome 實際登入正常，無憑證警告；公開 CA 指紋及嚴格 HTTPS 驗證另有既有核對紀錄 |
| TLS 程式審閱 | 先前已審閱 [PR #1](https://github.com/ansonman/company-ai-platform-pilot/pull/1) 的固定提交 b819c70d1195910ac48f819a9fb34a7fba64e419；本輪不判定 PR 最新合併狀態 |

本報告整合本對話累積的 Windows GUI 證據，並加入本輪下載檔案唯讀核對。Mac 報告內的 31 tests、12 workflows、10 項隊列等是另一輪測試，沒有當作本次 Windows 重現結果。本輪沒有重跑 npm audit；先前 0 high、0 moderate、4 low 是歷史結果。

## 通過項目

| 驗收項目 | 實測證據與邊界 |
|---|---|
| Chrome 跨機登入 | 三個帳戶均在正常平台頁面顯示正確角色；pilot02 登出亦回到登入頁 |
| 儲存、關閉及重開 | trial01 新建 v1，2×123.45=246.9；重開仍保留 =B2*C2 |
| 雙向編輯互斥 | trial01 持鎖時 pilot02 被拒；pilot02 持鎖時 trial01 同樣被拒；均顯示持鎖者及稍後重試提示 |
| 釋放後取得檔案 | trial01 釋放後 pilot02 能編輯；pilot02 釋放後 trial01 能重開最新 v2 |
| v2 儲存與重開 | pilot02 將 B2 由2改3並保存 v2；trial01 重開得到370.35，公式保留 |
| 版本及資料保留 | v1/v2 均在平台版本記錄；本輪找到的 v1、兩份 v2 下載檔完整雜湊均與各自伺服器版本一致 |
| 單帳戶排隊 | 不同功能提交任務，實際看見一項執行中、另一項排第1位，其後完成；同文件尚有任務時重送會被阻止 |
| 雙帳戶排隊 | trial01與pilot02約相隔1.2秒提交，分別看見執行中/排隊第1位，兩項其後均完成 |
| 文件 AI 來源 | v1、v2 問答均正確讀出相應數值及公式；來源標示保存版本。只驗證這些讀取結果，不保證一般建議正確 |
| 正常 GUI 對話隔離 | 每名member只顯示自己的測試問題標記，未顯示另一人的問題；viewer未顯示member任務/對話 |
| viewer 可讀 | review01搜尋370.35得到Book1.xlsx/Sheet1/v2，以及B2=3、C2=123.45、D2=370.35與公式 |
| viewer 可手動下載 | 使用者以review01手動下載；本輪在Windows找到最新檔，完整雜湊、大小及內容核對通過。手動點擊由使用者確認，本輪未自動重現該點擊 |
| viewer 不可編輯 | 實際按GridCraft編輯被拒；新建、上載、抽取、還原停用；Office執行表單不提供、白板保存停用 |
| viewer 不可提交 AI | 輸入非空合成問題後傳送仍disabled，沒有任務產生；未繞過停用按鈕構造後端請求 |

雙帳戶任務建立時間為 2026-10-24T14:11:20.235Z、14:11:21.422Z。它們不是開始/完成時間，不能用來量度精確等待、推理耗時或吞吐量。

## 下載檔案內容及完整性

核對原檔：最新 v2（本機下載檔；不隨 repo 交收），4,200 bytes；另有 v2 副本（本機下載檔） 及 v1（本機下載檔）。所有檔案均唯讀，沒有重新儲存或轉檔。

| 儲存格 | v1 | v2 |
|---|---|---|
| B2 數量 | 2 | 3 |
| C2 單價 | 123.45 | 123.45 |
| D2 結果 | 246.9 | 370.35 |
| D2 公式 | =B2*C2 | =B2*C2 |

完整 SHA256（由正常登入的瀏覽器唯讀開啟 `/api/state`，只保存該合成檔 metadata，再與本機檔案逐一比較）：

```text
v1: 1b3fc90a9c2c7ca58e046bd540f52cdf136ac118351f4c3056876c2925f8a841
v2: 1184047b64b1497de26cb8ab0f10054cf908faf99b08bbb00cae0edcfb63ce35
```

三個下載檔均與對應伺服器完整雜湊及大小相符；兩份 v2 逐位元一致。ZIP 10 個項目的 CRC、必要 OOXML 部件及所有 XML 解析通過，沒有重複 ZIP 項目、加密項目、巨集或外部關聯。

原始XML解析與獨立 Artifact Tool 匯入均確認 v2 數值及公式；以十進制重新計算3×123.45=370.35亦與檔內結果相同。v1→v2 的儲存格內容只有B2數量及D2結果改變，公式與其他文字不變。

中文實際保存為「Windows 試點驗收」「數量」「單價」「金額」「合成測試」，沒有變成方框或替代字元。因此已排除本次合成檔中文字遺失；尚未確認GridCraft顯示問題的根因。沒有在Microsoft Excel原生應用開啟及重算。

## 已發現問題及處理建議

| 問題 | 影響及下一步 |
|---|---|
| GridCraft中文字顯示方框 | 檔內中文字完整，但編輯器不易閱讀；檢查Web字型載入/字形後備及Windows/Mac顯示，修補後重做中文輸入、儲存及重開 |
| 自動下載事件及瀏覽器封鎖 | 工具逾時，曾出現ERR_BLOCKED_BY_CLIENT；現在確認手動下載及內容完整，不可再歸因為viewer不能下載。需分辨擴充功能、網站下載批准及瀏覽器政策；不停止整體防護 |
| AI建議有錯誤 | 模型曾將空白乘法參照籠統說成#VALUE!，亦將一般建議附文件引用；正式業務建議仍需覆核，應用固定案例做內容評估 |
| 衝突通知未清除 | 成功取得鎖後，舊「另一人正在編輯」通知仍留著；應在成功後更新通知，避免誤判 |
| viewer入口文案 | 仍顯示可按的「在GridCraft編輯」及「向AI問此文件」入口，實際編輯拒絕/傳送停用；宜改成明確唯讀操作與角色提示 |
| App內置瀏覽器/主機名稱 | 早前內置瀏覽器仍有CA錯誤，Mac.local入口載入逾時；Chrome以固定IP已通過，不應將其他入口標成已修復 |

## 未完成項及下一輪驗收方法

| 項目 | 完成判準 |
|---|---|
| 5–10人容量 | 5/10個獨立帳戶並行讀檔、編輯及AI提交；量度等待/推理時間、失敗率、記憶體與swap，按公司可接受時間訂門檻 |
| Windows後端權限 | 在隔離資料及明確測試憑證下直接驗證viewer寫入/AI請求被拒，且內容、版本及任務均不變；本次GUI停用不能替代這項 |
| 過期版本/鎖/另存副本 | 重現舊版本及失效鎖Save被拒，未儲存內容可保留/下載/另存，不覆蓋最新版本 |
| 取消、故障及重啟 | queued取消確實不執行；服務重啟後不自動重送已開始任務，版本資料可恢復 |
| 原生Excel及中文顯示 | Excel開啟重算與保存相容；GridCraft中文修補後在Windows/Mac重測，沒有修復提示或資料遺失 |
| 新安全掃描及正式部署 | 重跑依賴掃描、備份還原、開機啟動及憑證/帳戶管理；單一程序JSON、無SSO/MFA/細分ACL/高可用仍是現有架構限制 |
| 其餘模型/功能 | Windows本輪只測gpt-oss:20b；gpt-oss:20b-64k、雲端/地端切換、Hermes、完整Office及白板編輯未在本輪覆蓋 |

PDF OCR、語意搜尋、BIM/CAD亦不屬本次跨機驗收範圍。沒有把它們列為已完成。

## 證據及變更範圍

- [下載完整性結果](results/download-integrity-results.json)、[伺服器版本metadata](results/server-file-integrity.json)、[獨立匯入結果](results/artifact-workbook-inspection.json)
- [v1儲存重開](screenshots/grid-reopen-v1.png)、[pilot02衝突](screenshots/pilot02-lock-conflict.png)、[版本保留](screenshots/dual-conflict-versions.png)、[trial01重開v2](screenshots/trial01-reopen-v2.png)
- [trial01執行中](results/dual-ai-trial01.txt)、[pilot02排隊中](screenshots/dual-ai-queue.png)、[v2回答](screenshots/pilot02-v2-ai-answer.png)、[對話隔離](results/dual-privacy.json)
- [viewer可讀](screenshots/viewer-search.png)、[viewer操作限制](screenshots/viewer-controls.png)、[自動下載封鎖畫面](results/download-diagnostic.md)

較早的 WINDOWS_GUI_ACCEPTANCE、WINDOWS_DUAL_ACCOUNT_ACCEPTANCE、WINDOWS_VIEWER_ACCEPTANCE 保留逐輪歷史，本報告為最新整合結論。本次 GitHub 交收只包含本報告及已審閱的合成證據，不更改 Release。

本次只讀取下載檔案及已存在證據，經正常登入讀取該檔版本metadata，並在新平台資料夾新增報告/核對結果。既有工作簿、應用程式、舊平台、Hermes、Ollama、帳戶、CA及網絡設定均沒有修改。

## GitHub 證據交收說明

本資料夾只含合成測試數據、已逐張審閱的應用內容截圖及最少必要結果。已移除 Windows 個人絕對路徑、內網 IP 和主機名稱；trial01、pilot02、review01 是本次試點測試帳戶名稱，沒有密碼或雜湊。沒有憑證、私鑰、Cookie、token、API key、users.json、store.json、環境設定、原始工作簿、執行檔或 runtime 目錄。

截圖只能證明當時可見內容，可能落後於操作後 AX 狀態；trial01 執行中以 results/dual-ai-trial01.txt 為證，未發布畫面仍停留在 GridCraft 的同名 PNG。完整雜湊/內容核對以 JSON 結果為證。圖片未修改；JSON/TXT 僅移除本機路徑及網絡識別資料。MANIFEST.json 提供本次交收檔案雜湊。

後續修補任務見 [Mac mini 助手 prompt](MAC_FOLLOWUP_PROMPT.md)。
