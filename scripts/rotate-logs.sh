#!/bin/bash
# Log rotation for Mission Control data files
# Runs daily via cron. Keeps last N lines, archives old data.

DATA_DIR="/root/.openclaw/workspace/repos/openclaw-dashboard/data"
ARCHIVE_DIR="$DATA_DIR/archive"
DATE=$(date +%Y-%m-%d)
LOG="/var/log/mc-rotate.log"

mkdir -p "$ARCHIVE_DIR"

rotate_jsonl() {
  local file="$1"
  local keep="$2"
  local name=$(basename "$file" .jsonl)

  if [ ! -f "$file" ]; then return; fi

  lines=$(wc -l < "$file")
  if [ "$lines" -gt "$keep" ]; then
    # Archive excess lines
    head -n $(( lines - keep )) "$file" | gzip > "$ARCHIVE_DIR/${name}-${DATE}.jsonl.gz"
    # Keep only last N lines
    tail -n "$keep" "$file" > "$file.tmp" && mv "$file.tmp" "$file"
    echo "$(date -Is) Rotated $name: $lines -> $keep lines (archived $(( lines - keep )))" >> "$LOG"
  fi
}

# events.jsonl: keep last 5000 lines (~2MB)
rotate_jsonl "$DATA_DIR/events.jsonl" 5000

# audit.jsonl: keep last 1000 lines
rotate_jsonl "$DATA_DIR/audit.jsonl" 1000

# snapshots.jsonl: keep last 2000 (~7 days at 5min intervals)
rotate_jsonl "$DATA_DIR/snapshots.jsonl" 2000

# Gateway watchdog log
if [ -f /var/log/gateway-watchdog.log ]; then
  wdlines=$(wc -l < /var/log/gateway-watchdog.log)
  if [ "$wdlines" -gt 5000 ]; then
    tail -n 2000 /var/log/gateway-watchdog.log > /var/log/gateway-watchdog.log.tmp
    mv /var/log/gateway-watchdog.log.tmp /var/log/gateway-watchdog.log
    echo "$(date -Is) Rotated watchdog log: $wdlines -> 2000" >> "$LOG"
  fi
fi

# Truncate journal to 500MB max
journalctl --vacuum-size=500M 2>/dev/null
