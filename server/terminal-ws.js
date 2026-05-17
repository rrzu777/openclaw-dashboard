#!/usr/bin/env node
/**
 * WebSocket Terminal Server for Mission Control
 * Spawns PTY sessions for AI coding CLIs (claude, opencode, codex, openclaw)
 * Port 3001, auth via X-API-Key query param
 */

const { WebSocketServer } = require('ws');
const pty = require('node-pty');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = process.env.TERMINAL_WS_PORT || 3001;
const PASSPHRASE_FILE = path.join(__dirname, '..', 'data', '.terminal-passphrase');
const MAX_SESSIONS = 4;
const FAILED_ATTEMPTS = new Map(); // IP -> { count, lastAttempt }
const MAX_FAILED = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 min lockout

// ── Auth via scrypt passphrase ──
function verifyPassphrase(input) {
  let stored;
  try { stored = fs.readFileSync(PASSPHRASE_FILE, 'utf-8').trim(); } catch { return false; }
  const [saltHex, hashHex] = stored.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  const inputHash = crypto.scryptSync(input, salt, 64);
  return crypto.timingSafeEqual(inputHash, expectedHash);
}

function authenticate(req) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const token = url.searchParams.get('token');
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';

  // Check lockout
  const attempts = FAILED_ATTEMPTS.get(ip);
  if (attempts && attempts.count >= MAX_FAILED && (Date.now() - attempts.lastAttempt) < LOCKOUT_MS) {
    console.warn(`[terminal-ws] IP ${ip} locked out (${attempts.count} failed attempts)`);
    return false;
  }

  if (!token) return false;

  const valid = verifyPassphrase(token);
  if (!valid) {
    const entry = FAILED_ATTEMPTS.get(ip) || { count: 0, lastAttempt: 0 };
    entry.count++;
    entry.lastAttempt = Date.now();
    FAILED_ATTEMPTS.set(ip, entry);
    console.warn(`[terminal-ws] Failed auth from ${ip} (attempt ${entry.count})`);
    return false;
  }

  // Reset on success
  FAILED_ATTEMPTS.delete(ip);
  return true;
}

// ── Allowed CLIs ──
const ALLOWED_CLIS = {
  'claude': { cmd: '/root/.npm-global/bin/claude', args: [], env: {} },
  'opencode': { cmd: '/root/.opencode/bin/opencode', args: [], env: {} },
  'codex': { cmd: '/root/.npm-global/bin/codex', args: [], env: {} },
  'openclaw': { cmd: '/usr/bin/openclaw', args: [], env: {} },
  'bash': { cmd: '/bin/bash', args: [], env: {} },
};

// ── Session tracking ──
const sessions = new Map();

// ── WebSocket Server ──
const wss = new WebSocketServer({ port: PORT });

console.log(`[terminal-ws] Listening on ws://localhost:${PORT}`);

wss.on('connection', (ws, req) => {
  // Auth check
  if (!authenticate(req)) {
    ws.send(JSON.stringify({ type: 'error', data: 'Unauthorized' }));
    ws.close(4001, 'Unauthorized');
    return;
  }

  // Parse CLI choice from URL
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const cli = url.searchParams.get('cli') || 'bash';
  const cwd = url.searchParams.get('cwd') || '/root/.openclaw/workspace';
  const sessionId = crypto.randomBytes(8).toString('hex');

  if (!ALLOWED_CLIS[cli]) {
    ws.send(JSON.stringify({ type: 'error', data: `Unknown CLI: ${cli}` }));
    ws.close(4002, 'Invalid CLI');
    return;
  }

  if (sessions.size >= MAX_SESSIONS) {
    ws.send(JSON.stringify({ type: 'error', data: 'Max sessions reached (4). Close one first.' }));
    ws.close(4003, 'Max sessions');
    return;
  }

  const config = ALLOWED_CLIS[cli];

  // Spawn PTY
  const shell = pty.spawn(config.cmd, config.args, {
    name: 'xterm-256color',
    cols: 120,
    rows: 40,
    cwd: cwd,
    env: {
      ...process.env,
      ...config.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      FORCE_COLOR: '1',
    },
  });

  sessions.set(sessionId, { shell, ws, cli, startedAt: new Date().toISOString() });
  console.log(`[terminal-ws] Session ${sessionId} started: ${cli} (pid: ${shell.pid})`);

  // Send session info
  ws.send(JSON.stringify({
    type: 'session',
    data: { sessionId, cli, pid: shell.pid },
  }));

  // PTY -> WS
  shell.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'output', data }));
    }
  });

  shell.onExit(({ exitCode, signal }) => {
    console.log(`[terminal-ws] Session ${sessionId} exited (code: ${exitCode}, signal: ${signal})`);
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'exit', data: { exitCode, signal } }));
    }
    sessions.delete(sessionId);
    ws.close();
  });

  // WS -> PTY
  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg.toString());
      if (parsed.type === 'input' && typeof parsed.data === 'string') {
        shell.write(parsed.data);
      } else if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
        shell.resize(Math.min(parsed.cols, 300), Math.min(parsed.rows, 100));
      }
    } catch {
      // Raw text input fallback
      shell.write(msg.toString());
    }
  });

  ws.on('close', () => {
    console.log(`[terminal-ws] WS closed for session ${sessionId}`);
    if (sessions.has(sessionId)) {
      shell.kill();
      sessions.delete(sessionId);
    }
  });

  ws.on('error', (err) => {
    console.error(`[terminal-ws] WS error for ${sessionId}:`, err.message);
  });
});

// ── Graceful shutdown ──
process.on('SIGTERM', () => {
  console.log('[terminal-ws] Shutting down...');
  for (const [id, session] of sessions) {
    session.shell.kill();
    session.ws.close();
  }
  wss.close();
  process.exit(0);
});

// ── Health endpoint (simple HTTP on same port won't work with ws, use console) ──
setInterval(() => {
  if (sessions.size > 0) {
    console.log(`[terminal-ws] Active sessions: ${sessions.size}`);
  }
}, 60000);
