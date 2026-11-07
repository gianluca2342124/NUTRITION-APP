import { ApiError } from '@repo/core';
import type { Messages } from '@repo/i18n';

/** User-facing message for any error, never exposing internals. */
export function errorMessage(error: unknown, t: Messages): string {
  if (error instanceof ApiError) {
    switch (error.code) {
      case 'network':
        return t.errors.network;
      case 'unauthorized':
        return t.errors.unauthorized;
      case 'ai_not_configured':
        return t.scan.aiUnavailable;
      case 'quota_exceeded':
        return t.scan.quotaExceeded;
      case 'rate_limited':
        return t.errors.rateLimited;
      case 'upstream_unavailable':
        return t.errors.serviceUnavailable;
      case 'ai_failed':
      case 'invalid_input':
      case 'forbidden':
      case 'not_found':
        return error.message || t.errors.generic;
      default:
        return t.errors.generic;
    }
  }
  if (error instanceof Error && /network|fetch/i.test(error.message)) return t.errors.network;
  return t.errors.generic;
}
