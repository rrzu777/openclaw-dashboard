import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

interface SystemHealth {
  gateway: {
    running: boolean;
    pid?: number;
    cpu?: string;
    memory?: string;
    uptime?: string;
    responsive: boolean;
  };
  dashboard: {
    running: boolean;
    pid?: number;
    cpu?: string;
    memory?: string;
    uptime?: string;
  };
  watchdog: {
    running: boolean;
    lastCheck?: string;
    lastStatus?: string;
    recentRestarts?: number;
  };
  pm2Processes: {
    name: string;
    status: string;
    cpu: string;
    memory: string;
    uptime: string;
  }[];
  diskUsage: {
    total: string;
    used: string;
    available: string;
    percent: string;
  };
  timestamp: string;
}

export async function GET() {
  try {
    const health: SystemHealth = {
      gateway: await checkGateway(),
      dashboard: await checkDashboard(),
      watchdog: await checkWatchdog(),
      pm2Processes: await getPM2Processes(),
      diskUsage: await getDiskUsage(),
      timestamp: new Date().toISOString(),
    };

    return NextResponse.json(health);
  } catch (error) {
    console.error('System health check failed:', error);
    return NextResponse.json(
      { error: 'Failed to get system health', details: String(error) },
      { status: 500 }
    );
  }
}

async function checkGateway() {
  try {
    const psResult = await execFileAsync('pgrep', ['-f', 'openclaw.*gateway']);
    const pid = parseInt(psResult.stdout.trim().split('\n')[0], 10);
    
    if (!pid || isNaN(pid)) {
      return { running: false, responsive: false };
    }

    const psInfo = await execFileAsync('ps', ['-p', pid.toString(), '-o', '%cpu=,%mem=,etime=']);
    const parts = psInfo.stdout.trim().split(/\s+/);
    
    const cpu = parts[0] && !isNaN(parseFloat(parts[0])) ? `${parseFloat(parts[0]).toFixed(1)}%` : '0.0%';
    const mem = parts[1] && !isNaN(parseFloat(parts[1])) ? `${parseFloat(parts[1]).toFixed(1)}%` : '0.0%';
    const uptime = parts[2] || 'N/A';

    let responsive = false;
    try {
      const res = await fetch('http://127.0.0.1:18789/', { signal: AbortSignal.timeout(3000) });
      responsive = res.ok;
    } catch {
      responsive = false;
    }

    return { running: true, pid, cpu, memory: mem, uptime, responsive };
  } catch (e) {
    console.error('Gateway check error:', e);
    return { running: false, responsive: false };
  }
}

async function checkDashboard() {
  try {
    const psResult = await execFileAsync('pgrep', ['-f', 'next-server']);
    const pid = parseInt(psResult.stdout.trim().split('\n')[0], 10);
    
    if (!pid || isNaN(pid)) {
      return { running: false };
    }

    const psInfo = await execFileAsync('ps', ['-p', pid.toString(), '-o', '%cpu=,%mem=,etime=']);
    const parts = psInfo.stdout.trim().split(/\s+/);
    
    const cpu = parts[0] && !isNaN(parseFloat(parts[0])) ? `${parseFloat(parts[0]).toFixed(1)}%` : '0.0%';
    const mem = parts[1] && !isNaN(parseFloat(parts[1])) ? `${parseFloat(parts[1]).toFixed(1)}%` : '0.0%';
    const uptime = parts[2] || 'N/A';

    return { running: true, pid, cpu, memory: mem, uptime };
  } catch (e) {
    console.error('Dashboard check error:', e);
    return { running: false };
  }
}

async function checkWatchdog() {
  try {
    let cronRunning = false;
    try {
      const cronResult = await execFileAsync('crontab', ['-l']);
      cronRunning = cronResult.stdout.includes('gateway-watchdog');
    } catch {}

    let lastCheck = 'N/A';
    let lastStatus = 'OK';
    let recentRestarts = 0;
    
    try {
      const logResult = await execFileAsync('tail', ['-20', '/var/log/gateway-watchdog.log']);
      const lines = logResult.stdout.trim().split('\n').filter(l => l.length > 0);
      if (lines.length > 0) {
        const lastLine = lines[lines.length - 1];
        // Format: "Sat Feb 28 03:55:02 CET 2026: Gateway OK (...)"
        const timeMatch = lastLine.match(/^(\w+\s+\w+\s+\d+\s+[\d:]+)\s+[A-Z]+/);
        lastCheck = timeMatch ? timeMatch[1] : 'N/A';
        lastStatus = lastLine.includes('OK') ? 'OK' : (lastLine.includes('ALERTA') ? 'ALERT' : 'ERROR');
        recentRestarts = lines.filter(l => l.includes('RESTART')).length;
      }
    } catch {}

    return { running: cronRunning, lastCheck, lastStatus, recentRestarts };
  } catch (e) {
    console.error('Watchdog check error:', e);
    return { running: false, lastCheck: 'N/A', lastStatus: 'N/A', recentRestarts: 0 };
  }
}

async function getPM2Processes() {
  try {
    const result = await execFileAsync('pm2', ['jlist']);
    const processes = JSON.parse(result.stdout);
    if (!Array.isArray(processes)) return [];
    
    return processes.map((p: any) => ({
      name: p.name || 'unknown',
      status: p.pm2_env?.status || 'offline',
      cpu: `${(p.monit?.cpu || 0).toFixed(1)}%`,
      memory: formatMemory(p.monit?.memory || 0),
      uptime: formatUptime(p.pm2_env?.pm_uptime || Date.now()),
    }));
  } catch (e) {
    console.error('PM2 check error:', e);
    return [];
  }
}

async function getDiskUsage() {
  try {
    const result = await execFileAsync('df', ['-h', '/']);
    const lines = result.stdout.trim().split('\n');
    if (lines.length >= 2) {
      const parts = lines[1].split(/\s+/);
      return {
        total: parts[1],
        used: parts[2],
        available: parts[3],
        percent: parts[4],
      };
    }
  } catch {
    // Ignore
  }
  
  return { total: 'N/A', used: 'N/A', available: 'N/A', percent: 'N/A' };
}

function formatMemory(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)}GB`;
}

function formatUptime(timestamp: number): string {
  const ms = Date.now() - timestamp;
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}
