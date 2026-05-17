#!/bin/bash
# Sync daily backups to Mac via Tailscale
# Runs after the local backup (3 AM backup, this at 3:30 AM)
#
# SETUP (one-time on your Mac):
# 1. Open Terminal on your Mac
# 2. mkdir -p ~/vps-backups
# 3. Make sure SSH is enabled: System Settings → General → Sharing → Remote Login → ON
# 4. Test from VPS: ssh roberto@100.94.99.72 "echo ok"
# 5. Set up SSH key (if not done): ssh-copy-id roberto@100.94.99.72
#
# That's it. Backups will sync daily.

MAC_IP="100.94.99.72"
MAC_USER="${VPS_BACKUP_MAC_USER:-roberto}"
MAC_DIR="~/vps-backups"
BACKUP_DIR="/root/backups"
LOG="/var/log/mc-backup.log"

# Check if Mac is reachable (it might be sleeping)
if ! ping -c 1 -W 3 "$MAC_IP" >/dev/null 2>&1; then
  echo "$(date -Is) Remote backup skipped: Mac not reachable" >> "$LOG"
  exit 0
fi

# Sync only latest backup (not all 7)
LATEST=$(ls -t "$BACKUP_DIR"/vps-backup-*.tar.gz 2>/dev/null | head -1)
if [ -z "$LATEST" ]; then
  echo "$(date -Is) Remote backup skipped: no local backup found" >> "$LOG"
  exit 0
fi

# rsync to Mac (only copies if changed, uses compression)
rsync -az --timeout=30 "$LATEST" "${MAC_USER}@${MAC_IP}:${MAC_DIR}/" 2>>"$LOG"

if [ $? -eq 0 ]; then
  echo "$(date -Is) Remote backup synced: $(basename $LATEST) -> Mac" >> "$LOG"
else
  echo "$(date -Is) Remote backup FAILED" >> "$LOG"
fi
