import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
export const dynamic = 'force-dynamic';

const ALLOWED_SOURCES: Record<string, string> = {
  'gateway': 'openclaw-gateway',
  'estrado-api': 'estrado-pjud',
  'estrado-worker': 'estrado-pjud-worker',
  'legaltech-monitor': 'legaltech-monitor',
  'resource-tracker': 'legaltech-resource-tracker',
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get('source') || 'gateway';
  const lines = Math.max(10, Math.min(500, Number(searchParams.get('lines') ?? 100)));
  const level = searchParams.get('level') || 'all';
  const search = searchParams.get('search')?.replace(/[^a-zA-Z0-9\s\-_.]/g, '') || '';

  const unit = ALLOWED_SOURCES[source];
  if (!unit) {
    return NextResponse.json({ error: `Unknown source: ${source}` }, { status: 400 });
  }

  try {
    const args = ['-u', unit, '-n', String(lines), '--no-pager', '-o', 'short-iso'];
    if (level === 'error') args.push('-p', 'err');
    else if (level === 'warn') args.push('-p', 'warning');

    const { stdout } = await execFileAsync('journalctl', args, { timeout: 10000 });
    const logLines = stdout.split('\n').filter(l => l.trim()).map(line => {
      try {
        const j = JSON.parse(line.substring(line.indexOf('{')));
        return { ts: j.ts || '', level: (j.level || 'info').toLowerCase(), text: j.msg || j.message || line };
      } catch {}
      const tsMatch = line.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+[+-]\d{2}:\d{2})/);
      const lvlMatch = line.match(/\b(ERROR|WARN|WARNING|INFO|DEBUG)\b/i);
      return {
        ts: tsMatch?.[1] || '',
        level: (lvlMatch?.[1] || 'info').toLowerCase().replace('warning', 'warn'),
        text: line,
      };
    }).filter(l => {
      if (level !== 'all' && l.level !== level) return false;
      if (search && !l.text.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

    return NextResponse.json({ source, lines: logLines, total: logLines.length });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read logs', details: String(error) }, { status: 500 });
  }
}
