import fs from 'fs/promises';
import path from 'path';
import { ActivityEvent } from './types';
import { SESSIONS_DIR } from './constants';

export async function getRecentActivity(limit = 50): Promise<ActivityEvent[]> {
  try {
    const files = await fs.readdir(SESSIONS_DIR);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    const fileStats = await Promise.all(jsonlFiles.map(async filename => {
      const stats = await fs.stat(path.join(SESSIONS_DIR, filename));
      return { filename, mtime: stats.mtimeMs };
    }));

    const recentFiles = fileStats
      .sort((a, b) => b.mtime - a.mtime)
      .slice(0, 5);

    let activities: ActivityEvent[] = [];

    for (const { filename } of recentFiles) {
      const sessionId = filename.replace('.jsonl', '');
      const filePath = path.join(SESSIONS_DIR, filename);
      
      try {
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.trim().split('\n').slice(-50);
        
        lines.forEach((line, idx) => {
          try {
            if (!line.trim()) return;
            const data = JSON.parse(line);
            const events = parseEvent(data, sessionId, idx);
            if (events) activities.push(...events);
          } catch (e) {
            // Skip
          }
        });
      } catch (err) {
        // Skip
      }
    }

    return activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

  } catch (error) {
    console.error("Error reading sessions:", error);
    return [];
  }
}

function parseEvent(data: any, sessionId: string, idx: number): ActivityEvent[] | null {
  const timestamp = data.timestamp || new Date().toISOString();
  const baseId = `${sessionId}-${idx}`;
  const events: ActivityEvent[] = [];

  const add = (type: ActivityEvent['type'], summary: string, details?: any, suffix = '') => {
    events.push({
      id: baseId + suffix,
      timestamp,
      type,
      summary,
      details,
      sessionId
    });
  };

  if (data.type === 'tool' || data.tool) {
    add('tool', `Tool: ${data.tool || data.name}`, data.input || data.arguments);
    return events;
  }

  if (data.type === 'message' && data.message) {
    const msg = data.message;
    const role = msg.role;

    if (Array.isArray(msg.content)) {
      msg.content.forEach((block: any, i: number) => {
        if (block.type === 'text') {
           const text = block.text?.trim();
           if (text) add('message', `${role}: ${text.substring(0, 60)}${text.length > 60 ? '...' : ''}`, text, `-txt-${i}`);
        }
        else if (block.type === 'toolCall') {
           add('tool', `Call: ${block.name}`, block.arguments, `-tool-${i}`);
        }
        else if (block.type === 'thinking') {
           add('thinking', 'Thinking...', block.thinking, `-think-${i}`);
        }
      });
    } 
    else if (typeof msg.content === 'string') {
      add('message', `${role}: ${msg.content.substring(0, 60)}...`, msg.content);
    }
  }

  if (data.level === 'error' || data.error) {
    add('error', `Error: ${data.error}`);
  }

  return events.length > 0 ? events : null;
}
