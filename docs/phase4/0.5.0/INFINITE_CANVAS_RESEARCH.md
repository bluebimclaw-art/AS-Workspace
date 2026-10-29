# infinite-canvas 是否適合公司效果圖工作台

研究日期：2026-10-25。核對 [main 固定來源 9f2bd9f](https://github.com/basketikun/infinite-canvas/tree/9f2bd9f1b27c45fd1b8f5323072b07243f9e0fac)；最新標記 Release 為 [v0.20.0](https://github.com/basketikun/infinite-canvas/releases/tag/v0.20.0)。main 與 Release 分開看，不能假定所有 main 功能已包含於該 Release。本輪只研究來源，沒有接駁公司模型、執行生圖、安裝插件或修改現有平台。

## 判斷

可以使用，適合作為效果圖工作台的候選前端；不宜原封不動當成公司中央平台。它比 Excalidraw 更接近「參考圖 → 提示詞 → 生圖／改圖 → 比較及延伸方案」的創作流程。Excalidraw 繼續負責會議草圖及標註，兩者用途不同。

這是按使用者先前要求的效果圖工作台及已提供截圖作比較；本輪沒有重新完整觀看先前影片，因此不是對影片每個功能的逐項等效認證。它也不提供 BIM 幾何、CAD 精度、施工圖生成或建築規範核對。

## 已核對的能力與缺口

| 公司所需 | 來源證據及判斷 |
|---|---|
| 無限畫布、參考圖與流程連線 | 有圖像／文字／影片節點、連線、撤銷、匯入匯出，可用來整理方案及參考圖。 |
| AI 效果圖迭代 | 有文字生圖、參考圖編輯、模型／提示詞／參考記錄，方向吻合。建築專用一致性、尺度及材質效果仍要用實際項目驗收。 |
| AI 助手及 MCP | 有 Canvas Agent 與 Codex / Claude Code 接口，能操作畫布；不等於已接上 Hermes 或公司 skills。 |
| 雲端／地端切換 | 有多渠道及自訂模型，但圖片服務必須提供相符的生圖／改圖 API；只有聊天 API 不代表能生圖。公司現有 Ollama 的圖片能力本輪未驗證；ComfyUI 需要另做 adapter 及測試。 |
| 公司共用檔案與版本 | 預設資料存在瀏覽器，WebDAV 為可選同步；不能代替現有中央資料庫、版本及衝突處理。 |
| 登入、member／viewer、全公司排隊 | 前端專案沒有現成公司帳戶／中央儲存。需要接回本平台的登入、資料權限、來源快照及 queue。 |
| 長期保存 | 上游明言資料格式仍可能變更，需固定版本、自管遷移及備份，不直接追蹤 main 更新。 |

上表依 [官方功能文件](https://github.com/basketikun/infinite-canvas/blob/9f2bd9f1b27c45fd1b8f5323072b07243f9e0fac/docs/content/docs/overview/features.mdx)；不是本輪生圖功能實測。

## 原始碼核對

- [file-storage.ts](https://github.com/basketikun/infinite-canvas/blob/9f2bd9f1b27c45fd1b8f5323072b07243f9e0fac/web/src/services/file-storage.ts) 使用 localforage 保存媒體 Blob 及 object URL；公司整合應改成中央檔案 ID／版本／SHA-256，瀏覽器快取只作加速。
- [image.ts](https://github.com/basketikun/infinite-canvas/blob/9f2bd9f1b27c45fd1b8f5323072b07243f9e0fac/web/src/services/api/image.ts) 在前端組合 Base URL、Authorization 與模型請求。公司版應轉交後端代理，僅讓使用者選擇批准的渠道／模型；秘密不送入瀏覽器，執行前記錄來源版本及成本參數。
- README 提供遠端節點插件及自訂呼叫腳本。公司版宜先用固定內建節點；將插件／腳本納入批准清單，避免使用者自行引入未審核程式。

## 授權與成本

[LICENSE](https://github.com/basketikun/infinite-canvas/blob/9f2bd9f1b27c45fd1b8f5323072b07243f9e0fac/LICENSE) 是 MIT：可修改及商業使用，須保留版權與許可聲明。README 另要求二次開發保留作者資訊及頁面標識；公司版可以清楚標示來源。第三方提示詞、插件、模型及素材各自的授權仍需另查。這不是對所有依賴的法律審核。

軟件本身無 MIT 授權費；主要成本是中央資料／模型代理整合、圖片或影片推理費、媒體儲存及維護。未提供批准的圖片 API、圖片數量及解像度，現階段不捏造每張價格或工期。Mac M4 可以承載前端及排隊服務；地端生圖速度與多人容量尚未實測。

## 建議接入次序

1. 保持 Office 本輪驗收獨立，不把創作畫布塞進同一次發行。
2. 下一輪固定來源版本做獨立「效果圖」模組，先驗證圖片上載、畫布保存、重新開啟及 viewer 唯讀，不呼叫生圖。
3. 透過後端 adapter 接一個批准的圖片端點，沿用共享 queue；測試文生圖、參考圖改圖、取消／失敗、來源及產物版本。不默默 fallback。
4. 通過後才加入第二個雲端／地端圖片服務、批次比較、匯報引用及 skills。以同一份建築參考圖比較構圖、材質與幾何保持，再決定是否取代自建效果圖介面。

結論：適合採用其創作介面及節點設計，需開發中央資料／權限／模型代理的接合部分；目前沒有證據可稱它已等同先前影片中的整個建築平台。
