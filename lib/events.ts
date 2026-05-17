import fs from 'fs/promises';
import path from 'path';
import type { MCEvent, EventLevel, EventType } from './types';

export type { MCEvent, EventLevel, EventType };

import { EVENTS_FILE } from './constants';

export async function appendEvent(e: Omit<MCEvent, 'id' | 'ts'> & { id?: string; ts?: string }) {
  const event: MCEvent = {
    id: e.id ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: e.ts ?? new Date().toISOString(),
    level: e.level,
    type: e.type,
    message: e.message,
    taskId: e.taskId,
    runId: e.runId,
    actor: e.actor,
    data: e.data,
  };

  await fs.mkdir(path.dirname(EVENTS_FILE), { recursive: true });
  await fs.appendFile(EVENTS_FILE, JSON.stringify(event) + '\n', 'utf-8');
  return event;
}

export async function readEvents(limit = 200, includeHeartbeats = false): Promise<MCEvent[]> {
  try {
    const content = await fs.readFile(EVENTS_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Parse all lines, filter heartbeats, THEN take tail
    let events = lines
      .map((l) => {
        try { return JSON.parse(l) as MCEvent; } catch { return null; }
      })
      .filter((e): e is MCEvent => e !== null);

    if (!includeHeartbeats) {
      events = events.filter(e => e.type !== 'watchdog.heartbeat');
    }

    return events
      .slice(-limit)
      .sort((a, b) => {
        const ta = new Date(b.ts).getTime();
        const tb = new Date(a.ts).getTime();
        if (isNaN(ta)) return 1;
        if (isNaN(tb)) return -1;
        return ta - tb;
      });
  } catch {
    return [];
  }
}
