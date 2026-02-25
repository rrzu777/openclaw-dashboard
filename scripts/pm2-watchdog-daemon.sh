#!/usr/bin/env bash
set -euo pipefail

# Adaptive PM2 watchdog daemon.
# - Emits PM2 status into Mission Control events (/api/events).
# - Runs fast (every 10s) when there is recent activity in events.jsonl.
# - Backs off (every 60m) when idle.

API="http://127.0.0.1:3000"
EVENTS_FILE="/root/.openclaw/workspace/repos/openclaw-dashboard/data/events.jsonl"
STATE_FILE="/root/.openclaw/workspace/repos/openclaw-dashboard/data/pm2-watchdog-state.json"

FAST_SEC=10
IDLE_SEC=3600
ACTIVE_WINDOW_SEC=300

now_ms() { date +%s%3N; }

pm2_line() {
  if ! command -v pm2 >/dev/null 2>&1; then
    echo "pm2:unavailable"
    return
  fi

  pm2 jlist 2>/dev/null | node -e '
    try {
      const fs = require("fs");
      const list = JSON.parse(fs.readFileSync(0, "utf8"));
      const d = list.find(x => x.name === "dashboard" && x.pm2_env?.status === "online") || list.find(x => x.name === "dashboard");
      if (!d) { console.log("dashboard:not_found"); process.exit(0); }
      const env = d.pm2_env || {};
      const mem = d.monit?.memory;
      const cpu = d.monit?.cpu;
      console.log(`dashboard status=${env.status} restarts=${env.restart_time} pid=${d.pid} mem=${mem} cpu=${cpu}`);
    } catch (e) {
      console.log("pm2:parse_error");
    }
  '
}

last_event_ts() {
  if [[ ! -f "$EVENTS_FILE" ]]; then
    echo ""
    return
  fi
  tail -n 1 "$EVENTS_FILE" | node -e 'try{const l=require("fs").readFileSync(0,"utf8");const j=JSON.parse(l);console.log(j.ts||"");}catch(e){console.log("")}'
}

post_event() {
  local msg="$1"
  # best effort
  curl -sS -X POST "$API/api/events" \
    -H 'Content-Type: application/json' \
    -d "$(node -e 'console.log(JSON.stringify({level:"info", type:"service.status", actor:"pm2", message:process.env.MSG}))' MSG="$msg")" \
    >/dev/null 2>&1 || true
}

while true; do
  ts="$(last_event_ts)"
  active=0
  if [[ -n "$ts" ]]; then
    last_ms=$(node -e 'const d=Date.parse(process.env.TS); console.log(Number.isFinite(d)?d:0);' TS="$ts")
    now=$(now_ms)
    delta_sec=$(( (now - last_ms) / 1000 ))
    if (( delta_sec <= ACTIVE_WINDOW_SEC )); then
      active=1
    fi
  fi

  msg="$(pm2_line)"
  post_event "$msg"

  sleep_for=$IDLE_SEC
  if (( active == 1 )); then
    sleep_for=$FAST_SEC
  fi

  mkdir -p "$(dirname "$STATE_FILE")"
  node -e 'const fs=require("fs"); fs.writeFileSync(process.env.STATE, JSON.stringify({ts:new Date().toISOString(), active: !!Number(process.env.ACT), nextSleepSec:Number(process.env.SLEEP)}, null, 2));' \
    STATE="$STATE_FILE" ACT="$active" SLEEP="$sleep_for" >/dev/null 2>&1 || true

  sleep "$sleep_for"
done
