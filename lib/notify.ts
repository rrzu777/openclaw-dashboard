import { DATA_DIR } from '@/lib/constants';
import fs from 'fs/promises';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '8343683301:AAEemeviAxm5VGELPnbekIy2lou_0Trh4Zk';
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID ?? '886820553';
const COOLDOWN_FILE = `${DATA_DIR}/notify-cooldown.json`;
const COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown per alert type

interface CooldownState {
  [alertId: string]: number; // timestamp of last notification
}

async function readCooldown(): Promise<CooldownState> {
  try {
    return JSON.parse(await fs.readFile(COOLDOWN_FILE, 'utf-8'));
  } catch {
    return {};
  }
}

async function writeCooldown(state: CooldownState) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(COOLDOWN_FILE, JSON.stringify(state), 'utf-8');
}

export async function sendTelegramAlert(alertId: string, message: string): Promise<boolean> {
  // Check cooldown
  const cooldown = await readCooldown();
  const lastSent = cooldown[alertId] ?? 0;
  if (Date.now() - lastSent < COOLDOWN_MS) return false;

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text: message,
        parse_mode: 'Markdown',
      }),
    });

    if (res.ok) {
      cooldown[alertId] = Date.now();
      await writeCooldown(cooldown);
      return true;
    }
    console.error('[notify] Telegram send failed:', await res.text());
    return false;
  } catch (err) {
    console.error('[notify] Telegram error:', err);
    return false;
  }
}

export function formatAlertMessage(alertId: string, metric: string, currentValue: number | string, threshold: number, description: string): string {
  const emoji = alertId.includes('err') ? '🔴' : alertId.includes('disk') ? '💾' : alertId.includes('heartbeat') ? '💓' : '⚠️';
  return [
    `${emoji} *Mission Control Alert*`,
    ``,
    `*${description}*`,
    `Metric: \`${metric}\``,
    `Current: \`${currentValue}\` (threshold: \`${threshold}\`)`,
    ``,
    `_${new Date().toISOString()}_`,
  ].join('\n');
}
