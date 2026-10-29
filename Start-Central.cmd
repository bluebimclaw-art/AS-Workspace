@echo off
cd /d "%~dp0"
node --env-file-if-exists=.env --env-file=config/central.env.local server/index.mjs
pause
