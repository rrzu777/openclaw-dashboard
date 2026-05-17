import { NextResponse } from 'next/server';
import { appendEvent, readEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(1000, Number(searchParams.get('limit') ?? 200)));
  const includeHeartbeats = searchParams.get('heartbeats') === 'true';
  const events = await readEvents(limit, includeHeartbeats);
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // Minimal validation
    if (!body?.type || !body?.level || !body?.message) {
      return NextResponse.json({ error: 'Missing fields: type, level, message' }, { status: 400 });
    }
    const event = await appendEvent(body);
    return NextResponse.json({ event });
  } catch (e) {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }
}
