# Third-party attribution and public distribution boundary

This repository is an independent company-pilot integration. It is not an official ArtCraft/Excalidraw product and does not claim endorsement, ownership of upstream components or rights to their trademarks.

| Component | Version / provenance | Included notices |
|---|---|---|
| WordCraft / PDFCraft / DeckCraft / GridCraft integration materials | 0.10.0 / 0.13.0 / 0.10.0 / 0.11.1 | `third-party/<component>/`: MIT, Apache-2.0, brand terms and other license/NOTICE/attribution/font files from the exact upstream tag. Existing snapshot notices are preserved. |
| Excalidraw | 0.18.1 | `third-party/excalidraw/LICENSE`, plus font notices below. |
| Infinite Canvas | Snapshot vendor build | `third-party/infinite-canvas/LICENSE`, `THIRD_PARTY_NOTICES.txt`. |
| Compiled host JavaScript dependencies | Pinned package-lock tree | `third-party/HOST_NPM_NOTICES.txt` preserves 256 installed package copyright/license entries, including some build-time packages. Dependencies not redistributed here are separately fetched by npm and retain their own licenses. |
| Comic Shanns | Exact v0.18.1 font bytes | MIT copyright and full permission text from upstream font source metadata. |
| Excalifont / Xiaolai | Exact v0.18.1 font bytes | Pinned source notices, original embedded copyrights and SIL OFL-1.1 text. Excalifont is an Excalidraw trademark; no trademark rights are granted. |
| Assistant / Cascadia / Lilita / Nunito / Virgil | Exact v0.18.1 font bytes | Original metadata copyright statements plus corresponding OFL files / upstream notices. |
| Liberation Sans | Public copy uses 2.1.5, replacing ambiguous 1.05 copy | Full 2.1.5 OFL-1.1 license; official release archive and hash recorded. This is a public-only font change, not a production update. |

`third-party/SOURCES.json` and `ADDITIONAL_SOURCES.json` give public upstream URLs. Font metadata is preserved in `third-party/fonts/EMBEDDED_COPYRIGHTS.json`. License/source checksums and public binary changes are recorded under `deployment/`.

## Branding changes
The upstream brand licenses require removing ArtCraft Marks from distributed modified versions. The public PDFCraft WASM replaces the three exact embedded ArtCraft SVG assets with a valid transparent SVG plus whitespace, preserving every data segment's byte length. No instructions are changed. Unmodified bytes outside the explicitly documented asset spans are checked against the original; all WebAssembly modules are structurally validated. No right to reuse the original ArtCraft Marks is asserted. Plain-text upstream attribution and copyright/license notices are retained.

The public snapshot includes this notice and license collection under `dist/third-party/`. Keep them with redistributed copies and follow each upstream license. Do not call the integration an official upstream build. This technical provenance/attribution review is not a legal opinion, trademark permission, a blanket warranty of legal compliance, or a grant covering all company-authored code.
