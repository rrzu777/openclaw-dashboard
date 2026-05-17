import { NextResponse } from 'next/server';
import { readEvents } from '@/lib/events';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'csv';
  const limit = Math.max(1, Math.min(5000, Number(searchParams.get('limit') ?? 1000)));
  const includeHeartbeats = searchParams.get('heartbeats') === 'true';

  const events = await readEvents(limit, includeHeartbeats);

  if (format === 'json') {
    return new NextResponse(JSON.stringify(events, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="events-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  }

  // CSV format
  const headers = ['id', 'ts', 'level', 'type', 'message', 'actor', 'taskId'];
  const csvRows = [
    headers.join(','),
    ...events.map(e =>
      headers.map(h => {
        const val = String((e as any)[h] ?? '');
        // Escape CSV: wrap in quotes if contains comma, quote, or newline
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          return `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      }).join(',')
    ),
  ];

  return new NextResponse(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="events-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
