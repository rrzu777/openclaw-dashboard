import { NextResponse } from 'next/server';
import crypto from 'crypto';
import fs from 'fs';
import { AUTH_KEY_FILE, DATA_DIR } from '@/lib/constants';

let _cachedKey: string | null = null;

function getApiKey(): string {
  const envKey = process.env.OPENCLAW_DASHBOARD_API_KEY;
  if (envKey) return envKey;

  if (_cachedKey) return _cachedKey;

  // Try to read persisted key
  try {
    _cachedKey = fs.readFileSync(AUTH_KEY_FILE, 'utf-8').trim();
    if (_cachedKey) return _cachedKey;
  } catch {
    // File doesn't exist yet
  }

  // Generate and persist
  _cachedKey = crypto.randomBytes(32).toString('hex');
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(AUTH_KEY_FILE, _cachedKey, { mode: 0o600 });
    console.warn('[auth] Generated and persisted API key to', AUTH_KEY_FILE);
  } catch (err) {
    console.warn('[auth] Could not persist API key:', err);
  }

  return _cachedKey;
}

export function requireAuth(request: Request): NextResponse | null {
  const provided = request.headers.get('X-API-Key');
  const expected = getApiKey();

  if (!provided || provided.length !== expected.length) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid X-API-Key header.' },
      { status: 401 }
    );
  }

  if (!crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid X-API-Key header.' },
      { status: 401 }
    );
  }

  return null;
}
