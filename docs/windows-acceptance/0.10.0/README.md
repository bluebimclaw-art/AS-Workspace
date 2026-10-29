# Windows → Mac v0.10.0 GUI 驗收（核心流程通過，保留限制）

日期：2026-10-26（香港）。Mac入口 https://192.168.50.71:4331/。使用者自行登入asmember01；本輪只用新平台合成文件，未改舊平台或Hermes。本紀錄為部分驗收，不是5–10人容量或正式上線證據。

結論：本輪指定的登入／PDF及OCR搜尋／Word與Grid保存下載／雙帳戶編輯鎖與版本／真實AI排隊／viewer唯讀及手動下載通過。自動viewer下載觸發與預設模型顯示仍需診斷；舊版直接Save負面測試及其他模組不在本輪完成範圍。未修改程式或重新發布安裝包。

來源：平台v0.10.0，release commit b40ff585777378c1d71f86788d4599e9c22067c2；[Mac驗收PR #14](https://github.com/ansonman/company-ai-platform-pilot/pull/14)固定報告commit ffe2d3ef590f990225636a06ebe3e2186c9cef24。Mac的103/103與8項Craft回歸是其報告證據，本輪文件更新沒有再跑那些測試。

## 本輪 Windows 實測通過

- Chrome直接顯示登入頁，沒有憑證警告；同瀏覽器health顯示ok=true／0.10.0。公開CA另已核對PEM hash及DER指紋；沒有以略過TLS方式開頁。
- 登入後顯示asmember01/member、0.10.0、公司共用工作空間；逐功能導覽可用。
- 資料夾搜尋：批准合成來源顯示4檔／0錯誤；PDF類型篩選與ALPHA4827文字搜尋命中mixed.pdf第1頁；4827命中掃描第2頁並標OCR。
- Chrome實際繪製PDF第1頁與第2頁；中文掃描內容可見，切頁定位可用。人工捲動PDF本身會改變viewer頁碼，不能把外部「命中頁」標籤當作viewer目前頁碼。
- 圖片OCR：PNG類型＋香港，命中scan.png中文內容。
- 子資料夾／類型／模式：進入subfolder，.xls＋檔名sample命中sample.xls，明示filename-only；沒有宣稱支援舊XLS內容抽取。
- 讀取現有Ollama模型清單取得2項；明確選gpt-oss:20b。
- UNMATCHABLEZZZ2026的AI搜尋回沒有可引用內容，沒有引用；未量測本次上游呼叫數，不據此聲稱沒呼叫模型。
- 真實AI搜尋「ALPHA4827 在哪個文件？請引用原文。」完成，回答mixed.pdf第1頁[1]及readme.txt[2]；UI顯示兩段通過核對的原文：Native PDF content: stormwater ALPHA4827，以及Folder Search Trial drainage 香港 ALPHA4827。這次成功不代表先前Mac unverified原因已修復。
- WordCraft真正編輯器：新建含繁體中文及WIN010-WORD標記的Document1.docx v1；Save通知、關閉釋放及重新開啟通過，中文可見。下載按鈕成功產生本機檔案；ZIP CRC、word/document.xml及中文標記通過。共用檔案完整性按鈕回6695 bytes核對通過。
- GridCraft真正編輯器：新建Book1.xlsx v1，貼入中文欄名、2及125、公式=B2*C2；畫面計算250，沒有中文方框。保存及從共用檔案重開通過；下載成功，ZIP CRC、中文、公式及D2 cached value250通過；完整性按鈕回4185 bytes。
- 共用檔案同時列出Word及Grid的v1；沒有複製公司正式資料。

## 本輪合成檔案

| 檔案 | 平台file ID | 版本 | 下載SHA256 |
|---|---|---|---|
| Document1.docx | 6c2fba8d-d11f-400f-ba41-fac8ec632baa | 1 | c97c549737719aee7e9781616021875b5cbb7fbe659715ba01062d95802ad2e8 |
| Book1.xlsx | 33a6f313-8629-405a-b30b-6db62a3ebddf | 1 | 35a2525162b7e30167aac0a752ca72013672e62caa3d22851b21a679650bd3d5 |

本機原始證據在忽略的evidence/windows-v010：pdf-page1.png、pdf-page2-ocr.png、ai-search-verified.png、word-reopened-v1.png、grid-reopened-v1.png及兩份download.json。下載檔本身不納入repo。

## 雙帳戶增量（本輪 Windows GUI）

- 使用者自行另登入asmember02，與asmember01的帳戶身份分別在Chrome畫面核對；沒有取得或保存密碼。
- asmember01開啟Book1.xlsx v1時，asmember02嘗試編輯被拒絕，畫面提示「asmember01 正在編輯；請另存副本或稍後重試」。
- 第一帳戶把B2由2改3、保存v2；第二帳戶未更新的開啟請求提示「檔案已有新版本，請更新後重開」。這是GUI的舊版本開啟／lease取得拒絕；沒有故意繞過編輯鎖提交舊版Save，不能稱本輪已直接驗證舊版Save拒絕。
- 第一帳戶釋放後，第二帳戶更新及開啟v2成功，畫面B2=3／D2=375；再改B2=4保存v3，畫面D2=500，最後釋放鎖。
- 版本記錄保留v1/v2/v3。第一帳戶再次下載v1，SHA256與原始v1下載完全一致；另下載v3，兩者均通過CRC及平台版本記錄hash比對，D2分別250／500。
- v2平台記錄：4189 bytes，63d06e7053b6037d6421ccf4d88b4943690bcb619129eb5ed67175a43cb7e3ff（本輪未另外下載v2作CRC）。
- v3：4188 bytes，c8e8c34d4ebbfb3b100ea9d81c31f1e1575cab548937920fc04ffee122de414d，已下載核對。
- 兩帳戶提交真實Ollama聊天：A用gpt-oss:20b，createdAt=2026-10-26T00:04:03.836Z；B用gpt-oss:20b-64k，createdAt=2026-10-26T00:04:04.885Z。觀察A執行中、B排隊第1項，最後兩者均已完成，輸出分別含QUEUE-A-010及QUEUE-B-010。
- 各自的任務頁只顯示自己的任務；完整對話畫面樹核對A無B標記、B無A標記。這是本輪GUI隔離證據，不是猜job ID的直接API攻擊測試，也不是Hermes隔離驗證。
- GUI未列精確startedAt/finishedAt，本輪不提供推理秒數或精確無重疊時間結論；不把兩短任務當作5–10人容量。
- 證據另有peer-stale-version.png、peer-saved-v3.png、peer-ai-queued.png、peer-ai-completed.png、dual-account-summary.json及dual-version-integrity.json。

## Viewer增量（Windows GUI＋使用者手動下載）

- 使用者自行登入asviewer01，畫面核對role=viewer。新建、上載、Grid編輯、讀取工作簿、文件AI等按鈕停用；填入非空AI問題後「傳送」仍停用，搜尋頁的AI按鈕亦停用。
- 共用檔案／版本清單可讀；ALPHA4827的PDF搜尋及Chrome原生PDF第1頁實際預覽成功。沒有修改來源或共用文件。
- 完整性按鈕可讀Book1.xlsx v3，畫面回4188 bytes核對通過；這一步本身不是下載成功證據。
- 自動按下載後，15秒沒有download事件；當時Downloads未產生新檔，console無相關錯誤。原生工具授權逾時；Chrome下載管理內部網址亦受工具安全政策限制，沒有改用繞過方式查看或更改設定。原因未確定。
- 使用者在viewer手動下載後，新增Book1 (8).xlsx，4188 bytes。實際讀取該檔，SHA256=c8e8c34d4ebbfb3b100ea9d81c31f1e1575cab548937920fc04ffee122de414d，與平台v3及member下載完全相同；ZIP CRC通過，D2公式B2*C2及快取500通過。
- 所以viewer閱讀／手動下載可用，不能把自動下載事件逾時當作平台拒絕權限，也不能宣稱自動下載問題已修復。
- 這是Windows GUI操作限制的驗證，沒有以viewer直接POST嘗試修改或提交AI。直接API負面403已有另列Mac與自動測試證據，不能冒充本輪重測。

## 去敏證據

- [雙帳戶摘要](dual-account-summary.json)、[不可變版本下載核對](dual-version-integrity.json)、[viewer下載及權限摘要](viewer-summary.json)、[整合摘要](test-summary.json)。
- [有效AI引用](proof/ai-search-verified.jpg)、[舊版本拒絕](proof/peer-stale-version.jpg)、[第二帳戶排隊](proof/peer-ai-queued.jpg)、[viewer唯讀控制](proof/viewer-readonly-controls.jpg)、[viewer PDF預覽](proof/viewer-pdf-read.jpg)。
- 不上載下載檔、密碼、cookie、token、私鑰或原始程序日誌。公開CA核對用的本機證據仍留evidence。

## 發現及未完成

- 小問題：首次搜尋頁顯示「未選模型」，但左下摘要顯示provider預設gpt-oss:20b；展開欄位仍是空白。手動選擇後一致且生成成功。待改善預設模型顯示；本輪未改程式。
- Mac報告先前的AI搜尋unverified，本輪不同明確問題取得有效引用；沒有原始失敗回應，不能判定原因或標為已修復。
- 兩member與viewer已完成以上GUI範圍；新無痕視窗可能共用同一無痕登入，身份以每次平台畫面核對，不據視窗數推斷。
- viewer自動下載觸發待診斷；手動下載及內容完整性通過。精確AI執行時長、Windows直接API負面寫入／猜ID測試未做。
- PdfCraft／DeckCraft完整編輯、Canvas／圖片版本、背景生成及容量不屬本輪已通過清單。
- 沒有安裝自啟或更改CA／服務；沒有GitHub合併。公司Hermes／實機、雲端生圖、多人容量及備份目的地仍待各自驗收。
