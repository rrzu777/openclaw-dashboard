#!/usr/bin/env bash
set -euo pipefail

# Safe deploy: build first, then restart. Never delete .next in production.
cd "$(dirname "$0")/.."

echo "[deploy] building..."
NEXT_TELEMETRY_DISABLED=1 npm run build

echo "[deploy] restarting pm2 dashboard..."
pm2 restart dashboard --update-env

echo "[deploy] healthcheck..."
for i in {1..20}; do
  if curl -fsS http://127.0.0.1:3000/ >/dev/null; then
    echo "[deploy] OK"
    exit 0
  fi
  sleep 1
done

echo "[deploy] FAIL: server not healthy on :3000"
exit 1
