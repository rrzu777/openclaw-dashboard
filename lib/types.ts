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
  data?: any;
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
