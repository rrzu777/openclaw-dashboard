import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { DATA_DIR } from '@/lib/constants';
import type { AlertThreshold } from '@/lib/types';

const ALERTS_FILE = `${DATA_DIR}/alerts.json`;

async function readAlerts(): Promise<AlertThreshold[]> {
  try {
    const raw = await fs.readFile(ALERTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return getDefaults();
  }
}

async function writeAlerts(alerts: AlertThreshold[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf-8');
}

function getDefaults(): AlertThreshold[] {
  return [
    { id: 'err-rate', metric: 'error_rate', operator: '>', value: 5, enabled: true, description: 'Error count exceeds 5 in 24h' },
    { id: 'disk', metric: 'disk_usage', operator: '>', value: 80, enabled: true, description: 'Disk usage exceeds 80%' },
    { id: 'heartbeat', metric: 'heartbeat_stale', operator: '>', value: 10, enabled: true, description: 'No heartbeat for 10+ minutes' },
    { id: 'procs', metric: 'process_count', operator: '>', value: 20, enabled: false, description: 'More than 20 AI processes' },
  ];
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const alerts = await readAlerts();
  return NextResponse.json({ alerts });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.alerts)) {
      return NextResponse.json({ error: 'alerts must be an array' }, { status: 400 });
    }
    await writeAlerts(body.alerts);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
