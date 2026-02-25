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

export interface GatewayStatus {
  running: boolean;
  pid?: number;
  uptime?: string;
  version?: string;
  lastChecked: string;
}

export type GatewayAction = 'start' | 'stop' | 'restart' | 'logs';
