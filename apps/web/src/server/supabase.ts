import 'server-only';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import { env } from './env';
import { ApiFailure } from './http';

const NO_SESSION = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } } as const;

let service: SupabaseClient | null = null;
let anon: SupabaseClient | null = null;

function requireConfig() {
  const e = env();
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new ApiFailure(503, 'upstream_unavailable', 'Database is not configured (set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  }
  return e;
}

/** Privileged client (bypasses RLS). Only for catalogue writes, quotas and account deletion. */
export function serviceClient(): SupabaseClient {
  const e = requireConfig();
  if (!e.SUPABASE_SERVICE_ROLE_KEY) {
    throw new ApiFailure(503, 'upstream_unavailable', 'SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }
  service ??= createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.SUPABASE_SERVICE_ROLE_KEY, NO_SESSION);
  return service;
}

/** Public client (RLS as anonymous visitor) for catalogue reads. */
export function publicClient(): SupabaseClient {
  const e = requireConfig();
  anon ??= createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, NO_SESSION);
  return anon;
}

/** Client acting as the signed-in user (RLS applies). */
export function userClient(accessToken: string): SupabaseClient {
  const e = requireConfig();
  return createClient(e.NEXT_PUBLIC_SUPABASE_URL!, e.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    ...NO_SESSION,
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

export interface AuthContext {
  user: User;
  token: string;
}

/** Validates the bearer token with Supabase Auth. Throws 401 when missing/invalid. */
export async function requireUser(request: Request): Promise<AuthContext> {
  const header = request.headers.get('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!token) throw new ApiFailure(401, 'unauthorized', 'Sign-in required.');
  const { data, error } = await publicClient().auth.getUser(token);
  if (error || !data.user) throw new ApiFailure(401, 'unauthorized', 'Session expired or invalid.');
  return { user: data.user, token };
}
