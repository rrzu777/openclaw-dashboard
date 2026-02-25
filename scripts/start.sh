#!/usr/bin/env bash
set -euo pipefail

cd /root/.openclaw/workspace/repos/openclaw-dashboard

if [[ ! -f .next/BUILD_ID ]]; then
  echo "[start-guard] ERROR: missing .next/BUILD_ID (no production build). Run: npm run build" >&2
  # Exit 0 to avoid PM2 restart loops; we want a stable failure that can be alerted on.
  exit 0
fi

echo "[start-guard] OK: found .next/BUILD_ID=$(cat .next/BUILD_ID)"
exec node ./node_modules/next/dist/bin/next start -p 3000 -H 0.0.0.0
