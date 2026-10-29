# Public preview verification

## Public distribution changes, not a production deployment
- Original private ZIP is retained locally, with its SHA256 in `original-production-archive.json`; it is not an asset to expose publicly.
- The public preview removes three exact ArtCraft SVG data spans from PDFCraft WASM, replacing each with a valid transparent SVG padded to the identical byte length. Reverse reconstruction proves every byte outside these spans is unchanged. An unrelated-byte mutation is explicitly rejected.
- All four public WebAssembly modules pass Node/V8 structural validation. All234 public fonts parse;233 unchanged fonts match upstream Excalidraw0.18.1 Git blobs. Public-only Liberation Sans is now2.1.5 with official OFL-1.1 materials.
- Original781 private-snapshot files and live production frontend files were rehashed and remain unchanged. No live app/data/env/service was edited or restarted.
- Fifty upstream license/NOTICE/font/attribution files,9 font-family notices/copyrights,256 npm package license entries and existing Canvas notices accompany the public ZIP.

## Actual isolated execution
- A fresh cloned public checkout installed316 packages with `npm ci --ignore-scripts --no-audit --no-fund`.
- The new861-file public ZIP passed CRC and every extracted SHA256. `restore-deployed-frontend.py` actually restored it in that fresh checkout and verified all861 files, without starting a server or initializing any company data.
- Canonical `npm run test`:132passed,0failed,0skipped, exit0.
- Worker unittest discovery:17passed, exit0. Tests use the included non-sensitive synthetic/pre-existing fixture; no real image/model generation or company document submission occurs.
- Final uncompressed-public-tree secret scan and remote/anonymous repository+release verification are performed separately before publishing success is reported.

## Limits
This is a public-preview packaging/provenance and structural-verification result, not a legal opinion, trademark permission, full native Office-WASM editing/save/reopen/download E2E acceptance, production deployment, company data backup, dependency-vulnerability audit, or promise that rebuilding current source exactly reproduces the frontend. Do not redeploy the public variant onto the running company system without separate review.
