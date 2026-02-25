# OpenClaw Mission Control Dashboard - Architecture Brainstorm

## Overview
A local-first, lightweight "Vibe Coding" dashboard for OpenClaw observability.
Stack: Next.js (App Router), Tailwind CSS, Lucide Icons.
Data Source: Direct filesystem access (no heavy DB).

## Core Modules

### 1. Activity Feed (The "Audit Log")
- **Source:** `/root/.openclaw/agents/main/sessions/*.jsonl`
- **Mechanism:**
  - `fs.watch` or polling on the sessions directory.
  - Parse last N lines of active session files.
  - Structured parsing of: Tool calls, Memory writes, Errors, Task completions.
- **UI:** Infinite scroll feed, timestamped, colored by event type (Info, Warning, Error, Success).

### 2. Calendar (The "Scheduler")
- **Source:**
  - `cron` (system): `/var/spool/cron/crontabs/root` (requires sudo/read access).
  - `OpenClaw Cron`: `openclaw cron list --format json` (via exec).
- **Mechanism:**
  - Parse cron expressions to calculate "Next Run".
  - Display past runs from logs (if available) and future runs.
- **UI:** Weekly view or Agenda view.

### 3. Global Search (The "Brain")
- **Source:**
  - `memory/` (Markdown files).
  - `sessions/` (JSONL transcripts).
  - `repos/` (Codebase).
- **Mechanism:**
  - Backend API endpoint spawns `grep` or `ripgrep` for blazing fast text search.
  - No indexing required (keep it stateless and lightweight).
- **UI:** Command palette style (Cmd+K).

## Implementation Plan

### Phase 1: Skeleton
- [ ] Initialize Next.js project in `repos/openclaw-dashboard`.
- [ ] Setup Tailwind + Lucide.
- [ ] Create basic Layout (Sidebar + Content Area).

### Phase 2: Feed
- [ ] Implement `lib/sessions.ts` to read JSONL files.
- [ ] Create `/api/feed` endpoint.
- [ ] Build Feed UI component.

### Phase 3: Calendar & Search
- [ ] Implement `lib/cron.ts` to wrap `openclaw cron list`.
- [ ] Implement `lib/search.ts` to wrap `grep`.
- [ ] Build Calendar and Search UI.
