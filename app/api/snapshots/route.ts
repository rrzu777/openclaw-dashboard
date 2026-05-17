import { NextResponse } from 'next/server';
import { captureSnapshot, readSnapshots } from '@/lib/snapshots';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const hours = Math.max(1, Math.min(168, Number(searchParams.get('hours') ?? 24)));
  const snapshots = await readSnapshots(hours);
  return NextResponse.json({ snapshots });
}

export async function POST() {
  const snapshot = await captureSnapshot();
  return NextResponse.json({ snapshot });
}
