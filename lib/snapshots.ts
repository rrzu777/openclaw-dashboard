import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { DATA_DIR, EVENTS_FILE } from '@/lib/constants';

const execFileAsync = promisify(execFile);
const SNAPSHOTS_FILE = `${DATA_DIR}/snapshots.jsonl`;
const MAX_SNAPSHOTS = 1440; // ~24h at 1/min, or ~5 days at 1/5min

export interface Snapshot {
  ts: string;
  errors: number;
  tools: number;
  events: number;
  diskPct: number;
  cpuPct: number;
  memMb: number;
  processes: number;
  gatewayUp: boolean;
}

export async function captureSnapshot(): Promise<Snapshot> {
  const snap: Snapshot = {
    ts: new Date().toISOString(),
    errors: 0,
    tools: 0,
    events: 0,
    diskPct: 0,
    cpuPct: 0,
    memMb: 0,
    processes: 0,
    gatewayUp: false,
  };

  // Count events in last hour
  try {
    const content = await fs.readFile(EVENTS_FILE, 'utf-8');
    const lines = content.trim().split('\n');
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const line of lines.slice(-500)) {
      try {
        const e = JSON.parse(line);
        const t = new Date(e.ts).getTime();
        if (t > cutoff) {
          snap.events++;
          if (e.level === 'error' || e.type === 'task.failed') snap.errors++;
          if (e.type === 'tool.started') snap.tools++;
        }
      } catch {}
    }
  } catch {}

  // Disk usage
  try {
    const { stdout } = await execFileAsync('df', ['--output=pcent', '/']);
    snap.diskPct = parseInt(stdout.split('\n')[1]?.trim().replace('%', '') ?? '0') || 0;
  } catch {}

  // Memory
  try {
    const { stdout } = await execFileAsync('free', ['-m']);
    const parts = stdout.split('\n')[1]?.split(/\s+/);
    if (parts) snap.memMb = parseInt(parts[2] ?? '0') || 0;
  } catch {}

  // CPU (1-second sample)
  try {
    const { stdout } = await execFileAsync('top', ['-bn1', '-d0.5']);
    const cpuLine = stdout.split('\n').find(l => l.includes('Cpu'));
    if (cpuLine) {
      const idle = parseFloat(cpuLine.match(/(\d+\.\d+)\s*id/)?.[1] ?? '100');
      snap.cpuPct = Math.round((100 - idle) * 10) / 10;
    }
  } catch {}

  // Process count
  try {
    const { stdout } = await execFileAsync('ps', ['aux']);
    snap.processes = stdout.split('\n')
      .filter(l => /opencode|claw|python/i.test(l) && !l.includes('grep')).length;
  } catch {}

  // Gateway
  try {
    const res = await fetch('http://127.0.0.1:18789/', { signal: AbortSignal.timeout(3000) });
    snap.gatewayUp = res.ok;
  } catch {
    snap.gatewayUp = false;
  }

  // Append
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(SNAPSHOTS_FILE, JSON.stringify(snap) + '\n', 'utf-8');

  // Trim old snapshots
  try {
    const all = (await fs.readFile(SNAPSHOTS_FILE, 'utf-8')).trim().split('\n').filter(Boolean);
    if (all.length > MAX_SNAPSHOTS) {
      await fs.writeFile(SNAPSHOTS_FILE, all.slice(-MAX_SNAPSHOTS).join('\n') + '\n', 'utf-8');
    }
  } catch {}

  return snap;
}

export async function readSnapshots(hours = 24): Promise<Snapshot[]> {
  try {
    const content = await fs.readFile(SNAPSHOTS_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const cutoff = Date.now() - hours * 60 * 60 * 1000;
    return lines
      .map(l => { try { return JSON.parse(l) as Snapshot; } catch { return null; } })
      .filter((s): s is Snapshot => s !== null && new Date(s.ts).getTime() > cutoff);
  } catch {
    return [];
  }
}
