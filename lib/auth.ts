import { NextResponse } from 'next/server';
import crypto from 'crypto';

/**
 * API key authentication for destructive endpoints.
 *
 * Set OPENCLAW_DASHBOARD_API_KEY in your environment.
 * If not set, a random key is generated at startup and logged to the console.
 *
 * Clients must send the header:  X-API-Key: <key>
 */

let _generatedKey: string | null = null;

function getApiKey(): string {
  const envKey = process.env.OPENCLAW_DASHBOARD_API_KEY;
  if (envKey) return envKey;

  // Generate a stable key per process lifetime so it stays usable across requests
  if (!_generatedKey) {
    _generatedKey = crypto.randomBytes(32).toString('hex');
    console.warn(
      `[auth] No OPENCLAW_DASHBOARD_API_KEY set. Generated ephemeral key: ${_generatedKey}`
    );
  }
  return _generatedKey;
}

/**
 * Validates the X-API-Key header against the configured API key.
 * Returns null if valid, or a 401 NextResponse if invalid.
 */
export function requireAuth(request: Request): NextResponse | null {
  const provided = request.headers.get('X-API-Key');
  const expected = getApiKey();

  if (!provided || !crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected))) {
    return NextResponse.json(
      { error: 'Unauthorized. Provide a valid X-API-Key header.' },
      { status: 401 }
    );
  }

  return null; // auth passed
}
