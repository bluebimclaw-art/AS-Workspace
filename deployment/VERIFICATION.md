# Export verification and restore boundary

## Actual execution
- Isolated export from the running0.11.0 application; no git initialization or copy writes inside the live app/data directories.
- Fresh dependency install in the export only: npm ci --ignore-scripts --no-audit --no-fund returned0 (316 packages). Dependency audit/upgrades were not requested or performed.
- Source/snapshot restore: scripts/restore-deployed-frontend.py executed against a fresh exported checkout. All781 files matched stored SHA256, public editor assets restored, no server/data initialization.
- Canonical npm test after restore:132 passed,0 failed,0 skipped, exit0.
- Worker unittest discover:17 passed after changing ONLY exported fixture references to fixtures/native-teapot.png. This fixture is a previously generated non-sensitive red teapot, not company data. No new image inference occurred.
- Snapshot ZIP CRC verified, every extracted file matched the frontend manifest.
- Export application sources were compared by SHA256 to formal sources when copied; worker runtime sources came from installed worker. Test suites were taken from the latest reviewed combined navigation/image staging; two worker test path references were normalized only in this export.
- Current normal published entry remains index-nav-902a12da0676fdb9.js. Rebuilding current source can publish the deferred Explorer UI; preserve the Release snapshot for exact deployed UI.

## Secret/data policy
Allowlist copied source/technical markdown/template configuration only. All environment locals/backups, model locals, TLS material, node_modules, data/accounts/sessions/databases, logs, evidence/screenshots, native runtime binaries and OAuth/service credentials were excluded from Git. Pattern scanning and exact known-live-secret comparisons apply to selected Git content and full uncompressed frontend snapshot; findings contain no values. Generic pattern hits in vendor binaries/chunks were reviewed as substrings inside longer alphanumeric/static-symbol data and token-boundary constraints were added; no live-secret matches were found. This is a scoped verification, not a guarantee against every possible encoded or unknown credential. Do not switch visibility to public.

## Acceptance limits
No new browser login/company document/image generation was run during this export. Historical14 navigation browser checks used actual served JS with synthetic editor/API messages, not native Office-WASM document persistence. Native runtime tools, company data and credentials require separate local provisioning. This Git/Release export is NOT a full machine or business-data backup.

## Re-run after a fresh clone
Download the attached Private Release frontend ZIP, then follow README restore steps. For Worker regression:
```
python -m unittest discover -s integrations/codex-image-worker -p 'test_*.py' -v
```
Do not run a smoke command that generates new images merely to verify this backup; it consumes subscription allowance.
