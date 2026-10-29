#!/bin/zsh
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null; then
  echo 'Node.js 22.22.3+ required. Install an approved Node 24 runtime first.'
  exit 1
fi
npm run setup
