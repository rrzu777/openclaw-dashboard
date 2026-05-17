// lib/constants.ts

// ── Paths (configurable via env) ──
export const SESSIONS_DIR = process.env.OPENCLAW_SESSIONS_DIR ?? '/root/.openclaw/agents/main/sessions';
export const JOBS_FILE = process.env.OPENCLAW_JOBS_FILE ?? '/root/.openclaw/cron/jobs.json';
export const SYSTEM_CRON_FILE = '/var/spool/cron/crontabs/root';
export const EVENTS_FILE = process.env.OPENCLAW_EVENTS_FILE ?? '/root/.openclaw/workspace/repos/openclaw-dashboard/data/events.jsonl';
export const AUDIT_FILE = process.env.OPENCLAW_AUDIT_FILE ?? '/root/.openclaw/workspace/repos/openclaw-dashboard/data/audit.jsonl';
export const DATA_DIR = process.env.OPENCLAW_DATA_DIR ?? '/root/.openclaw/workspace/repos/openclaw-dashboard/data';
export const INGEST_STATE_FILE = `${DATA_DIR}/ingest-state.json`;
export const AUTH_KEY_FILE = `${DATA_DIR}/.api-key`;
export const MEMORY_DIR = process.env.OPENCLAW_MEMORY_DIR ?? '/root/.openclaw/workspace/memory';
export const CLAUDE_LOGS_DIR = process.env.CLAUDE_LOGS_DIR ?? '/home/deploy-agent/.claude/logs';
export const GATEWAY_PROCESS = 'openclaw';
export const GATEWAY_HEALTH_URL = 'http://127.0.0.1:18789/';

// ── Polling intervals (ms) ──
export const EVENTS_POLL_INTERVAL = 15_000;
export const GATEWAY_POLL_INTERVAL = 30_000;
export const SYSTEM_HEALTH_POLL_INTERVAL = 30_000;
export const USAGE_POLL_INTERVAL = 15_000;
export const REALTIME_LOGS_POLL_INTERVAL = 2_000;

// ── API timeouts (ms) ──
export const DEFAULT_API_TIMEOUT = 3_000;
export const USAGE_TRACKER_TIMEOUT = 8_000;

// ── Ingest defaults ──
export const INGEST_LIMIT_FILES = 8;
export const INGEST_LIMIT_LINES = 1200;

// ── Rate limiting ──
export const RATE_LIMIT_WINDOW_MS = 60_000;
export const RATE_LIMIT_MAX_REQUESTS = 30;
export const RATE_LIMIT_DESTRUCTIVE_MAX = 5;
