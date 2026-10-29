# DeckCraft Web 固定來源建置

上游 DeckCraft v0.10.0 commit `b47195feec0f0fe4220d8943ad1c8add5dad8072`，官方 codeload ZIP SHA-256 `07862101d20d91a48d6abbee73fc4d9bd0427e55b60cf1ad064e2637533995a7`。保留 MIT、Apache-2.0、NOTICE、ATTRIBUTION。不複製商標素材。

來源放 `tools/office-web-build/deck-source/deckcraft-<commit>`。使用專案本機 Rust1.99.1 gnullvm、wasm32-unknown-unknown、Trunk0.22.0及 LLVM-MinGW；不改全域PATH。執行 `node scripts/patch-deck-web.mjs <source>`，設定 CRAFT_FONTS_DIR 指向之前 PdfCraft 的開放字型資料夾、CRAFT_FONTS_REQUIRED=1，執行 `trunk build --release --locked --config <source>/apps/deckcraft-web/Trunk.toml`。

字型沿用 craft-fonts 固定來源的 BIZ UDPGothic Regular及 LXGW WenKai TC Regular1.530；OFL-1.1。LXGW 字型 SHA-256 `6662480a3f95b4a90c80b189c679617a48adce3a505118a6af63ce5a482b83fa`。上游禁止字族清單沒有改，沒有在 DeckCraft 嵌入 Noto CJK。來源及其他工具詳見前版 `../0.5.0/BUILD_WEB.md`。

`vendor/deckcraft/platform_host.rs` 只接受同源父視窗訊息，傳入檔案上限5MB，不持有認證／網絡／本機檔案權限。Save 交回現有 authenticated 檔案API；成功 ACK 只將對應文件快照標為已保存，之後新修改保持 dirty。Web 預設 Save 為 PPTX；原生桌面不變。WASM發佈以 `node scripts/publish-deck-web.mjs` 建立 gzip、每檔hash、授權及ZIP；使用者部署包內含已建置版本，不用Rust。

未執行上游完整 `cargo xtask ci`；此專案只承諾所列 WASM 建置與實測，沒有宣稱跨主機逐 byte 可重製或所有上游功能通過。
