import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { DATA_DIR, EVENTS_FILE } from '@/lib/constants';
import { sendTelegramAlert, formatAlertMessage } from '@/lib/notify';
import { fireWebhooks } from '@/lib/webhooks';
import type { AlertThreshold } from '@/lib/types';

const execFileAsync = promisify(execFile);
const ALERTS_FILE = `${DATA_DIR}/alerts.json`;

export const dynamic = 'force-dynamic';

async function readAlerts(): Promise<AlertThreshold[]> {
  try {
    return JSON.parse(await fs.readFile(ALERTS_FILE, 'utf-8'));
  } catch {
    // Return defaults if no config file exists yet
    return [
      { id: 'err-rate', metric: 'error_rate', operator: '>', value: 5, enabled: true, description: 'Error count exceeds 5 in 24h' },
      { id: 'disk', metric: 'disk_usage', operator: '>', value: 80, enabled: true, description: 'Disk usage exceeds 80%' },
      { id: 'heartbeat', metric: 'heartbeat_stale', operator: '>', value: 10, enabled: true, description: 'No heartbeat for 10+ minutes' },
      { id: 'procs', metric: 'process_count', operator: '>', value: 20, enabled: false, description: 'More than 20 AI processes' },
    ];
  }
}

async function getCurrentMetrics(): Promise<Record<string, number>> {
  const metrics: Record<string, number> = {};

  // Error count (24h)
  try {
    const content = await fs.readFile(EVENTS_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    let errors = 0;
    for (const line of lines.slice(-500)) {
      try {
        const e = JSON.parse(line);
        if (new Date(e.ts).getTime() > cutoff && (e.level === 'error' || e.type === 'task.failed')) {
          errors++;
        }
      } catch {}
    }
    metrics.error_rate = errors;
  } catch {
    metrics.error_rate = 0;
  }

  // Disk usage
  try {
    const { stdout } = await execFileAsync('df', ['-h', '/']);
    const parts = stdout.trim().split('\n')[1]?.split(/\s+/);
    metrics.disk_usage = parseInt(parts?.[4]?.replace('%', '') ?? '0') || 0;
  } catch {
    metrics.disk_usage = 0;
  }

  // Heartbeat staleness (minutes since last heartbeat)
  try {
    const content = await fs.readFile(EVENTS_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    let lastHeartbeat = 0;
    for (const line of lines.slice(-200)) {
      try {
        const e = JSON.parse(line);
        if (e.type === 'watchdog.heartbeat') {
          const t = new Date(e.ts).getTime();
          if (t > lastHeartbeat) lastHeartbeat = t;
        }
      } catch {}
    }
    metrics.heartbeat_stale = lastHeartbeat > 0 ? Math.floor((Date.now() - lastHeartbeat) / 60000) : 999;
  } catch {
    metrics.heartbeat_stale = 999;
  }

  // Process count
  try {
    const { stdout } = await execFileAsync('ps', ['aux']);
    const count = stdout.split('\n')
      .filter(line => /opencode|claw|python/i.test(line) && !line.includes('grep'))
      .length;
    metrics.process_count = count;
  } catch {
    metrics.process_count = 0;
  }

  return metrics;
}

function evaluate(value: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '==': return value === threshold;
    default: return false;
  }
}

export async function GET() {
  const alerts = await readAlerts();
  const metrics = await getCurrentMetrics();
  const results: { id: string; triggered: boolean; notified: boolean; metric: string; value: number; threshold: number }[] = [];

  for (const alert of alerts) {
    if (!alert.enabled) continue;
    const value = metrics[alert.metric] ?? 0;
    const triggered = evaluate(value, alert.operator, alert.value);

    let notified = false;
    if (triggered) {
      const msg = formatAlertMessage(alert.id, alert.metric, value, alert.value, alert.description);
      notified = await sendTelegramAlert(alert.id, msg);
      await fireWebhooks('alert', { alertId: alert.id, metric: alert.metric, value, threshold: alert.value, description: alert.description });
    }

    results.push({
      id: alert.id,
      triggered,
      notified,
      metric: alert.metric,
      value,
      threshold: alert.value,
    });
  }

  return NextResponse.json({ results, metrics, timestamp: new Date().toISOString() });
}
