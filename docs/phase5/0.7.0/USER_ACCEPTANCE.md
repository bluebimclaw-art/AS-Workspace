# 返回後一次過驗收

本清單只使用新平台及合成資料。先不要搬公司圖紙或改Mac舊平台／Hermes。

1. 本機新公司預覽用company:preview，入口127.0.0.1:4323，帳戶密碼在本機忽略的config/company-preview-access.local.json。不要把該檔貼對話／提交GitHub。沒有預設真實模型；此預覽不是4319舊驗收服務。
2. companyadmin進管理中心：建立兩個項目A／B，分配companymember只進A、companyviewer只讀A；管理員若需讀A亦自行明確分配。管理設定完成後重新登入受修改帳戶。
3. A新增XLSX／DOCX／PDF／PPTX，保存、關閉、重開；索引並搜尋。B看不到A；換項目後舊版本／下載連結仍固定原項目，沒有權限便拒絕。
4. 同一瀏覽器兩個分頁分別開A／B，分別新增檔案，核對沒有錯存項目；同檔兩帳戶驗證鎖與409。
5. viewer可搜尋／下載，不能編輯／轉檔／提交AI；再只取消download權驗證下載被拒。閱讀與下載在瀏覽器內不能作DRM承諾。
6. 對member禁止WordCraft，確認側欄與API操作被拒；再以群組允許Word，明確deny仍優先。停用帳戶後舊登入失效；最後一名admin不可降級／停用。
7. 編輯器有未保存修改時試切換項目，應提示先保存／保留副本。另一管理員撤權時驗證內容保留與提示；此項GUI尚未通過，發現遺失即列阻擋。
8. Admin AI服務新增已批准provider，先查模型清單；再用合成文字真實提問。測local-only項目不能選雲端、無靜默fallback。不要在尚未核對額度／政策前提交付費或公司內容。
9. 停止新平台，company:backup備份到新目錄，再restore到另一新目錄；重新登入並核對檔案、版本及密碼。不要覆蓋原資料或把敏感備份交GitHub。
10. 另安排公司LAN與Mac新版、正式CA、5–10部電腦／8小時測試。Infinite Canvas、生圖、Revit及公司服務installer尚屬開發項，不能靠本清單勾選當完成。

另補DeckCraft：中文、多頁、圖片／圖表、Save ACK、成功後繼續編輯的dirty、保存失敗副本及viewer預覽。下載延遲由人手普通下載與工具下載分別記錄。
