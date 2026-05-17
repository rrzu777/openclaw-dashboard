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

export function rateLimitDestructive(request: Request): NextResponse | null {
  return rateLimit(request, { maxRequests: RATE_LIMIT_DESTRUCTIVE_MAX, windowMs: RATE_LIMIT_WINDOW_MS, bucket: 'destructive' });
}
