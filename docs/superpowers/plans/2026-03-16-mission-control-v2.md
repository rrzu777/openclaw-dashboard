# Mission Control v2.0 - Bugfix & Feature Completion Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all bugs, close security gaps, and add missing monitoring/recovery features to make Mission Control a production-grade operations dashboard for OpenClaw.

**Architecture:** Server-side Next.js 16 app with file-based event store (JSONL), system process monitoring via child_process, and React client components polling REST APIs. We'll add a centralized config module, file-locking for state, rate limiting middleware, audit logging, and active recovery capabilities.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 3, Recharts 3, date-fns, lucide-react, cron-parser

---

## File Structure

### New files
- `lib/constants.ts` — All magic numbers, intervals, paths as named constants
- `lib/rate-limit.ts` — Simple in-memory rate limiter for API routes
- `lib/audit.ts` — Audit log for destructive actions (append to `data/audit.jsonl`)
- `lib/file-lock.ts` — Advisory file lock for state writes (prevents race conditions)
- `lib/api-response.ts` — Standardized API response shape helpers
- `components/LiveStatusIndicator.tsx` — Dynamic header status indicator (replaces hardcoded "System Online")
- `components/AuditLog.tsx` — Audit trail viewer widget
- `components/AlertConfig.tsx` — Alert threshold configuration widget
- `app/api/audit/route.ts` — GET audit log entries
- `app/api/alerts/route.ts` — GET/POST alert threshold config
- `app/api/retry/route.ts` — POST to retry failed tasks

### Modified files
- `lib/config.ts` — Add all paths and intervals from constants
- `lib/auth.ts` — Fix ephemeral key logging, persist to file
- `lib/events.ts` — Use file-lock, validate timestamps
- `lib/types.ts` — Add shared MCEvent type, AuditEntry, AlertConfig types
- `lib/cron.ts` — Handle cron expression parsing for Calendar projection
- `app/page.tsx` — Replace hardcoded status, add AuditLog widget
- `app/api/events/ingest/route.ts` — Fix race condition with file lock
- `app/api/panic/route.ts` — Add audit logging, fix `confirm()` on server
- `app/api/gateway/route.ts` — Add auth to POST, audit logging, fix shell usage
- `app/api/usage/route.ts` — Replace `exec` with `execFile`, fix error handling
- `app/api/system-health/route.ts` — Add pgrep multi-PID handling
- `components/ActivityFeed.tsx` — Import MCEvent from lib/types, remove duplicate type
- `components/SummaryWidget.tsx` — Remove duplicate MCEvent type
- `components/UsageStats.tsx` — Fix `confirm()` browser-only call, chart scaling
- `components/Search.tsx` — Handle missing title/name gracefully
- `components/Calendar.tsx` — Support real cron expressions in projection
- `components/SystemHealth.tsx` — Fix parseInt for percent with % suffix
- `contexts/EventsContext.tsx` — Import MCEvent from lib/types

---

## Chunk 1: Critical Bug Fixes

### Task 1: Centralize constants and types

**Files:**
- Create: `lib/constants.ts`
- Modify: `lib/types.ts`
- Modify: `lib/config.ts`

- [ ] **Step 1: Create `lib/constants.ts`**

```typescript
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
```

- [ ] **Step 2: Add shared types to `lib/types.ts`**

Add to existing `lib/types.ts` (keep existing types, add these):

```typescript
// Add to existing types.ts

export type EventLevel = 'info' | 'warn' | 'error';
export type EventType =
  | 'task.started'
  | 'task.checkpoint'
  | 'task.waiting_for_input'
  | 'task.completed'
  | 'task.failed'
  | 'tool.started'
  | 'tool.finished'
  | 'watchdog.heartbeat'
  | 'watchdog.stalled'
  | 'service.status'
  | 'quota.snapshot';

export interface MCEvent {
  id: string;
  ts: string;
  level: EventLevel;
  type: EventType;
  message: string;
  taskId?: string;
  runId?: string;
  actor?: string;
  data?: any; // kept as `any` for backwards compat with existing consumers
}

export interface AuditEntry {
  id: string;
  ts: string;
  action: string;
  actor: string;
  target?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export interface AlertThreshold {
  id: string;
  metric: 'error_rate' | 'disk_usage' | 'heartbeat_stale' | 'process_count';
  operator: '>' | '<' | '==' | '>=';
  value: number;
  enabled: boolean;
  description: string;
}
```

- [ ] **Step 3: Update `lib/config.ts` to add new route constants**

```typescript
// Replace lib/config.ts entirely
export const API_ROUTES = {
  cron: '/api/cron',
  usage: '/api/usage',
  panic: '/api/panic',
  events: '/api/events',
  feed: '/api/feed',
  search: '/api/search',
  gateway: '/api/gateway',
  systemHealth: '/api/system-health',
  audit: '/api/audit',
  alerts: '/api/alerts',
  retry: '/api/retry',
} as const;

export const APP_CONFIG = {
  name: 'OpenClaw Dashboard',
  version: '2.0.0',
} as const;
```

- [ ] **Step 4: Commit**

```bash
git add lib/constants.ts lib/types.ts lib/config.ts
git commit -m "feat: centralize constants, shared types, and config routes"
```

---

### Task 2: Fix race condition in ingest state (file lock)

**Files:**
- Create: `lib/file-lock.ts`
- Modify: `app/api/events/ingest/route.ts`
- Modify: `lib/events.ts`

