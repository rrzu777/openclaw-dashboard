#!/bin/bash
# Auto-cleanup /tmp junk: oh-my-opencode, bun .so caches, stale sdk/node dirs
# Runs daily via cron. Logs what it deletes.

LOG="/var/log/tmp-cleanup.log"
BEFORE=$(df --output=pcent / | tail -1 | tr -d ' %')

deleted=0
for pattern in ".*.oh-my-opencode*" ".*.so" ".*.sdk" ".*.node" ".*.zod" ".*.opencode-antigravity-auth" ".*.plugin"; do
  count=$(find /tmp -maxdepth 1 -name "$pattern" -type d -mmin +60 2>/dev/null | wc -l)
  if [ "$count" -gt 0 ]; then
    find /tmp -maxdepth 1 -name "$pattern" -type d -mmin +60 -exec rm -rf {} + 2>/dev/null
    deleted=$((deleted + count))
  fi
done

AFTER=$(df --output=pcent / | tail -1 | tr -d ' %')

if [ "$deleted" -gt 0 ]; then
  echo "$(date -Is) Cleaned $deleted dirs from /tmp (disk: ${BEFORE}% -> ${AFTER}%)" >> "$LOG"
fi
