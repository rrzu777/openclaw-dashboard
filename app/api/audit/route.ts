import { NextResponse } from 'next/server';
import { readAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit') ?? 50)));
  const entries = await readAuditLog(limit);
  return NextResponse.json({ entries });
}
