#!/bin/bash
# Ping healthchecks.io to confirm VPS is alive
# If this ping stops arriving, healthchecks.io alerts via Telegram
#
# SETUP (one-time, takes 1 minute):
# 1. Go to https://healthchecks.io/ — sign up (free, no credit card)
# 2. Create a new check, name it "VPS Mission Control"
# 3. Set Period: 2 minutes, Grace: 5 minutes
# 4. Go to Integrations → Add Telegram → link your Telegram
# 5. Copy the ping URL (looks like: https://hc-ping.com/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
# 6. Paste it below replacing the placeholder
#
# The script also sends VPS health status as the request body

HC_URL="${HEALTHCHECK_PING_URL:-__REPLACE_ME__}"

if [ "$HC_URL" = "__REPLACE_ME__" ]; then
  exit 0  # Not configured yet, skip silently
fi

# Collect quick health summary
STATUS="ok"
BODY=""

# Check gateway
if ! systemctl is-active --quiet openclaw-gateway 2>/dev/null; then
  STATUS="fail"
  BODY="$BODY\nGateway: DOWN"
fi

# Check estrado worker
if ! systemctl is-active --quiet estrado-pjud-worker 2>/dev/null; then
  STATUS="fail"
  BODY="$BODY\nEstrado Worker: DOWN"
fi

# Check dashboard
if ! curl -sf -m 5 http://127.0.0.1:3000/api/health >/dev/null 2>&1; then
  STATUS="fail"
  BODY="$BODY\nDashboard: DOWN"
fi

# Disk check
DISK_PCT=$(df --output=pcent / | tail -1 | tr -d ' %')
if [ "$DISK_PCT" -gt 90 ]; then
  STATUS="fail"
  BODY="$BODY\nDisk: ${DISK_PCT}%"
fi

if [ "$STATUS" = "ok" ]; then
  # Success ping
  curl -fsS -m 10 --retry 3 "$HC_URL" --data-raw "All services healthy. Disk: ${DISK_PCT}%" >/dev/null 2>&1
else
  # Failure ping (append /fail to URL)
  curl -fsS -m 10 --retry 3 "$HC_URL/fail" --data-raw "Issues detected:$BODY" >/dev/null 2>&1
fi
