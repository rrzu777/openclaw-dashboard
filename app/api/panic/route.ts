import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import util from 'util';
import { requireAuth } from '@/lib/auth';

const execFilePromise = util.promisify(execFile);

export const dynamic = 'force-dynamic';

export async function GET() {
  // List running agent processes
  try {
    const { stdout: psOut } = await execFilePromise('ps', ['aux']);
    const processes = psOut
      .trim()
      .split('\n')
      .filter(line => /opencode|claw|python/i.test(line) && !line.includes('grep'))
      .slice(0, 10)
      .map(line => {
        const parts = line.split(/\s+/);
        return {
          pid: parts[1],
          user: parts[0],
          cpu: parts[2],
          mem: parts[3],
          command: parts.slice(10).join(' ').substring(0, 50) + '...',
        };
      })
      .filter(p => p.pid);

    return NextResponse.json({ processes });
  } catch {
    return NextResponse.json({ processes: [] });
  }
}

export async function POST(req: Request) {
  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { targets } = body;

    console.log('PANIC REQUEST:', targets);

    if (targets === 'ALL') {
      await execFilePromise('pkill', ['-f', 'opencode']).catch(() => {});
      await execFilePromise('pkill', ['-f', 'claw']).catch(() => {});
      return NextResponse.json({ status: 'killed_all', message: 'Nuclear option executed.' });
    }

    if (Array.isArray(targets) && targets.length > 0) {
      // Validate each PID is a numeric string
      const validPids = targets.filter(
        (pid: unknown): pid is string => typeof pid === 'string' && /^\d+$/.test(pid)
      );
      if (validPids.length === 0) {
        return NextResponse.json({ error: 'No valid PIDs provided' }, { status: 400 });
      }

      await execFilePromise('kill', ['-9', ...validPids]);
      return NextResponse.json({
        status: 'killed_selective',
        message: `Killed PIDs: ${validPids.join(', ')}`,
      });
    }

    return NextResponse.json({ error: 'No targets specified' }, { status: 400 });
  } catch (error) {
    console.error('Panic Failed:', error);
    return NextResponse.json({ error: 'Failed to execute kill command' }, { status: 500 });
  }
}
