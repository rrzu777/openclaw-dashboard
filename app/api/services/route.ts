import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
export const dynamic = 'force-dynamic';

const SERVICES = [
  { unit: 'openclaw-gateway', name: 'gateway', displayName: 'OpenClaw Gateway', group: 'openclaw' as const },
  { unit: 'estrado-pjud', name: 'estrado-api', displayName: 'Estrado API', group: 'legaltech' as const },
  { unit: 'estrado-pjud-worker', name: 'estrado-worker', displayName: 'Estrado Worker', group: 'legaltech' as const },
  { unit: 'legaltech-monitor', name: 'legaltech-monitor', displayName: 'LegalTech Monitor', group: 'legaltech' as const },
  { unit: 'legaltech-resource-tracker', name: 'resource-tracker', displayName: 'Resource Tracker', group: 'legaltech' as const },
];

export async function GET() {
  const statuses = await Promise.all(SERVICES.map(async (s) => {
    try {
      const { stdout } = await execFileAsync('systemctl', ['show', s.unit, '--property=ActiveState,MainPID,MemoryCurrent', '--no-pager']);
      const props: Record<string, string> = {};
      stdout.split('\n').forEach(line => { const [k, v] = line.split('='); if (k && v) props[k.trim()] = v.trim(); });
      const running = props.ActiveState === 'active';
      const pid = parseInt(props.MainPID || '0');
      const memBytes = parseInt(props.MemoryCurrent || '0');
      let uptime = '';
      if (running && pid > 0) {
        try { const { stdout: ps } = await execFileAsync('ps', ['-o', 'etime=', '-p', String(pid)]); uptime = ps.trim(); } catch {}
      }
      return { name: s.name, displayName: s.displayName, running, group: s.group, pid: pid > 0 ? pid : undefined, memory: memBytes > 0 ? `${Math.round(memBytes / 1024 / 1024)}MB` : undefined, uptime: uptime || undefined };
    } catch {
      return { name: s.name, displayName: s.displayName, running: false, group: s.group };
    }
  }));
  return NextResponse.json({ services: statuses });
}
