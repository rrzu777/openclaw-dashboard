import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

/**
 * Public health endpoint for external monitoring services.
 * Returns 200 if dashboard + gateway are running, 503 otherwise.
 *
 * Point UptimeRobot / Healthchecks.io / BetterStack at:
 *   http://<tailscale-ip>:3000/api/health
 *
 * Or use healthchecks.io ping mode:
 *   Add to cron: curl -fsS -m 10 --retry 5 https://hc-ping.com/YOUR-UUID-HERE
 */
export async function GET() {
  const checks: Record<string, boolean> = {};

  // Dashboard: we're responding, so it's up
  checks.dashboard = true;

  // Gateway
  try {
    const res = await fetch('http://127.0.0.1:18789/', { signal: AbortSignal.timeout(3000) });
    checks.gateway = res.ok;
  } catch {
    checks.gateway = false;
  }

  // Estrado worker
  try {
    const { stdout } = await execFileAsync('systemctl', ['is-active', 'estrado-pjud-worker']);
    checks.estrado_worker = stdout.trim() === 'active';
  } catch {
    checks.estrado_worker = false;
  }

  // Estrado API
  try {
    const { stdout } = await execFileAsync('systemctl', ['is-active', 'estrado-pjud']);
    checks.estrado_api = stdout.trim() === 'active';
  } catch {
    checks.estrado_api = false;
  }

  const allHealthy = Object.values(checks).every(v => v);

  return NextResponse.json(
    { status: allHealthy ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allHealthy ? 200 : 503 }
  );
}
