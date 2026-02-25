import fs from 'fs/promises';
import path from 'path';

export type EventLevel = 'info' | 'warn' | 'error';
export type EventType =
  | 'task.started'
  | 'task.checkpoint'
  | 'task.waiting_for_input'
  | 'task.completed'
  | 'task.failed'
  | 'tool.started'
  | 'tool.finished'
  | 'watchdog.heartbeat'
  | 'watchdog.stalled'
  | 'service.status'
  | 'quota.snapshot';

export interface MCEvent {
  id: string; // ulid-ish
  ts: string; // ISO
  level: EventLevel;
  type: EventType;
  message: string;
  taskId?: string;
  runId?: string;
  actor?: string; // director|worker|watchdog
  data?: any;
}

const EVENTS_FILE = '/root/.openclaw/workspace/repos/openclaw-dashboard/data/events.jsonl';

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

export async function readEvents(limit = 200): Promise<MCEvent[]> {
  try {
    const content = await fs.readFile(EVENTS_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    const tail = lines.slice(-limit);
    return tail
      .map((l) => {
        try { return JSON.parse(l) as MCEvent; } catch { return null; }
      })
      .filter(Boolean)
      .sort((a, b) => new Date(b!.ts).getTime() - new Date(a!.ts).getTime()) as MCEvent[];
  } catch {
    return [];
  }
}
