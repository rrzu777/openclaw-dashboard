#!/bin/bash
# Daily backup of critical VPS config + data
# Keeps last 7 daily backups locally + optional remote sync

BACKUP_DIR="/root/backups"
DATE=$(date +%Y-%m-%d)
BACKUP_FILE="$BACKUP_DIR/vps-backup-$DATE.tar.gz"
LOG="/var/log/mc-backup.log"

mkdir -p "$BACKUP_DIR"

echo "$(date -Is) Starting backup..." >> "$LOG"

# Backup critical files
tar czf "$BACKUP_FILE" \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='*.lock' \
  --exclude='.bun' \
  /root/.openclaw/openclaw.json \
  /root/.openclaw/cron/ \
  /root/.openclaw/workspace/repos/openclaw-dashboard/data/ \
  /root/.openclaw/workspace/repos/openclaw-dashboard/scripts/ \
  /root/.openclaw/workspace/repos/openclaw-dashboard/server/ \
  /root/.openclaw/workspace/repos/openclaw-dashboard/lib/constants.ts \
  /root/.config/opencode/opencode.json \
  /opt/legal-tech-microservices/estrado-pjud-service/.env \
  /opt/legal-tech-microservices/estrado-pjud-service/.env.worker \
  /opt/legaltech-monitoring/monitor.py \
  /etc/systemd/system/estrado-*.service \
  /etc/systemd/system/legaltech-*.service \
  /var/spool/cron/crontabs/root \
  2>/dev/null

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "$(date -Is) Backup complete: $BACKUP_FILE ($SIZE)" >> "$LOG"

# Cleanup: keep only last 7 backups
ls -t "$BACKUP_DIR"/vps-backup-*.tar.gz 2>/dev/null | tail -n +8 | xargs rm -f 2>/dev/null
KEPT=$(ls "$BACKUP_DIR"/vps-backup-*.tar.gz 2>/dev/null | wc -l)
echo "$(date -Is) Keeping $KEPT backups" >> "$LOG"
