# v0.9.0 Mac report review／v0.9.1 修補

2026-10-25。已讀 GitHub PR #11（170036192df5b35cf848e83662eba4705035a535）三份報告及全部程式差異。PR 保持 draft，沒有合併或改動 Mac 現行部署。

## Review 結論

- Mac canonical path／失敗索引重試修補正確，採用到 v0.9.1 開發分支。報告中的 87/87、真實 Ollama 雙帳戶排隊、模型切換及 Mac GUI 是 **Mac 助手已上載的證據**；這輪 Windows 沒有重新執行那些 Mac 測試。
- 版本標示改為從 package.json 讀取，避免下次 release 再留舊字樣。
- Mac 報告不是未修改的 v0.9.0 release：是固定 release 再加 PR #11 修補。新 patch 將此差異正式納入。
- Mac 使用 Node 26.10.0，超出文件首選的 Node 22.22+／24 LTS 組合；本次通過不等於所有 runtime 已支援。Poppler 來自 bundled cache，正式服務應固定依賴路徑。
- 黑色 PDF 預覽只有內置瀏覽器證據；Windows Chrome 本機實測可繪製第1頁。但找到同一 PDF 第1頁→第2頁只更新 fragment 時，Chrome 頁面未跟隨跳轉，已修補並視覺重驗成功。
- AI 找不到指定字串卻附無關引用是真問題，已加防護；這不代表一般自然語言的語意相關性或答案真實性已完全解決。

## 新修補

1. 缺失指定編號／引號字串時，在呼叫模型前回 no-match、零引用；不能用擴展的一般詞代替指定字串。
2. 模型必須回結構化答案及逐字原文 evidence。檢查來源索引、引用編號、引文是否存在；不合格回 unverified、零引用，不發布未核對答案。no_match／否定找不到的答案不附候選引用。
3. 只顯示實際引用過的來源，重新編號，UI 顯示核對原文。這是字面引文驗證，**不能證明引文支持每句推論**；embedding／語意重排仍未加入。
4. canonical root 防護不只存檔時執行，也在讀取時攔截舊版本可能保存的不安全來源。來源可列出但不能讀取，Admin 應刪停／重新批准。
5. PDF iframe 用來源／檔案／hash／頁碼作 key，切頁重新載入 PDF viewer。Windows Chrome 已確認從第1頁切至第2頁，工具列顯示2/2且掃描文字可見。
6. 新平台 TLS 腳本補 CA／server AKI、SKI，支援 --port／--bind，預設綁指定 host 而非全部網卡。保留檔案存在就拒絕覆蓋的行為；不安裝 CA、不改防火牆、不啟動服務、不更換舊憑證。

## 本輪 Windows 實測

| 項目 | 結果 |
| --- | --- |
| Node 回歸 | 94/94，0 failed/skipped |
| build | 通過 |
| 新版 HTTP smoke | 真實 Java PDF／本機中英 OCR，原檔 hash 不變；AI 是合成模型端點 |
| 指定不存在字串 | HTTP 任務 no-match、零引用，模型呼叫數不增加 |
| 引用測試 | no-match、偽造引文、錯誤索引、非JSON／null、引用重新編號均覆蓋 |
| TLS | 隔離臨時目錄生成；OpenSSL verify -x509_strict -purpose sslserver -verify_ip 通過；沒有修改系統信任 |
| canonical root | Windows junction alias 及歷史 unsafe source 讀取均拒絕 |
| Windows Chrome 本機 | 專用 synthetic admin 登入；PDF類型／文字內容、OCR第2頁命中、PDF第1頁實際繪製、第1→2頁跳轉修補後通過 |
| Windows→Mac TCP 4330 | 2026-10-25 12:51 UTC，192.168.50.71:4330 timeout；這不是 TLS 或登入測試 |

本機 Chrome 使用獨立 127.0.0.1:4332 預覽及合成文件，**不是 Mac 跨機驗收**。本機證據在 ignored evidence，包含兩張 PDF 預覽 screenshot；只提交去敏測試摘要。未在 Windows 本機接真實模型，未聲稱新版結構化提示已通過真實 Ollama。Mac v0.9.0 的真實推理結果不能代替新提示重驗。

## 跨機未完成原因及下一步

Mac v0.9.0 僅綁 127.0.0.1:4330，未提供 LAN HTTPS／新 CA，Windows 不能接入。沒有改用明文 LAN 登入、忽略 TLS、借用舊平台入口或遠端改 Mac 系統。舊4317不可達只是 Mac 報告中的歷史觀察，本輪沒有調查／重啟它。

請以 MAC_INSTALL_091_HTTPS_PROMPT.md 交接：新 v0.9.1 目錄／新data、核對新release、Mac回歸／真實 Ollama 引用防護、專屬LAN HTTPS、只交公開CA及指紋。新CA匯入由Windows使用者操作；交接入口後才可做 Windows member/viewer、下載hash、雙帳戶隊列、PDF／OCR／AI GUI。

尚未完成：新版Mac／LAN／真實Ollama、公司NAS／容量、背景自動同步、Office外部來源內容解析、embedding、較廣自然語言相關性及LLM引用推論準確性。新release／部署ZIP乾淨安裝驗證以release隨附validation JSON為準。所有舊服務、Hermes、Ollama設定及Revit未改。