- [ ] **Step 1: Create `lib/file-lock.ts`**

```typescript
// lib/file-lock.ts
import fs from 'fs/promises';

const LOCK_TIMEOUT = 10_000;
const RETRY_DELAY = 50;

export async function withFileLock<T>(lockPath: string, fn: () => Promise<T>): Promise<T> {
  const lockFile = lockPath + '.lock';
  const start = Date.now();

  while (true) {
    try {
      await fs.writeFile(lockFile, String(process.pid), { flag: 'wx' });
      break;
    } catch (err: any) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() - start > LOCK_TIMEOUT) {
        // Stale lock — remove and retry
        await fs.unlink(lockFile).catch(() => {});
        continue;
      }
      await new Promise((r) => setTimeout(r, RETRY_DELAY));
    }
  }

  try {
    return await fn();
  } finally {
    await fs.unlink(lockFile).catch(() => {});
  }
}
```

- [ ] **Step 2: Update `app/api/events/ingest/route.ts` to use file lock**

Replace the POST handler body (lines 26-60) to wrap state read/write in lock:

```typescript
// In app/api/events/ingest/route.ts - replace POST handler
import { withFileLock } from '@/lib/file-lock';
import { INGEST_STATE_FILE, INGEST_LIMIT_FILES, INGEST_LIMIT_LINES, DATA_DIR } from '@/lib/constants';

// Update STATE_FILE to use constant:
// const STATE_FILE = INGEST_STATE_FILE;
// Update readState/writeState to use DATA_DIR

export async function POST(request: Request) {
  const authError = requireAuth(request);
  if (authError) return authError;

  const result = await withFileLock(INGEST_STATE_FILE, async () => {
    const state = await readState();
    const collected = await collectFromSessions(INGEST_LIMIT_FILES, INGEST_LIMIT_LINES);

    const lastTs = state.sessions.lastTs ? new Date(state.sessions.lastTs).getTime() : null;
    const fresh = collected
      .filter((e) => {
        const eventTime = new Date(e.ts).getTime();
        return !isNaN(eventTime) && (lastTs ? eventTime > lastTs : true);
      })
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    let newestTs: string | null = state.sessions.lastTs;
    let appended = 0;

    for (const e of fresh) {
      const ev = {
        ...e,
        level: e.level ?? 'info',
        type: e.type ?? 'service.status',
        message: e.message ?? 'event',
      } satisfies Partial<MCEvent>;

      await appendEvent(ev);
      appended++;
      newestTs = e.ts;
    }

    if (newestTs !== state.sessions.lastTs) {
      state.sessions.lastTs = newestTs;
      await writeState(state);
    }

    return { appended, cursor: state.sessions.lastTs };
  });

  return NextResponse.json(result);
}
```

Key changes:
- Wrap in `withFileLock`
- Filter out NaN timestamps: `!isNaN(eventTime)`
- Use constants for magic numbers

- [ ] **Step 3: Update `lib/events.ts` to use constants and validate**

Replace `EVENTS_FILE` import with constant, add timestamp validation in `readEvents`:

```typescript
// In lib/events.ts line 30, replace hardcoded path:
import { EVENTS_FILE, DATA_DIR } from '@/lib/constants';
// Remove: const EVENTS_FILE = '...'

// In readEvents sort (line 60), add NaN guard:
.sort((a, b) => {
  const ta = new Date(b!.ts).getTime();
  const tb = new Date(a!.ts).getTime();
  if (isNaN(ta)) return 1;
  if (isNaN(tb)) return -1;
  return ta - tb;
}) as MCEvent[];
```

- [ ] **Step 4: Commit**

```bash
git add lib/file-lock.ts app/api/events/ingest/route.ts lib/events.ts
git commit -m "fix: race condition in ingest state with file lock, validate timestamps"
```

---

### Task 3: Fix auth key persistence (stop logging secrets)

**Files:**
- Modify: `lib/auth.ts`

- [ ] **Step 1: Update `lib/auth.ts` to persist generated keys**

```typescript
// Replace lib/auth.ts entirely
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import { AUTH_KEY_FILE, DATA_DIR } from '@/lib/constants';

let _cachedKey: string | null = null;

function getApiKey(): string {
  const envKey = process.env.OPENCLAW_DASHBOARD_API_KEY;
  if (envKey) return envKey;

  if (_cachedKey) return _cachedKey;

  // Try to read persisted key
  try {
    _cachedKey = fs.readFileSync(AUTH_KEY_FILE, 'utf-8').trim();
    if (_cachedKey) return _cachedKey;
  } catch {
    // File doesn't exist yet
  }

  // Generate and persist
  _cachedKey = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AUTH_KEY_FILE, _cachedKey, { mode: 0o600 });
    console.warn('[auth] Generated and persisted API key to', AUTH_KEY_FILE);
  } catch (err) {
    console.warn('[auth] Could not persist API key:', err);
  }

  return _cachedKey;
}

export function requireAuth(request: Request): NextResponse | null {
  const provided = request.headers.get('X-API-Key');
  const expected = getApiKey();

  if (!provided || provided.length !== expected.length) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid X-API-Key header.' },
      { status: 401 }
    );
  }

  if (!crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid X-API-Key header.' },
      { status: 401 }
    );
  }

  return null;
}
```

Key fixes:
- Key persisted to `data/.api-key` with mode 600
- Key value never logged to console
- Length check before timingSafeEqual (prevents crash on length mismatch)

- [ ] **Step 2: Commit**

