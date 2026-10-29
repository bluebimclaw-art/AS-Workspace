# v0.11.0 Revit唯讀Connector — Windows實測及跨機待驗

日期：2026-10-26（香港）。使用者授權先驗Windows本機新平台，再完成Mac至WindowsConnector。只修改新平台；沒有改舊平台、Hermes、原MCP專案、Add-in或模型。

## 已實作

- Web左側Revit MCP入口保留：未授權只顯示請Admin批准提示，不取得模型／工作站資料。Admin逐使用者批准bim/read，viewer不能提交探測。
- 連接中心：Windows本機設定及測試、遠端工作站在線／離線／最近結果、工作站選擇與固定唯讀探測；Admin配對token及撤銷。
- 中央RevitRelay：裝置授權hash存SQLite，30日有效；只允許poll/report固定probe-readonly。Bearer不等於使用者session，不可用來查一般平台API。
- Windows agent：只出站至已配置中央URL；HTTPS指定CA、SAN驗證，不略過驗證／不跟redirect，不公開8964。執行固定既有MCP唯讀探測，不能指定任意tool／shell／路徑參數。
- 查詢依使用者bim權限及工作站配對授權核對；每工作站一項；撤權、離線、忙碌、逾時、已消耗結果及重啟不重播。viewer拒絕；審計不記模型摘要內容。
- 維持MCP server版本不符阻擋、Revit年份不符停止樓層查詢、未知版本警告；所有模型寫入一直關閉。

## 真實Windows/Revit證據

2026-10-26約08:47／08:54 HKT，本機既有Revit已開啟。未操作Revit UI或切換／保存模型。

| 項目 | 本輪結果 |
|---|---|
| 直接既有MCP握手 | revit-mcp-server 1.0.0；initialize及tools/list成功 |
| 新平台獨立data／登入 | 新建本輪合成Admin，登入200；沒有使用舊平台data |
| 新平台POST /api/bim/probe | 200，connected-readonly |
| 目前模型資料 | get_project_info成功；模型名稱只留ignored本機證據，不公開 |
| 樓層 | get_all_levels成功，2層，高程0及4000mm |
| 出站Connector relay | Windows中央程序→輪詢Windows worker→既有MCP→真Revit成功，回同一樓層摘要 |
| Revit／載入Add-in年份 | MCP沒有回報；actualRevitYear=null，警告仍在，不能聲稱完成相容性握手 |
| 模型寫入／儲存 | 未執行；沒有產品寫入入口 |

重要邊界：relay的真實模型測試是在Windows同機兩個角色流程，不是Mac→Windows跨機。08:54測試入口是短暫loopback57919，測後關閉；不是供公司LAN使用的固定服務。早先本輪GUI預備程序亦已停止。

## 自動及build驗證

- Windows Node回歸108/108，0 failed/skipped；production build通過。
- 新增relay單元／HTTP測試：tokenhash／公開資料去秘密、固定工具、錯token、重複report、撤銷、viewer、無BIM權限、離線／忙碌、排隊後撤權、逾時及平台重啟不重播。
- 新增真TLS合成測試：指定CA／SAN成功；不信任CA、錯Bearer、redirect及遠端HTTP拒絕。沒有安裝系統CA。
- 合成MCP維持server版本／Revit年份不符阻擋及固定端口傳遞測試。
- 真實模型兩次probe經登入平台／agent成功；原始模型名稱及回應只留evidence/revit-v011，不加入release／GitHub。
- 本輪瀏覽器工具回報Local browser use is disabled in Work settings，所以新增Revit頁面GUI未驗；build及API不能代替GUI點擊驗證。沒有嘗試繞過限制。

## 未完成及下一步

1. Mac現行v0.10.0沒有新relay路由；需由Mac助手在新目錄部署v0.11.0，HTTPS交收並安全配對Windowsagent。未有Mac遠端終端能力，這一段本輪未部署／未測；不能標為成功。
2. 新Revit UI在Windows／Mac瀏覽器點擊測試、配對token人工安全交接、Mac→Windows真實Revit結果、撤銷／離線跨機驗收待完成。
3. 真實Revit及已載入Add-in版本握手、模型切換身份綁定、多Revit session、多agent協調、長期服務／重啟、寫入／預覽／回滾均未完成。不要用此版寫入或自動建模。
4. 心跳／結果程序內保存，重啟後要重新心跳；配對授權持久化。需要一台工作站一個agent，中央沒有跨多平台實例的分散鎖。
5. 之前viewer自動下載、預設模型顯示、公司Hermes／容量的待辦仍保留，本輪未擴大範圍修補。

部署及兩端分工見REVIT_CONNECTOR_011.md、MAC_REVIT_011_PROMPT.md。這是可交Mac部署的跨機Connector實作，尚未完成整條跨機驗收。
