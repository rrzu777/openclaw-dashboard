import { NextResponse } from 'next/server';
import { getWebhooks, saveWebhooks, fireWebhooks } from '@/lib/webhooks';

export const dynamic = 'force-dynamic';

export async function GET() {
  const webhooks = await getWebhooks();
  return NextResponse.json({ webhooks });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (body.action === 'test' && body.webhookId) {
      const webhooks = await getWebhooks();
      const wh = webhooks.find(w => w.id === body.webhookId);
      if (!wh) return NextResponse.json({ error: 'Webhook not found' }, { status: 404 });
      const results = await fireWebhooks('status', { test: true, message: 'Test from Mission Control' });
      return NextResponse.json({ results });
    }

    if (Array.isArray(body.webhooks)) {
      await saveWebhooks(body.webhooks);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
