export interface ActivityEvent {
  id: string;
  timestamp: string;
  type: 'tool' | 'error' | 'message' | 'system' | 'thinking';
  summary: string;
  details?: any;
  sessionId: string;
  icon?: string;
}

export interface CronJob {
  id: string;
  name: string;
  schedule: string; // Cron expression or "Every X ms"
  nextRun: string | null;
  lastRun: string | null;
  status: 'active' | 'disabled' | 'system';
  command?: string;
}
