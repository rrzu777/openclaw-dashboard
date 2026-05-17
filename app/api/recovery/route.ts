import { NextResponse } from 'next/server';
import { getRecoveryRules, saveRecoveryRules, runRecoveryCheck } from '@/lib/auto-recovery';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rules = await getRecoveryRules();
  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === 'check') {
      const results = await runRecoveryCheck();
      return NextResponse.json({ results, timestamp: new Date().toISOString() });
    }

    if (body.rules && Array.isArray(body.rules)) {
      await saveRecoveryRules(body.rules);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
