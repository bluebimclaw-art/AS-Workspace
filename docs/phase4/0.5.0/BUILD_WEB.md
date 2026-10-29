# Web 產物來源及維護

部署優先用已驗證 Release ZIP；不需要 Rust。從 Git clone 的開發者，以已有 GitHub 登入下載當版 Web 資產，再執行 `npm run grid:install -- <grid.zip>`、`npm run office:web -- <office-zip-folder>`。私人 Release 不可假定 Node 匿名 fetch 有權限。

本輪 Windows 開發工具全部在新平台 tools：Rust1.99.1、wasm32-unknown-unknown、Trunk0.22.0；host用相容LLVM-MinGW的gnullvm，沒有全域安裝或改PATH。源碼用固定commit與Cargo.lock，Trunk release --locked；WASM最佳化後產物才接入。

| 輸入 | 固定來源與 SHA-256 |
|---|---|
| WordCraft source ZIP | commit `9130181a5fdaee2293e67756fd5458c601489f3c`；`d11e21583b34fb8b8f80daae7f4bfe1ef3b5722404ea43d93ff39384db46a84c` |
| PdfCraft source ZIP | commit `53199fb4fa36f3c95b539add6218c57aeb2f823c`；`2c69a9a68c6cf40ffd26acdf1e67e3f4ecaee176705040f9902cbfcc6559217c` |
| craft-fonts source ZIP | commit `fff559f5f038112a4135e95c720161d4d0a5b335`；`1c0d613f0657c61a4212c9d43250b5394cd0bde3dd85bf03bb3bc0dc6ed07618` |
| PDF TC fallback | LXGWWenKaiTC-Regular.ttf v1.530；`6662480a3f95b4a90c80b189c679617a48adce3a505118a6af63ce5a482b83fa` |

ZIP URLs 為 GitHub codeload 的固定commit，字型為 lxgw/LxgwWenkaiTC v1.530 官方Release；核對hash才解壓。完整來源與授權檔保留在對應Web產物，未複製 docs/brand 商標資產。

Word：解壓到 `tools/office-web-build/source/wordcraft-<commit>`，craft-fonts 到 `tools/office-web-build/fonts/craft-fonts-<commit>`。執行 `scripts/patch-word-web.mjs <source>`，設定 CRAFT_FONTS_DIR 後，`trunk build --release --locked --config <source>/apps/wordcraft-web/Trunk.toml`。平台橋接的可讀源碼是 `vendor/wordcraft/platform_host.rs`；只接受同源父框架、5MB上限，將保存交回平台，不含網絡／帳戶／檔案系統權限。

PDF：解壓到 `tools/office-web-build/pdf-source/pdfcraft-<commit>`，執行 `scripts/patch-pdf-web.mjs <source>`。字型輸入在 `tools/office-web-build/pdf-fonts`，沿用 craft-fonts 的 manifest 格式，包含 BIZ UDPGothic Regular 及新增 `LXGW WenKai TC | Regular | fonts/lxgw-wenkai-tc/LXGWWenKaiTC-Regular.ttf | Hans,Hant,Latn | OFL-1.1 | fonts/lxgw-wenkai-tc/OFL.txt | <上述hash> | <官方Release>`。保留各OFL。上游禁止的字族清單沒有修改；未把 Noto CJK 放入 PDF build。設定 CRAFT_FONTS_DIR 後用相應 apps/pdfcraft-web/Trunk.toml 建置。

兩邊完成才執行 `scripts/publish-office-web.mjs`：產生獨立修訂版資料夾、gzip、每檔manifest、Release資產與 config/office-web.json。更改程式或字型時，提升平台／修訂版號、重新驗證並發新Release；不要覆蓋已發布資產，也不把本機tools或秘密加入Git。重建是固定來源的可審查流程，未聲稱不同host會生成逐byte相同WASM。

字型授權來源：[craft-fonts](https://github.com/storytold/craft-fonts/tree/fff559f5f038112a4135e95c720161d4d0a5b335)、[LXGW WenKai TC OFL](https://github.com/lxgw/LxgwWenkaiTC/blob/v1.530/OFL.txt)。
