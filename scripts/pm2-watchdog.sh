#!/usr/bin/env bash
set -euo pipefail

# Adaptive cadence: if there are recent events, run frequently; otherwise back off.
# Writes PM2 status as events via /api/events.

EVENTS_FILE="/root/.openclaw/workspace/repos/openclaw-dashboard/data/events.jsonl"
STATE_FILE="/root/.openclaw/workspace/repos/openclaw-dashboard/data/pm2-watchdog-state.json"
API="http://127.0.0.1:3000"

now_ms() { date +%s%3N; }

# default backoff settings
FAST_SEC=10
IDLE_SEC=3600
ACTIVE_WINDOW_SEC=300  # 5 min

last_event_ts=""
if [[ -f "$EVENTS_FILE" ]]; then
  last_event_ts=$(tail -n 1 "$EVENTS_FILE" | node -e 'try{const l=require("fs").readFileSync(0,"utf8");const j=JSON.parse(l);console.log(j.ts||"");}catch(e){}')
fi

active=0
if [[ -n "$last_event_ts" ]]; then
  last_event_ms=$(node -e 'const ts=process.env.TS; const d=Date.parse(ts); console.log(Number.isFinite(d)?d:0);' TS="$last_event_ts")
  now=$(now_ms)
  delta_sec=$(( (now - last_event_ms) / 1000 ))
  if (( delta_sec <= ACTIVE_WINDOW_SEC )); then
    active=1
  fi
fi

# get pm2 status summary (best-effort)
PM2_LINE="pm2:unavailable"
if command -v pm2 >/dev/null 2>&1; then
  PM2_LINE=$(pm2 jlist 2>/dev/null | node -e '
    try {
      const fs = require("fs");
      const list = JSON.parse(fs.readFileSync(0, "utf8"));
      const d = list.find(x => x.name === "dashboard" && x.pm2_env?.status === "online") || list.find(x => x.name === "dashboard");
      if (!d) { console.log("dashboard:not_found"); process.exit(0); }
      const env = d.pm2_env || {};
      const mem = env.monit?.memory ?? d.monit?.memory;
      const cpu = env.monit?.cpu ?? d.monit?.cpu;
      console.log(`dashboard status=${env.status} restarts=${env.restart_time} pid=${d.pid} mem=${mem} cpu=${cpu}`);
    } catch (e) {
      console.log("pm2:parse_error");
    }
  ')
fi

# send event
curl -sS -X POST "$API/api/events" \
  -H 'Content-Type: application/json' \
  -d "$(node -e 'console.log(JSON.stringify({level:"info", type:"service.status", actor:"pm2", message:process.env.MSG}))' MSG="$PM2_LINE")" \
  >/dev/null || true

# compute next sleep and persist
next_sleep=$IDLE_SEC
if (( active == 1 )); then
  next_sleep=$FAST_SEC
fi

mkdir -p "$(dirname "$STATE_FILE")"
node -e 'const fs=require("fs"); fs.writeFileSync(process.env.STATE, JSON.stringify({ts:new Date().toISOString(), active: !!Number(process.env.ACT), nextSleepSec:Number(process.env.SLEEP)}, null, 2));' \
  STATE="$STATE_FILE" ACT="$active" SLEEP="$next_sleep"

echo "$next_sleep" > /tmp/pm2-watchdog-nextsleep
