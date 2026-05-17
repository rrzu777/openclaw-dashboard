import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import { DATA_DIR, GATEWAY_HEALTH_URL } from '@/lib/constants';
import { appendEvent } from '@/lib/events';
import { logAudit } from '@/lib/audit';
import { sendTelegramAlert } from '@/lib/notify';

const execFileAsync = promisify(execFile);
const RECOVERY_STATE_FILE = `${DATA_DIR}/recovery-state.json`;

interface RecoveryRule {
  id: string;
  name: string;
  condition: 'gateway_down' | 'high_disk' | 'stale_heartbeat';
  action: 'restart_gateway' | 'clear_logs' | 'notify_only';
  cooldownMinutes: number;
  enabled: boolean;
}

interface RecoveryState {
  lastActions: Record<string, number>; // ruleId -> timestamp
}

const DEFAULT_RULES: RecoveryRule[] = [
  {
    id: 'gw-restart',
    name: 'Restart gateway if unresponsive',
    condition: 'gateway_down',
    action: 'restart_gateway',
    cooldownMinutes: 10,
    enabled: true,
  },
  {
    id: 'disk-cleanup',
    name: 'Clear old logs when disk > 90%',
    condition: 'high_disk',
    action: 'clear_logs',
    cooldownMinutes: 60,
    enabled: true,
  },
  {
    id: 'heartbeat-alert',
    name: 'Alert when no heartbeat for 15min',
    condition: 'stale_heartbeat',
    action: 'notify_only',
    cooldownMinutes: 30,
    enabled: true,
  },
];

const RULES_FILE = `${DATA_DIR}/recovery-rules.json`;

export async function getRecoveryRules(): Promise<RecoveryRule[]> {
  try {
    return JSON.parse(await fs.readFile(RULES_FILE, 'utf-8'));
  } catch {
    return DEFAULT_RULES;
  }
}

export async function saveRecoveryRules(rules: RecoveryRule[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(RULES_FILE, JSON.stringify(rules, null, 2), 'utf-8');
}

async function readState(): Promise<RecoveryState> {
  try {
    return JSON.parse(await fs.readFile(RECOVERY_STATE_FILE, 'utf-8'));
  } catch {
    return { lastActions: {} };
  }
}

async function writeState(state: RecoveryState) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(RECOVERY_STATE_FILE, JSON.stringify(state), 'utf-8');
}

async function checkCondition(condition: RecoveryRule['condition']): Promise<boolean> {
  switch (condition) {
    case 'gateway_down': {
      try {
        const res = await fetch(GATEWAY_HEALTH_URL, { signal: AbortSignal.timeout(5000) });
        return !res.ok;
      } catch {
        return true; // can't reach = down
      }
    }
    case 'high_disk': {
      try {
        const { stdout } = await execFileAsync('df', ['--output=pcent', '/']);
        const pct = parseInt(stdout.split('\n')[1]?.trim().replace('%', '') ?? '0');
        return pct > 90;
      } catch {
        return false;
      }
    }
    case 'stale_heartbeat': {
      try {
        const { stdout } = await execFileAsync('tail', ['-50', `${DATA_DIR}/events.jsonl`]);
        const lines = stdout.trim().split('\n');
        let lastHb = 0;
        for (const line of lines) {
          try {
            const e = JSON.parse(line);
            if (e.type === 'watchdog.heartbeat') {
              const t = new Date(e.ts).getTime();
              if (t > lastHb) lastHb = t;
            }
          } catch {}
        }
        return lastHb > 0 && (Date.now() - lastHb) > 15 * 60 * 1000;
      } catch {
        return false;
      }
    }
    default:
      return false;
  }
}

async function executeAction(rule: RecoveryRule): Promise<string> {
  switch (rule.action) {
    case 'restart_gateway': {
      try {
        await execFileAsync('systemctl', ['restart', 'openclaw-gateway']);
        return 'Gateway restarted';
      } catch (e) {
        return `Restart failed: ${e}`;
      }
    }
    case 'clear_logs': {
      try {
        // Truncate events.jsonl to last 5000 lines
        const content = await fs.readFile(`${DATA_DIR}/events.jsonl`, 'utf-8');
        const lines = content.trim().split('\n');
        if (lines.length > 5000) {
          await fs.writeFile(`${DATA_DIR}/events.jsonl`, lines.slice(-5000).join('\n') + '\n');
          return `Truncated events from ${lines.length} to 5000 lines`;
        }
        return 'No cleanup needed';
      } catch (e) {
        return `Cleanup failed: ${e}`;
      }
    }
    case 'notify_only':
      return 'Notification sent';
    default:
      return 'Unknown action';
  }
}

export async function runRecoveryCheck(): Promise<{ rule: string; triggered: boolean; action?: string; result?: string }[]> {
  const rules = await getRecoveryRules();
  const state = await readState();
  const results: { rule: string; triggered: boolean; action?: string; result?: string }[] = [];
  let stateChanged = false;

  for (const rule of rules) {
    if (!rule.enabled) continue;

    const triggered = await checkCondition(rule.condition);
    if (!triggered) {
      results.push({ rule: rule.id, triggered: false });
      continue;
    }

    // Check cooldown
    const lastAction = state.lastActions[rule.id] ?? 0;
    if (Date.now() - lastAction < rule.cooldownMinutes * 60 * 1000) {
      results.push({ rule: rule.id, triggered: true, action: 'skipped (cooldown)' });
      continue;
    }

    // Execute action
    const result = await executeAction(rule);

    // Log
    await logAudit({ action: `auto-recovery.${rule.action}`, actor: 'system', details: { rule: rule.id, result } });
    await appendEvent({
      level: 'warn',
      type: 'service.status',
      message: `Auto-recovery: ${rule.name} → ${result}`,
      actor: 'auto-recovery',
    });

    // Notify
    await sendTelegramAlert(
      `recovery-${rule.id}`,
      `🔧 *Auto-Recovery Triggered*\n\n*Rule:* ${rule.name}\n*Action:* ${rule.action}\n*Result:* ${result}\n\n_${new Date().toISOString()}_`
    );

    state.lastActions[rule.id] = Date.now();
    stateChanged = true;
    results.push({ rule: rule.id, triggered: true, action: rule.action, result });
  }

  if (stateChanged) await writeState(state);
  return results;
}
