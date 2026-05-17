import { NextResponse } from 'next/server';

interface ApiSuccess<T = unknown> {
  ok: true;
  data: T;
}

interface ApiError {
  ok: false;
  error: string;
  details?: string;
}

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiSuccess<T>> {
  return NextResponse.json({ ok: true, data }, { status });
}

export function apiError(error: string, status = 500, details?: string): NextResponse<ApiError> {
  return NextResponse.json({ ok: false, error, details }, { status });
}
