import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import util from 'util';

const execFilePromise = util.promisify(execFile);

const USAGE_TRACKER = '/root/.openclaw/workspace/usage_tracker.py';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Use execFile with argument array to prevent shell injection
    const { stdout } = await execFilePromise('python3', [USAGE_TRACKER]);

    const stats = {
      claude: { daily: 0, weekly: 0, status: 'OK' },
      opencode: { cost: 0, total_tokens: 0 },
      raw_log: stdout,
    };

    // Parse Claude Usage
    const dailyMatch = stdout.match(/Daily Usage: (\d+)%/);
    if (dailyMatch) stats.claude.daily = parseInt(dailyMatch[1]);

    const weeklyMatch = stdout.match(/Weekly Usage: (\d+)%/);
    if (weeklyMatch) stats.claude.weekly = parseInt(weeklyMatch[1]);

    if (stdout.includes('RATE LIMITED')) stats.claude.status = 'LIMITED';

    // Parse OpenCode Stats
    const costMatch = stdout.match(/Total Cost.*\$([0-9.]+)/);
    if (costMatch) stats.opencode.cost = parseFloat(costMatch[1]);

    return NextResponse.json(stats);
  } catch (error) {
    console.error('Usage API Error:', error);
    // Return mock data on failure so UI doesn't break
    return NextResponse.json({
      claude: { daily: 45, weekly: 30, status: 'OK' },
      opencode: { cost: 1.25, total_tokens: 50000 },
      mock: true,
    });
  }
}
