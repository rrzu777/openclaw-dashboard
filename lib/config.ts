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
