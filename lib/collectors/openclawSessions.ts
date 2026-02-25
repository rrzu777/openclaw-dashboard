import fs from 'fs/promises';
import path from 'path';
import { MCEvent } from '@/lib/events';

const SESSIONS_DIR = '/root/.openclaw/agents/main/sessions';

function toLevel(t: string): 'info' | 'warn' | 'error' {
  if (t.includes('error') || t === 'tool_error') return 'error';
  return 'info';
}

function short(str: string, n = 180) {
  if (!str) return str;
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export async function collectFromSessions(limitFiles = 5, limitLines = 400): Promise<MCEvent[]> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(SESSIONS_DIR))
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => path.join(SESSIONS_DIR, f));
  } catch {
    return [];
  }

  // newest first
  const stats = await Promise.all(
    files.map(async (f) => {
      try {
        const s = await fs.stat(f);
        return { f, mtimeMs: s.mtimeMs };
      } catch {
        return { f, mtimeMs: 0 };
      }
    })
  );
  const newest = stats
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, limitFiles)
    .map((x) => x.f);

  const events: MCEvent[] = [];

  for (const file of newest) {
    let content = '';
    try {
      content = await fs.readFile(file, 'utf-8');
    } catch {
      continue;
    }
    const lines = content.trim().split('\n').filter(Boolean);
    const tail = lines.slice(-limitLines);

    for (const line of tail) {
      let row: any;
      try {
        row = JSON.parse(line);
      } catch {
        continue;
      }

      // OpenClaw session JSONL shapes (best-effort)
      if (row.type === 'message' && row.message?.role === 'assistant') {
        const parts = row.message?.content || [];
        const textPart = parts.find((p: any) => p.type === 'text');
        const toolCallPart = parts.find((p: any) => p.type === 'toolCall');

        if (toolCallPart) {
          events.push({
            id: row.id,
            ts: row.timestamp,
            level: 'info',
            type: 'tool.started',
            actor: 'assistant',
            message: `${toolCallPart.name}`,
            data: {
              tool: toolCallPart.name,
              toolCallId: toolCallPart.id,
              input: toolCallPart.arguments ?? toolCallPart.args ?? toolCallPart.input,
            },
          });
        }

        if (textPart?.text) {
          events.push({
            id: row.id,
            ts: row.timestamp,
            level: 'info',
            type: 'task.checkpoint',
            actor: 'assistant',
            message: short(textPart.text),
          });
        }
      }

      if (row.type === 'message' && row.message?.role === 'toolResult') {
        const toolName = row.message?.toolName ?? row.toolName ?? 'toolResult';
        const toolCallId = row.message?.toolCallId ?? row.toolCallId;
        const isError = row.message?.isError ?? row.isError;
        const details = row.message?.details ?? row.details;
        const output = row.message?.result ?? row.message?.content ?? row.message?.output;
        const error = row.message?.error;

        events.push({
          id: row.id,
          ts: row.timestamp,
          level: isError ? 'error' : 'info',
          type: 'tool.finished',
          actor: 'tool',
          message: `${toolName} result`,
          data: {
            tool: toolName,
            toolCallId,
            isError,
            output,
            error,
            details,
          },
        });
      }

      if (row.type === 'model_change') {
        events.push({
          id: row.id,
          ts: row.timestamp,
          level: 'info',
          type: 'service.status',
          actor: 'model',
          message: `model_change ${row.provider}/${row.modelId}`,
        });
      }
    }
  }

  // Dedup by id+type
  const seen = new Set<string>();
  return events.filter((e) => {
    const k = `${e.id}:${e.type}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
