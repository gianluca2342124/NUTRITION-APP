import * as Crypto from 'expo-crypto';

/** RFC 4122 v4 UUID — used as client-generated ids so saves are idempotent. */
export function uuid(): string {
  return Crypto.randomUUID();
}
