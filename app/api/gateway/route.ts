import { NextResponse } from 'next/server';
import { execFile, spawn } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { GatewayStatus, GatewayAction } from '@/lib/types';
import { CLAUDE_LOGS_DIR } from '@/lib/constants';
import { requireAuth } from '@/lib/auth';
import { rateLimitDestructive } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';

const execFileAsync = promisify(execFile);

// Allowed commands for security
const ALLOWED_COMMANDS = ['openclaw', 'systemctl', 'pgrep', 'pkill', 'journalctl', 'tail'] as const;
type AllowedCommand = (typeof ALLOWED_COMMANDS)[number];

const GATEWAY_PROCESS = 'openclaw';

function isAllowedCommand(cmd: string): cmd is AllowedCommand {
  return ALLOWED_COMMANDS.includes(cmd as AllowedCommand);
}

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');

  try {
    if (action === 'realtime-logs') {
      // Return initial logs for polling approach
      return await getRealtimeLogs();
    } else if (action === 'status') {
      return await getSystemctlStatus();
    } else if (action === 'claude-logs') {
      return await getClaudeLogs();
    } else {
      const status = await getGatewayStatus();
      return NextResponse.json({ status });
    }
  } catch (error) {
    console.error('Gateway status error:', error);
    return NextResponse.json(
      { error: 'Failed to get gateway status', details: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const rlError = rateLimitDestructive(request);
  if (rlError) return rlError;

  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action } = body as { action?: GatewayAction | 'restart' };

    if (!action || !isValidAction(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: start, stop, restart, or logs' },
        { status: 400 }
      );
    }

    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';
    await logAudit({ action: `gateway.${action}`, actor: 'api', ip: clientIp });

    const result = await executeGatewayAction(action);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Gateway action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute gateway action', details: String(error) },
      { status: 500 }
    );
  }
}

function isValidAction(action: string): action is GatewayAction | 'restart' {
  return ['start', 'stop', 'restart', 'logs'].includes(action);
}

async function getGatewayStatus(): Promise<GatewayStatus> {
  try {
    // Get PID using pgrep
    const pidResult = await execFileAsync('pgrep', ['-f', GATEWAY_PROCESS]);
    const pid = pidResult.stdout.trim() ? parseInt(pidResult.stdout.trim(), 10) : undefined;

    if (!pid) {
      return {
        running: false,
        lastChecked: new Date().toISOString(),
      };
    }

    // Get uptime using ps
    const uptimeResult = await execFileAsync('ps', ['-o', 'etime=', '-p', pid.toString()]);
    const uptime = uptimeResult.stdout.trim() || 'unknown';

    // Get version by running openclaw --version
    let version: string | undefined;
    try {
      const versionResult = await execFileAsync('openclaw', ['--version']);
      version = versionResult.stdout.trim().split('\n')[0];
    } catch {
      version = 'unknown';
    }

    return {
      running: true,
      pid,
      uptime,
      version,
      lastChecked: new Date().toISOString(),
    };
  } catch {
    return {
      running: false,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function executeGatewayAction(action: GatewayAction | 'restart') {
  switch (action) {
    case 'start':
      return await startGateway();
    case 'stop':
      return await stopGateway();
    case 'restart':
      return await restartGateway();
    case 'logs':
      return await getGatewayLogs();
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function startGateway() {
  // Check if already running
  const status = await getGatewayStatus();
  if (status.running) {
    return { success: true, message: 'Gateway is already running', pid: status.pid };
  }

  // Start gateway using openclaw gateway start
  const result = await execFileAsync('openclaw', ['gateway', 'start']);
  return {
    success: true,
    message: 'Gateway started successfully',
    output: result.stdout.trim(),
  };
}

async function stopGateway() {
  const status = await getGatewayStatus();
  if (!status.running) {
    return { success: true, message: 'Gateway is not running' };
  }

  // Stop gateway using openclaw gateway stop
  const result = await execFileAsync('openclaw', ['gateway', 'stop']);
  return {
    success: true,
    message: 'Gateway stopped successfully',
    output: result.stdout.trim(),
  };
}

async function restartGateway() {
  // Restart gateway using systemctl restart openclaw-gateway
  const result = await execFileAsync('systemctl', ['restart', 'openclaw-gateway']);
  return {
    success: true,
    message: 'Gateway restarted successfully',
    output: result.stdout.trim(),
  };
}

async function getGatewayLogs() {
  try {
    // Get last 100 lines of openclaw logs using journalctl
    const result = await execFileAsync('journalctl', [
      '-u',
      'openclaw',
      '-n',
      '100',
      '--no-pager',
    ]);
    return {
      success: true,
      logs: result.stdout,
    };
  } catch (error) {
    // Fallback: try to get logs from openclaw command
    try {
      const result = await execFileAsync('openclaw', ['gateway', 'logs', '--lines', '100']);
      return {
        success: true,
        logs: result.stdout,
      };
    } catch {
      return {
        success: false,
        logs: 'Unable to retrieve logs. Gateway may not be running as a system service.',
      };
    }
  }
}

// New endpoints for Quick Commands section

async function getRealtimeLogs() {
  try {
    // Get last 50 lines of openclaw-gateway logs (without -f to avoid blocking)
    const result = await execFileAsync('journalctl', [
      '-u',
      'openclaw-gateway',
      '-n',
      '50',
      '--no-pager',
    ]);
    return NextResponse.json({
      success: true,
      logs: result.stdout,
    });
  } catch (error) {
    console.error('Realtime logs error:', error);
    return NextResponse.json(
      { error: 'Failed to get realtime logs', details: String(error) },
      { status: 500 }
    );
  }
}

async function getSystemctlStatus() {
  try {
    const result = await execFileAsync('systemctl', ['status', 'openclaw-gateway']);
    return NextResponse.json({
      success: true,
      output: result.stdout,
    });
  } catch (error: any) {
    // systemctl status returns non-zero exit code when service is not running
    // but still provides useful output in stderr
    return NextResponse.json({
      success: true,
      output: error.stderr || String(error),
    });
  }
}

async function getClaudeLogs() {
  try {
    const files = await fs.readdir(CLAUDE_LOGS_DIR);
    const logFiles = files.filter(f => f.endsWith('.log')).sort().slice(-3);

    let combined = '';
    for (const file of logFiles) {
      const content = await fs.readFile(path.join(CLAUDE_LOGS_DIR, file), 'utf-8');
      const lines = content.split('\n');
      combined += `=== ${file} ===\n` + lines.slice(-50).join('\n') + '\n';
    }

    return NextResponse.json({
      success: true,
      logs: combined || 'No Claude logs found',
    });
  } catch {
    return NextResponse.json({
      success: true,
      logs: 'No Claude logs found (directory not accessible)',
    });
  }
}
