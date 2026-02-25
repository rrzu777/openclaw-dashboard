// API Routes configuration
export const API_ROUTES = {
  cron: '/api/cron',
  usage: '/api/usage',
  panic: '/api/panic',
  events: '/api/events',
  feed: '/api/feed',
  search: '/api/search',
} as const;

// App configuration
export const APP_CONFIG = {
  name: 'OpenClaw Dashboard',
  version: '1.0.0',
} as const;
