#!/bin/sh
set -eu
cd "$(dirname "$0")"
exec node --env-file-if-exists=.env --env-file=config/central.env.local server/index.mjs
