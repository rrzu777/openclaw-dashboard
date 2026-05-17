import { NextResponse } from 'next/server';
import { readEvents } from '@/lib/events';
import { readAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

interface TimelineEntry {
  ts: string;
  source: 'event' | 'audit' | 'recovery';
  level: 'info' | 'warn' | 'error' | 'success';
  title: string;
  detail?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hours = Math.max(1, Math.min(168, Number(searchParams.get('hours') ?? 24)));
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Gather from events
  const events = (await readEvents(500, true)).filter(e => e.ts > cutoff);
  const timeline: TimelineEntry[] = [];

  for (const e of events) {
    // Only include notable events (not routine tool calls)
    if (e.type === 'task.failed' || e.type === 'watchdog.stalled') {
      timeline.push({ ts: e.ts, source: 'event', level: 'error', title: `${e.type}: ${e.message}` });
    } else if (e.type === 'task.completed') {
      timeline.push({ ts: e.ts, source: 'event', level: 'success', title: e.message });
    } else if (e.type === 'service.status' && e.actor === 'auto-recovery') {
      timeline.push({ ts: e.ts, source: 'recovery', level: 'warn', title: e.message });
    } else if (e.type === 'service.status' && e.actor === 'dashboard') {
      timeline.push({ ts: e.ts, source: 'event', level: 'info', title: e.message });
    } else if (e.type === 'watchdog.heartbeat') {
      // Only include first and last heartbeat per hour to avoid flooding
      // Skip most heartbeats
    } else if (e.level === 'error') {
      timeline.push({ ts: e.ts, source: 'event', level: 'error', title: e.message, detail: e.data ? JSON.stringify(e.data) : undefined });
    }
  }

  // Gather from audit
  const audit = (await readAuditLog(100)).filter(a => a.ts > cutoff);
  for (const a of audit) {
    timeline.push({
      ts: a.ts,
      source: 'audit',
      level: a.action.includes('kill') ? 'error' : a.action.includes('restart') ? 'warn' : 'info',
      title: `${a.action}${a.target ? ` → ${a.target}` : ''}`,
      detail: a.ip ? `from ${a.ip}` : undefined,
    });
  }

  // Sort newest first
  timeline.sort((a, b) => b.ts.localeCompare(a.ts));

  return NextResponse.json({ timeline, hours });
}
