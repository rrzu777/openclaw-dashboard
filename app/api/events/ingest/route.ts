import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { appendEvent, type MCEvent } from '@/lib/events';
import { collectFromSessions } from '@/lib/collectors/openclawSessions';
import { requireAuth } from '@/lib/auth';
import { withFileLock } from '@/lib/file-lock';
import { INGEST_STATE_FILE, INGEST_LIMIT_FILES, INGEST_LIMIT_LINES, DATA_DIR } from '@/lib/constants';

async function readState(): Promise<{ sessions: { lastTs: string | null } }> {
  try {
    const raw = await fs.readFile(INGEST_STATE_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return { sessions: { lastTs: null } };
  }
}

async function writeState(state: { sessions: { lastTs: string | null } }) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(INGEST_STATE_FILE, JSON.stringify(state, null, 2) + '\n', 'utf-8');
}

export const dynamic = 'force-dynamic';

// Pull from sources and append into events.jsonl (dedup via cursor timestamp)
export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  return withFileLock(INGEST_STATE_FILE, async () => {
    const state = await readState();
    const collected = await collectFromSessions(INGEST_LIMIT_FILES, INGEST_LIMIT_LINES);

    // Keep only new events since last cursor
    const lastTs = state.sessions.lastTs ? new Date(state.sessions.lastTs).getTime() : null;
    const fresh = collected
      .filter((e) => {
        const eventTime = new Date(e.ts).getTime();
        return !isNaN(eventTime) && (lastTs ? eventTime > lastTs : true);
      })
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    let newestTs: string | null = state.sessions.lastTs;
    let appended = 0;

    for (const e of fresh) {
      const ev = {
        ...e,
        level: e.level ?? 'info',
        type: e.type ?? 'service.status',
        message: e.message ?? 'event',
      } satisfies Partial<MCEvent>;

      await appendEvent(ev);
      appended++;
      newestTs = e.ts;
    }

    if (newestTs !== state.sessions.lastTs) {
      state.sessions.lastTs = newestTs;
      await writeState(state);
    }

    return NextResponse.json({ appended, cursor: state.sessions.lastTs });
  });
}
