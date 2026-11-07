import type { ApiErrorCode } from '@repo/core';

export class ApiFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiFailure';
  }
}

export function json(data: unknown, init: ResponseInit & { cacheSeconds?: number } = {}): Response {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  if (init.cacheSeconds) {
    headers.set('Cache-Control', `public, max-age=${init.cacheSeconds}, stale-while-revalidate=${init.cacheSeconds * 4}`);
  } else if (!headers.has('Cache-Control')) {
    headers.set('Cache-Control', 'no-store');
  }
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof ApiFailure) {
    return json({ error: { code: error.code, message: error.message } }, { status: error.status });
  }
  console.error('[api] unexpected error', error);
  return json({ error: { code: 'internal', message: 'Unexpected server error.' } }, { status: 500 });
}

/** Wraps a route handler so thrown ApiFailures become typed JSON errors. */
export function handler<Args extends unknown[]>(fn: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}

/* ------------------------------ rate limiting ----------------------------- */

const windows = new Map<string, { count: number; resetAt: number }>();

/**
 * Fixed-window, per-instance limiter for public endpoints. Best effort only:
 * with several instances the effective limit is multiplied. AI endpoints use
 * the database-backed quotas in quota.ts instead.
 */
export function rateLimit(request: Request, bucket: string, limitPerMinute: number): void {
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const w = windows.get(key);
  if (!w || w.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + 60_000 });
    if (windows.size > 10_000) {
      for (const [k, v] of windows) if (v.resetAt <= now) windows.delete(k);
    }
    return;
  }
  w.count += 1;
  if (w.count > limitPerMinute) throw new ApiFailure(429, 'rate_limited', 'Too many requests. Try again in a minute.');
}

export function preferredLocale(request: Request): 'es' | 'en' {
  const header = (request.headers.get('accept-language') ?? '').toLowerCase();
  return header.startsWith('en') ? 'en' : 'es';
}
