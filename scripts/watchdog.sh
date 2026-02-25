#!/usr/bin/env bash
set -euo pipefail

EVENTS_FILE="/root/.openclaw/workspace/repos/openclaw-dashboard/data/events.jsonl"
TS="$(date -Is)"

# Check PM2 dashboard status (best-effort) - prefer online process
PM2_LINE=""
if command -v pm2 >/dev/null 2>&1; then
  PM2_LINE="$(pm2 jlist 2>/dev/null | node -e '
    try {
      const fs = require("fs");
      const input = fs.readFileSync(0, "utf8");
      const list = JSON.parse(input);
      // Prefer online process, fallback to first match
      const online = list.find(x => x.name === "dashboard" && x.pm2_env?.status === "online");
      const d = online || list.find(x => x.name === "dashboard");
      if (!d) process.exit(0);
      console.log(`${d.name} status=${d.pm2_env?.status} restarts=${d.pm2_env?.restart_time} pid=${d.pid}`);
    } catch (e) { }
  ' || true)"
fi

mkdir -p "$(dirname "$EVENTS_FILE")"

# Emit heartbeat event
export EVENTS_FILE PM2_LINE
node -e '
  const fs = require("fs");
  const file = process.env.EVENTS_FILE;
  const now = new Date().toISOString();
  const msg = process.env.PM2_LINE || "pm2:unavailable";
  const ev = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`,
    ts: now,
    level: "info",
    type: "watchdog.heartbeat",
    actor: "watchdog",
    message: msg,
  };
  fs.appendFileSync(file, JSON.stringify(ev) + "\n", "utf8");
'
