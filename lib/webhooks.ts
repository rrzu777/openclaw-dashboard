import fs from 'fs/promises';
import { DATA_DIR } from '@/lib/constants';

const WEBHOOKS_FILE = `${DATA_DIR}/webhooks.json`;

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: ('alert' | 'recovery' | 'error' | 'status')[];
  enabled: boolean;
}

export async function getWebhooks(): Promise<WebhookConfig[]> {
  try {
    return JSON.parse(await fs.readFile(WEBHOOKS_FILE, 'utf-8'));
  } catch {
    return [];
  }
}

export async function saveWebhooks(webhooks: WebhookConfig[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), 'utf-8');
}

export async function fireWebhooks(event: string, payload: Record<string, unknown>) {
  const webhooks = await getWebhooks();
  const matching = webhooks.filter(w => w.enabled && w.events.includes(event as any));

  const results = await Promise.allSettled(
    matching.map(async (w) => {
      const res = await fetch(w.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'MissionControl/2.0' },
        body: JSON.stringify({ event, timestamp: new Date().toISOString(), source: 'mission-control', ...payload }),
        signal: AbortSignal.timeout(5000),
      });
      return { webhook: w.name, status: res.status, ok: res.ok };
    })
  );

  return results.map((r, i) => (
    r.status === 'fulfilled'
      ? r.value
      : { webhook: matching[i].name, error: String((r as PromiseRejectedResult).reason) }
  ));
}
