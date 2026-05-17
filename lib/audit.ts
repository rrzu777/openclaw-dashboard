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
