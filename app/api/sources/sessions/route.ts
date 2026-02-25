import { NextResponse } from 'next/server';
import { collectFromSessions } from '@/lib/collectors/openclawSessions';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitFiles = Math.max(1, Math.min(25, Number(searchParams.get('files') ?? 5)));
  const limitLines = Math.max(50, Math.min(2000, Number(searchParams.get('lines') ?? 400)));
  const events = await collectFromSessions(limitFiles, limitLines);
  return NextResponse.json({ events });
}
