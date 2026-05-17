import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import util from 'util';

const execFilePromise = util.promisify(execFile);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Run usage tracker with timeout
    const { stdout } = await execFilePromise('timeout', [
      '8', 'python3', '/root/.openclaw/workspace/usage_tracker.py'
    ], { timeout: 10000 });

    // Parse output for useful info
    const gatewayMatch = stdout.match(/Gateway:.*RUNNING/);
    const processes = stdout.match(/PID \d+: CPU [\d.]+% MEM [\d.]+%/g) || [];
    
    // Extract AI process count
    const aiProcesses = processes.filter(p => !p.includes('python3') && !p.includes('timeout')).length;

    return NextResponse.json({
      gateway: {
        running: gatewayMatch !== null,
        status: gatewayMatch ? 'ONLINE' : 'OFFLINE'
      },
      aiProcesses: {
        count: aiProcesses,
        details: processes.slice(0, 5) // First 5 processes
      },
      opencode: {
        status: stdout.includes('OpenCode dir') ? 'INSTALLED' : 'NOT_FOUND',
        note: stdout.includes('Command failed') ? 'Stats command hangs - known issue' : 'OK'
      },
      raw_output: stdout.split('\n').slice(0, 20).join('\n'), // First 20 lines
    });
  } catch (error: any) {
    console.error('Usage API Error:', error.message);
    
    // Fallback: at least check if gateway is running
    try {
      let gatewayRunning = false;
      try {
        await execFilePromise('pgrep', ['-f', 'openclaw-gateway']);
        gatewayRunning = true;
      } catch {
        gatewayRunning = false;
      }
      
      return NextResponse.json({
        gateway: {
          running: gatewayRunning,
          status: gatewayRunning ? 'ONLINE (degraded)' : 'OFFLINE'
        },
        aiProcesses: { count: 0, details: [] },
        opencode: { status: 'UNKNOWN', note: 'Usage tracker failed: ' + error.message },
        error: true,
      });
    } catch {
      return NextResponse.json({
        gateway: { running: false, status: 'UNKNOWN' },
        aiProcesses: { count: 0, details: [] },
        opencode: { status: 'ERROR', note: 'Cannot determine status' },
        error: true,
      });
    }
  }
}