```bash
git add lib/auth.ts
git commit -m "fix: persist API key to file, never log secret to console"
```

---

### Task 4: Fix hardcoded "System Online" indicator

**Files:**
- Create: `components/LiveStatusIndicator.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `components/LiveStatusIndicator.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { GATEWAY_POLL_INTERVAL } from '@/lib/constants';
import { clsx } from 'clsx';

type SystemStatus = 'online' | 'degraded' | 'offline' | 'loading';

export default function LiveStatusIndicator() {
  const [status, setStatus] = useState<SystemStatus>('loading');

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/system-health', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) { setStatus('offline'); return; }
        const data = await res.json();

        const gatewayUp = data.gateway?.responsive || data.gateway?.running;
        const dashboardUp = data.dashboard?.running;

        if (gatewayUp && dashboardUp) setStatus('online');
        else if (gatewayUp || dashboardUp) setStatus('degraded');
        else setStatus('offline');
      } catch {
        setStatus('offline');
      }
    };

    check();
    const interval = setInterval(check, GATEWAY_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, []);

  const config = {
    online: { color: 'bg-green-500', shadow: 'shadow-[0_0_8px_rgba(34,197,94,0.6)]', label: 'System Online', pulse: true },
    degraded: { color: 'bg-amber-500', shadow: 'shadow-[0_0_8px_rgba(245,158,11,0.6)]', label: 'Degraded', pulse: true },
    offline: { color: 'bg-red-500', shadow: 'shadow-[0_0_8px_rgba(239,68,68,0.6)]', label: 'System Offline', pulse: false },
    loading: { color: 'bg-gray-400', shadow: '', label: 'Checking...', pulse: true },
  }[status];

  return (
    <div className="flex gap-2 text-sm text-gray-500 items-center bg-white border px-3 py-1.5 rounded-full shadow-sm">
      <span className={clsx("w-2 h-2 rounded-full", config.color, config.shadow, config.pulse && "animate-pulse")} />
      <span className="font-medium">{config.label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Update `app/page.tsx` to use LiveStatusIndicator**

Replace lines 20-23 (the hardcoded status div) with the component:

```typescript
// In app/page.tsx, add import:
import LiveStatusIndicator from '@/components/LiveStatusIndicator';

// Replace the hardcoded div (lines 20-23):
//   <div className="flex gap-2 ...">
//     <span className="w-2 h-2 bg-green-500 ..."></span>
//     <span className="font-medium">System Online</span>
//   </div>
// With:
<LiveStatusIndicator />
```

- [ ] **Step 3: Commit**

```bash
git add components/LiveStatusIndicator.tsx app/page.tsx
git commit -m "fix: replace hardcoded System Online with live health indicator"
```

---

### Task 5: Fix `confirm()` server-side crash in UsageStats

**Files:**
- Modify: `components/UsageStats.tsx`

- [ ] **Step 1: Replace `confirm()` with state-based confirmation modal**

In `components/UsageStats.tsx`, line 80:
```typescript
// BEFORE (line 80):
if (target === 'ALL' && !confirm("⚠️ NUKE OPTION: Kill ALL agents?")) return;

// AFTER: Add state for confirmation
const [showKillAllConfirm, setShowKillAllConfirm] = useState(false);

// Update handleKill:
const handleKill = async (target: string | 'ALL' | 'SELECTED') => {
  if (target === 'ALL') {
    setShowKillAllConfirm(true);
    return;
  }
  await executeKill(target);
};

const executeKill = async (target: string | 'ALL' | 'SELECTED') => {
  setShowKillAllConfirm(false);
  setKilling(true);
  try {
    const body = {
      targets: target === 'ALL' ? 'ALL' : target === 'SELECTED' ? selectedPids : target
    };
    await fetch('/api/panic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    await fetchData();
    setSelectedPids([]);
  } catch {
    setError('Kill command failed');
  } finally {
    setKilling(false);
  }
};
```

Also add an error state and a confirmation dialog in the JSX (before the closing `</Card>`):

```tsx
{showKillAllConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6">
      <h3 className="text-lg font-semibold text-red-600 mb-2">Kill ALL Agents?</h3>
      <p className="text-sm text-gray-600 mb-4">This will terminate all running AI processes. This cannot be undone.</p>
      <div className="flex gap-3 justify-end">
        <Button variant="ghost" size="sm" onClick={() => setShowKillAllConfirm(false)}>Cancel</Button>
        <Button variant="danger" size="sm" onClick={() => executeKill('ALL')}>Kill All</Button>
      </div>
    </div>
  </div>
)}
```

Remove the `alert("Kill failed")` on line 94 and use `setError` state instead.

- [ ] **Step 2: Commit**

```bash
git add components/UsageStats.tsx
git commit -m "fix: replace confirm()/alert() with React confirmation modal in UsageStats"
```

---

### Task 6: Fix Search rendering undefined, SystemHealth parseInt

**Files:**
- Modify: `components/Search.tsx`
- Modify: `components/SystemHealth.tsx`

- [ ] **Step 1: Fix Search result rendering (line 103)**

```typescript
// In components/Search.tsx, line 103:
// BEFORE:
<p className="text-sm font-medium text-gray-900 truncate">{result.title || result.name}</p>

// AFTER:
<p className="text-sm font-medium text-gray-900 truncate">{result.title || result.name || result.fileName || 'Untitled'}</p>
```

Also update line 104:
```typescript
// BEFORE:
<p className="text-xs text-gray-500 mt-1 truncate">{result.description || result.type}</p>

// AFTER:
<p className="text-xs text-gray-500 mt-1 truncate">{result.description || result.content || result.type || ''}</p>
```

- [ ] **Step 2: Fix SystemHealth parseInt for percent (lines 217, 224)**

```typescript
// In components/SystemHealth.tsx, lines 217 and 224:
// BEFORE:
parseInt(health.diskUsage.percent)

// AFTER (handles "80%", "80", and "N/A"):
parseInt(health.diskUsage.percent.replace('%', '')) || 0
```

Apply this to both occurrences (line 217 and line 224).

- [ ] **Step 3: Commit**

```bash
git add components/Search.tsx components/SystemHealth.tsx
git commit -m "fix: handle missing search result fields, parse disk percent with % suffix"
```

---

### Task 7: Deduplicate MCEvent type across codebase

**Files:**
- Modify: `lib/events.ts`
- Modify: `components/ActivityFeed.tsx`
- Modify: `components/SummaryWidget.tsx`
- Modify: `contexts/EventsContext.tsx`

- [ ] **Step 1: Update `lib/events.ts` to import from `lib/types.ts`**

```typescript
// In lib/events.ts, remove lines 4-28 (local EventLevel, EventType, MCEvent definitions)
// Replace with:
import { MCEvent, EventLevel, EventType } from './types';

// Keep the re-export for backwards compat:
export type { MCEvent, EventLevel, EventType };
```

- [ ] **Step 2: Update `components/ActivityFeed.tsx` to import from lib/types**

```typescript
// In components/ActivityFeed.tsx, remove lines 17-40 (local type definitions)
// Add import:
import type { MCEvent, EventLevel, EventType } from '@/lib/types';
```

- [ ] **Step 3: Update `components/SummaryWidget.tsx` to import from lib/types**

```typescript
// In components/SummaryWidget.tsx, remove lines 11-17 (local MCEvent)
// Add import:
import type { MCEvent } from '@/lib/types';
```

- [ ] **Step 4: Update `contexts/EventsContext.tsx` to import from lib/types**

```typescript
// In contexts/EventsContext.tsx, remove lines 5-14 (local MCEvent)
// Add import:
import type { MCEvent } from '@/lib/types';
```

- [ ] **Step 5: Commit**

```bash
git add lib/events.ts components/ActivityFeed.tsx components/SummaryWidget.tsx contexts/EventsContext.tsx
git commit -m "refactor: deduplicate MCEvent type, single source of truth in lib/types"
```

---

## Chunk 2: Security Hardening

### Task 8: Add rate limiting middleware

**Files:**
- Create: `lib/rate-limit.ts`

- [ ] **Step 1: Create `lib/rate-limit.ts`**

```typescript
// lib/rate-limit.ts
import { NextResponse } from 'next/server';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, RATE_LIMIT_DESTRUCTIVE_MAX } from '@/lib/constants';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function getClientId(request: Request): string {
  return request.headers.get('x-forwarded-for')
    || request.headers.get('x-real-ip')
    || 'unknown';
}

function cleanup() {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key);
  }
}

export function rateLimit(
  request: Request,
  { maxRequests, windowMs, bucket = 'default' }: { maxRequests?: number; windowMs?: number; bucket?: string } = {}
): NextResponse | null {
  const max = maxRequests ?? RATE_LIMIT_MAX_REQUESTS;
  const window = windowMs ?? RATE_LIMIT_WINDOW_MS;

  const clientId = `${bucket}:${getClientId(request)}`;
  const now = Date.now();

  // Periodic cleanup (every 100 checks)
  if (Math.random() < 0.01) cleanup();

  const entry = store.get(clientId);
  if (!entry || entry.resetAt < now) {
    store.set(clientId, { count: 1, resetAt: now + window });
    return null;
  }

  entry.count++;
  if (entry.count > max) {
    return NextResponse.json(
      { error: 'Too many requests. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((entry.resetAt - now) / 1000)) } }
    );
  }

  return null;
}

/** Stricter limit for destructive actions (kill, restart, etc.) */
export function rateLimitDestructive(request: Request): NextResponse | null {
  return rateLimit(request, { maxRequests: RATE_LIMIT_DESTRUCTIVE_MAX, windowMs: RATE_LIMIT_WINDOW_MS, bucket: 'destructive' });
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/rate-limit.ts
git commit -m "feat: add in-memory rate limiting for API endpoints"
```

---

### Task 9: Add audit logging for destructive actions

**Files:**
- Create: `lib/audit.ts`

- [ ] **Step 1: Create `lib/audit.ts`**

```typescript
// lib/audit.ts
import fs from 'fs/promises';
import { AUDIT_FILE, DATA_DIR } from '@/lib/constants';
import type { AuditEntry } from '@/lib/types';

export async function logAudit(entry: Omit<AuditEntry, 'id' | 'ts'>): Promise<AuditEntry> {
  const full: AuditEntry = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    ts: new Date().toISOString(),
    ...entry,
  };

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.appendFile(AUDIT_FILE, JSON.stringify(full) + '\n', 'utf-8');
  return full;
}

export async function readAuditLog(limit = 100): Promise<AuditEntry[]> {
  try {
    const content = await fs.readFile(AUDIT_FILE, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);
    return lines
      .slice(-limit)
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean)
      .reverse();
  } catch {
    return [];
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/audit.ts
git commit -m "feat: add audit logging module for destructive actions"
```

---

### Task 10: Apply auth + rate limiting + audit to destructive endpoints

**Files:**
- Modify: `app/api/panic/route.ts`
- Modify: `app/api/gateway/route.ts`

- [ ] **Step 1: Update `app/api/panic/route.ts`**

Add rate limiting and audit logging to the POST handler:

```typescript
// At top of file, add imports:
import { rateLimitDestructive } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';

// In POST handler, before existing logic (after line 38):
export async function POST(req: Request) {
  const rlError = rateLimitDestructive(req);
  if (rlError) return rlError;

  const authError = requireAuth(req);
  if (authError) return authError;

  try {
    const body = await req.json();
    const { targets } = body;
    const clientIp = req.headers.get('x-forwarded-for') || 'unknown';

    console.log('PANIC REQUEST:', targets);

    if (targets === 'ALL') {
      await logAudit({ action: 'panic.kill_all', actor: 'api', ip: clientIp });
      // ... existing kill logic
    }

    if (Array.isArray(targets) && targets.length > 0) {
      // ... existing validation
      await logAudit({ action: 'panic.kill_selective', actor: 'api', target: validPids.join(','), ip: clientIp });
      // ... existing kill logic
    }
    // ...
  }
}
```

- [ ] **Step 2: Add auth to `app/api/gateway/route.ts` POST**

```typescript
// At top, add imports:
import { requireAuth } from '@/lib/auth';
import { rateLimitDestructive } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';

// In POST handler, add before existing logic:
export async function POST(request: Request) {
  const rlError = rateLimitDestructive(request);
  if (rlError) return rlError;

  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action } = body;
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';

    // ... existing validation ...

    await logAudit({ action: `gateway.${action}`, actor: 'api', ip: clientIp });
    const result = await executeGatewayAction(action);
    return NextResponse.json(result);
  } catch (error) {
    // ... existing error handling
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add app/api/panic/route.ts app/api/gateway/route.ts
git commit -m "feat: add auth, rate limiting, and audit logging to destructive endpoints"
```

---

### Task 11: Fix shell injection in usage route

**Files:**
- Modify: `app/api/usage/route.ts`

- [ ] **Step 1: Replace `exec` with `execFile` in usage route**

```typescript
// In app/api/usage/route.ts
// BEFORE (line 2):
import { exec } from 'child_process';

// AFTER:
import { execFile } from 'child_process';
const execFilePromise = util.promisify(execFile);

// BEFORE (line 12-15):
const { stdout } = await execPromise(
  'timeout 8 python3 /root/.openclaw/workspace/usage_tracker.py',
  { timeout: 10000 }
);

// AFTER:
const { stdout } = await execFilePromise('timeout', [
  '8', 'python3', '/root/.openclaw/workspace/usage_tracker.py'
], { timeout: 10000 });

// BEFORE (line 44):
const { stdout: pgrepOut } = await execPromise('pgrep -f openclaw-gateway && echo OK || echo FAIL');

// AFTER:
let gatewayRunning = false;
try {
  await execFilePromise('pgrep', ['-f', 'openclaw-gateway']);
  gatewayRunning = true;
} catch {
  gatewayRunning = false;
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/usage/route.ts
git commit -m "fix: replace exec with execFile in usage route to prevent shell injection"
```

---

### Task 12: Fix shell glob in gateway Claude logs

**Files:**
- Modify: `app/api/gateway/route.ts`

- [ ] **Step 1: Replace shell glob with fs-based approach**

```typescript
// In app/api/gateway/route.ts, replace getClaudeLogs function (lines 242-257):
import fs from 'fs/promises';
import path from 'path';
import { CLAUDE_LOGS_DIR } from '@/lib/constants';

async function getClaudeLogs() {
  try {
    const files = await fs.readdir(CLAUDE_LOGS_DIR);
    const logFiles = files.filter(f => f.endsWith('.log')).sort().slice(-3); // Last 3 log files

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
  } catch (error) {
    return NextResponse.json({
      success: true,
      logs: 'No Claude logs found (directory not accessible)',
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/gateway/route.ts
git commit -m "fix: replace shell glob with fs readdir for Claude logs"
```

---

## Chunk 3: Calendar & Cron Fix

### Task 13: Support real cron expressions in Calendar projection

**Files:**
- Modify: `components/Calendar.tsx`
- Modify: `lib/cron.ts`

- [ ] **Step 1: Update `lib/cron.ts` to use constants**

```typescript
// In lib/cron.ts, replace hardcoded paths:
import { JOBS_FILE, SYSTEM_CRON_FILE } from '@/lib/constants';
// Remove lines 5-6 (const JOBS_FILE, const SYSTEM_CRON_FILE)
```

- [ ] **Step 2: Update Calendar `projectRecurringJobs` to handle cron expressions**

In `components/Calendar.tsx`, update the projection function to also support cron expressions (not just "Every X min"):

```typescript
// Add import at top:
import { CronExpressionParser } from 'cron-parser';

// Replace projectRecurringJobs function (lines 31-59):
function projectRecurringJobs(jobs: CronJob[], weekStart: Date, weekEnd: Date): ProjectedSlot[] {
  const slots: ProjectedSlot[] = [];
  const now = new Date();

  jobs.forEach(job => {
    if (job.status === 'disabled') return;

    // Try "Every X min/h" format first
    const intervalHours = getScheduleIntervalHours(job.schedule);
    if (intervalHours && intervalHours > 0) {
      const intervalMs = intervalHours * 60 * 60 * 1000;
      let cursor = new Date(job.nextRun || now);
      if (cursor < weekStart) {
        const steps = Math.ceil((weekStart.getTime() - cursor.getTime()) / intervalMs);
        cursor = new Date(cursor.getTime() + steps * intervalMs);
      }
      while (cursor <= weekEnd) {
        if (cursor >= now) {
          slots.push({ job, date: new Date(cursor), time: format(cursor, 'HH:mm') });
        }
        cursor = new Date(cursor.getTime() + intervalMs);
      }
      return;
    }

    // Try cron expression
    try {
      const interval = CronExpressionParser.parse(job.schedule, {
        currentDate: weekStart,
        endDate: weekEnd,
      });
      while (true) {
        let d: Date;
        try { d = interval.next().toDate(); } catch { break; }
        if (d > weekEnd) break;
        if (d >= now) {
          slots.push({ job, date: d, time: format(d, 'HH:mm') });
        }
      }
    } catch {
      // Not a valid cron expression, skip
    }
  });

  return slots.sort((a, b) => a.date.getTime() - b.date.getTime());
}
```

- [ ] **Step 3: Commit**

```bash
git add components/Calendar.tsx lib/cron.ts
git commit -m "feat: Calendar supports real cron expressions in weekly projection"
```

---

## Chunk 4: Audit Trail & Recovery Features

### Task 14: Add audit log API and viewer component

**Files:**
- Create: `app/api/audit/route.ts`
- Create: `components/AuditLog.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `app/api/audit/route.ts`**

```typescript
// app/api/audit/route.ts
import { NextResponse } from 'next/server';
import { readAuditLog } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = Math.max(1, Math.min(500, Number(searchParams.get('limit') ?? 50)));
  const entries = await readAuditLog(limit);
  return NextResponse.json({ entries });
}
```

- [ ] **Step 2: Create `components/AuditLog.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Shield, ChevronDown, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface AuditEntry {
  id: string;
  ts: string;
  action: string;
  actor: string;
  target?: string;
  ip?: string;
}

export default function AuditLog() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'auditLog', defaultCollapsed: true });

  const fetchAudit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit?limit=20');
      if (res.ok) {
        const data = await res.json();
        setEntries(data.entries || []);
      }
    } catch (err) {
      console.error('Audit fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudit();
    const interval = setInterval(fetchAudit, 30000);
    return () => clearInterval(interval);
  }, []);

  const getActionColor = (action: string) => {
    if (action.includes('kill')) return 'error';
    if (action.includes('restart') || action.includes('stop')) return 'warning';
    return 'info';
  };

  return (
    <Card padding="none">
      <SectionHeader
        title="Audit Trail"
        description="Destructive action log"
        icon={<Shield className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); fetchAudit(); }}>
              <RefreshCw className={clsx("w-4 h-4", loading && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}>
              <ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} />
            </Button>
          </div>
        }
        className="px-4 py-3"
      />

      <CardContent className={clsx(
        "transition-all duration-300",
        isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100"
      )}>
        <div className="max-h-64 overflow-y-auto custom-scrollbar">
          {entries.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No audit entries yet</p>
          ) : (
            entries.map(entry => (
              <div key={entry.id} className="flex items-center gap-3 py-2 px-1 border-b border-gray-100 last:border-0 text-xs">
                <Badge variant={getActionColor(entry.action) as any} size="sm">{entry.action}</Badge>
                <span className="text-gray-500 flex-1 truncate">{entry.target || '—'}</span>
                <span className="text-gray-400 shrink-0">
                  {formatDistanceToNow(new Date(entry.ts), { addSuffix: true })}
                </span>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Add AuditLog to page.tsx right column**

In `app/page.tsx`, add import and place before closing `</div>` of right column:

```typescript
// Add import:
import AuditLog from '@/components/AuditLog';

// In the right column div (after UsageStats widget, around line 79):
<div className="rounded-xl border bg-white shadow-sm overflow-hidden p-1 shrink-0">
  <AuditLog />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add app/api/audit/route.ts components/AuditLog.tsx app/page.tsx
git commit -m "feat: add audit trail viewer for destructive action history"
```

---

### Task 15: Add task retry endpoint (active recovery)

**Files:**
- Create: `app/api/retry/route.ts`

- [ ] **Step 1: Create retry route**

```typescript
// app/api/retry/route.ts
import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { requireAuth } from '@/lib/auth';
import { rateLimitDestructive } from '@/lib/rate-limit';
import { logAudit } from '@/lib/audit';
import { appendEvent } from '@/lib/events';

const execFileAsync = promisify(execFile);

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const rlError = rateLimitDestructive(request);
  if (rlError) return rlError;

  const authError = requireAuth(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { action } = body;
    const clientIp = request.headers.get('x-forwarded-for') || 'unknown';

    if (action === 'restart-gateway') {
      await logAudit({ action: 'retry.restart_gateway', actor: 'api', ip: clientIp });
      try {
        await execFileAsync('systemctl', ['restart', 'openclaw-gateway']);
        await appendEvent({
          level: 'info',
          type: 'service.status',
          message: 'Gateway restarted via retry',
          actor: 'dashboard',
        });
        return NextResponse.json({ success: true, message: 'Gateway restart initiated' });
      } catch (err) {
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
      }
    }

    if (action === 'restart-watchdog') {
      await logAudit({ action: 'retry.restart_watchdog', actor: 'api', ip: clientIp });
      // Trigger the watchdog cron script manually
      try {
        await execFileAsync('bash', ['/root/.openclaw/scripts/gateway-watchdog.sh']);
        return NextResponse.json({ success: true, message: 'Watchdog check triggered' });
      } catch (err) {
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
      }
    }

    if (action === 'clear-stale-events') {
      await logAudit({ action: 'retry.clear_stale', actor: 'api', ip: clientIp });
      // Mark stale watchdog events as resolved by appending a resolution event
      await appendEvent({
        level: 'info',
        type: 'service.status',
        message: 'Stale events cleared by operator',
        actor: 'dashboard',
      });
      return NextResponse.json({ success: true, message: 'Stale events cleared' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: 'Retry failed', details: String(error) }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/retry/route.ts
git commit -m "feat: add retry/recovery endpoint for gateway restart and watchdog trigger"
```

---

## Chunk 5: Standardize Error Handling & Code Quality

### Task 16: Standardize API response shape

**Files:**
- Create: `lib/api-response.ts`

- [ ] **Step 1: Create API response helpers**

```typescript
// lib/api-response.ts
import { NextResponse } from 'next/server';

interface ApiSuccess<T = unknown> {
  ok: true;
  data: T;
}

interface ApiError {
  ok: false;
  error: string;
  details?: string;
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiError(error: string, status = 500, details?: string): NextResponse<ApiError> {
  return NextResponse.json({ ok: false, error, details }, { status });
}
```

This is provided for progressive adoption — new endpoints should use it, existing endpoints can be migrated incrementally.

- [ ] **Step 2: Commit**

```bash
git add lib/api-response.ts
git commit -m "feat: add standardized API response helpers"
```

---

### Task 17: Use constants in sessions and collectors

**Files:**
- Modify: `lib/sessions.ts`
- Modify: `lib/collectors/openclawSessions.ts`

- [ ] **Step 1: Update `lib/sessions.ts` to use constant**

```typescript
// In lib/sessions.ts, line 5:
// BEFORE:
const SESSIONS_DIR = '/root/.openclaw/agents/main/sessions';

// AFTER:
import { SESSIONS_DIR } from './constants';
```

- [ ] **Step 2: Update `lib/collectors/openclawSessions.ts` to use constant**

```typescript
// In lib/collectors/openclawSessions.ts, line 5:
// BEFORE:
const SESSIONS_DIR = '/root/.openclaw/agents/main/sessions';

// AFTER:
import { SESSIONS_DIR } from '@/lib/constants';
```

- [ ] **Step 3: Update `app/api/search/route.ts` to use constant**

```typescript
// In app/api/search/route.ts, line 7:
// BEFORE:
const MEMORY_DIR = '/root/.openclaw/workspace/memory';

// AFTER:
import { MEMORY_DIR } from '@/lib/constants';
```

- [ ] **Step 4: Commit**

```bash
git add lib/sessions.ts lib/collectors/openclawSessions.ts app/api/search/route.ts
git commit -m "refactor: use centralized path constants in sessions, collectors, search"
```

---

### Task 18: Fix system-health pgrep multi-PID handling

**Files:**
- Modify: `app/api/system-health/route.ts`

- [ ] **Step 1: Fix pgrep returning multiple PIDs**

In `checkGateway()` (line 70-71) and `checkDashboard()` (line 101-102):

```typescript
// In checkGateway, line 71:
// BEFORE:
const pid = parseInt(psResult.stdout.trim(), 10);

// AFTER (take first PID only):
const pid = parseInt(psResult.stdout.trim().split('\n')[0], 10);
```

The `checkDashboard` already does this (line 102), so only `checkGateway` needs the fix.

- [ ] **Step 2: Commit**

```bash
git add app/api/system-health/route.ts
git commit -m "fix: handle pgrep returning multiple PIDs in gateway health check"
```

---

## Chunk 6: Alert Configuration (New Feature)

### Task 19: Add alert threshold configuration

**Files:**
- Create: `app/api/alerts/route.ts`
- Create: `components/AlertConfig.tsx`
- Modify: `app/page.tsx`

- [ ] **Step 1: Create `app/api/alerts/route.ts`**

```typescript
// app/api/alerts/route.ts
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import { DATA_DIR } from '@/lib/constants';
import type { AlertThreshold } from '@/lib/types';

const ALERTS_FILE = `${DATA_DIR}/alerts.json`;

async function readAlerts(): Promise<AlertThreshold[]> {
  try {
    const raw = await fs.readFile(ALERTS_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return getDefaults();
  }
}

async function writeAlerts(alerts: AlertThreshold[]) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(ALERTS_FILE, JSON.stringify(alerts, null, 2), 'utf-8');
}

function getDefaults(): AlertThreshold[] {
  return [
    { id: 'err-rate', metric: 'error_rate', operator: '>', value: 5, enabled: true, description: 'Error count exceeds 5 in 24h' },
    { id: 'disk', metric: 'disk_usage', operator: '>', value: 80, enabled: true, description: 'Disk usage exceeds 80%' },
    { id: 'heartbeat', metric: 'heartbeat_stale', operator: '>', value: 10, enabled: true, description: 'No heartbeat for 10+ minutes' },
    { id: 'procs', metric: 'process_count', operator: '>', value: 20, enabled: false, description: 'More than 20 AI processes' },
  ];
}

export const dynamic = 'force-dynamic';

export async function GET() {
  const alerts = await readAlerts();
  return NextResponse.json({ alerts });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.alerts)) {
      return NextResponse.json({ error: 'alerts must be an array' }, { status: 400 });
    }
    await writeAlerts(body.alerts);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}
```

- [ ] **Step 2: Create `components/AlertConfig.tsx`**

```typescript
'use client';

import { useState, useEffect } from 'react';
import { Bell, ChevronDown, Save } from 'lucide-react';
import { clsx } from 'clsx';
import { useCollapsible } from '@/lib/hooks/useCollapsible';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { SectionHeader } from '@/components/ui/SectionHeader';

interface AlertThreshold {
  id: string;
  metric: string;
  operator: string;
  value: number;
  enabled: boolean;
  description: string;
}

export default function AlertConfig() {
  const [alerts, setAlerts] = useState<AlertThreshold[]>([]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const { isCollapsed, toggle } = useCollapsible({ sectionId: 'alertConfig', defaultCollapsed: true });

  useEffect(() => {
    fetch('/api/alerts')
      .then(r => r.json())
      .then(d => setAlerts(d.alerts || []))
      .catch(() => {});
  }, []);

  const toggleAlert = (id: string) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, enabled: !a.enabled } : a));
    setDirty(true);
  };

  const updateValue = (id: string, value: number) => {
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, value } : a));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts }),
      });
      setDirty(false);
    } catch {
      // Handle error
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="none">
      <SectionHeader
        title="Alert Thresholds"
        description="Configure monitoring alerts"
        icon={<Bell className="w-5 h-5" />}
        action={
          <div className="flex items-center gap-1">
            {dirty && (
              <Button variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); save(); }} disabled={saving}>
                <Save className="w-3.5 h-3.5 mr-1" />
                Save
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); toggle(); }}>
              <ChevronDown className={clsx("w-4 h-4 transition-transform", isCollapsed && "-rotate-90")} />
            </Button>
          </div>
        }
        className="px-4 py-3"
      />

      <CardContent className={clsx(
        "transition-all duration-300",
        isCollapsed ? "max-h-0 opacity-0 p-0 overflow-hidden" : "max-h-none opacity-100"
      )}>
        <div className="space-y-3">
          {alerts.map(alert => (
            <div key={alert.id} className="flex items-center gap-3 p-2 rounded-md border border-gray-200 hover:bg-gray-50">
              <input
                type="checkbox"
                checked={alert.enabled}
                onChange={() => toggleAlert(alert.id)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600"
              />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700">{alert.description}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="default" size="sm">{alert.metric}</Badge>
                  <span className="text-xs text-gray-500">{alert.operator}</span>
                  <input
                    type="number"
                    value={alert.value}
                    onChange={(e) => updateValue(alert.id, Number(e.target.value))}
                    className="w-16 text-xs border rounded px-1.5 py-0.5"
                    disabled={!alert.enabled}
                  />
                </div>
              </div>
              <Badge variant={alert.enabled ? 'success' : 'default'} size="sm">
                {alert.enabled ? 'Active' : 'Off'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Add AlertConfig to page.tsx right column**

```typescript
// In app/page.tsx, add import:
import AlertConfig from '@/components/AlertConfig';

// Place after AuditLog in right column:
<div className="rounded-xl border bg-white shadow-sm overflow-hidden p-1 shrink-0">
  <AlertConfig />
</div>
```

- [ ] **Step 4: Commit**

```bash
git add app/api/alerts/route.ts components/AlertConfig.tsx app/page.tsx
git commit -m "feat: add configurable alert thresholds for monitoring"
```

---

## Chunk 7: Build & Verify

### Task 20: Build and verify the application compiles

- [ ] **Step 1: Run TypeScript type check**

```bash
cd /root/.openclaw/workspace/repos/openclaw-dashboard && npx tsc --noEmit
```

Expected: no type errors (fix any that appear)

- [ ] **Step 2: Run the build**

```bash
cd /root/.openclaw/workspace/repos/openclaw-dashboard && npm run build
```

Expected: successful build with no errors

- [ ] **Step 3: Run linter**

```bash
cd /root/.openclaw/workspace/repos/openclaw-dashboard && npm run lint
```

Expected: clean or only pre-existing warnings

- [ ] **Step 4: Final commit with version bump**

```bash
# In app/page.tsx, update version in header:
# "Mission Control v1.4" -> "Mission Control v2.0"
git add -A
git commit -m "chore: bump to Mission Control v2.0"
```

---

## Summary of Changes

| Category | Items | Tasks |
|----------|-------|-------|
| Critical bugs | Race condition, hardcoded status, NaN timestamps, confirm() crash | Tasks 2, 4, 5, 6 |
| Security | Auth persistence, rate limiting, audit logging, shell injection | Tasks 3, 8-12 |
| Code quality | Centralized constants/types, deduplicated MCEvent, API responses | Tasks 1, 7, 16-18 |
| New features | Audit trail viewer, alert thresholds, task retry endpoint | Tasks 14, 15, 19 |
| Calendar fix | Cron expression support in projections | Task 13 |

### Not included (future work)
These were identified but are larger efforts suited for separate plans:
- **Historical trending charts** — requires time-series storage
- **External integrations** (Slack/PagerDuty webhooks) — requires webhook infra
- **Multi-user auth** (roles/permissions) — requires auth provider
- **Auto-recovery rules** ("restart if down for 5min") — requires background scheduler
- **Event export** (CSV/PDF) — lower priority UX feature
- **Dashboard customization** (drag-and-drop layout) — major UI refactor
