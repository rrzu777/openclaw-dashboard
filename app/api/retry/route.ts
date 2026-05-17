import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAuth } from '@/lib/auth';
import { rateLimitDestructive } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { appendEvent } from '@/lib/events';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const rlError = rateLimitDestructive(request);
  if (rlError) return rlError;

  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action } = body;
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';

    if (action === 'restart-gateway') {
      await logAudit({ action: 'retry.restart_gateway', actor: 'api', ip: clientIp });
      try {
        await execFileAsync('systemctl', ['restart', 'openclaw-gateway']);
        await appendEvent({
          level: 'info',
          type: 'service.status',
          message: 'Gateway restarted via retry',
          actor: 'dashboard',
        });
        return NextResponse.json({ success: true, message: 'Gateway restart initiated' });
      } catch (err) {
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
      }
    }

    if (action === 'restart-watchdog') {
      await logAudit({ action: 'retry.restart_watchdog', actor: 'api', ip: clientIp });
      try {
        await execFileAsync('bash', ['/root/.openclaw/scripts/gateway-watchdog.sh']);
        return NextResponse.json({ success: true, message: 'Watchdog check triggered' });
      } catch (err) {
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
      }
    }

    if (action === 'clear-stale-events') {
      await logAudit({ action: 'retry.clear_stale', actor: 'api', ip: clientIp });
      await appendEvent({
        level: 'info',
        type: 'service.status',
        message: 'Stale events cleared by operator',
        actor: 'dashboard',
      });
      return NextResponse.json({ success: true, message: 'Stale events cleared' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Retry failed', details: String(error) }, { status: 500 });
  }
}
