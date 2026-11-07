import { execSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface LocalStack {
  url: string;
  anonKey: string;
  serviceKey: string;
}

let cached: LocalStack | null = null;

/**
 * Connection details for the local Supabase stack (`pnpm db:start`).
 * Env vars take precedence so the suite can also target a disposable project.
 */
export function localStack(): LocalStack {
  if (cached) return cached;
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    cached = {
      url: process.env.SUPABASE_URL,
      anonKey: process.env.SUPABASE_ANON_KEY,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
    return cached;
  }
  const raw = execSync('npx supabase status -o json', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  const status = JSON.parse(raw.slice(raw.indexOf('{'))) as Record<string, string>;
  cached = { url: status.API_URL!, anonKey: status.ANON_KEY!, serviceKey: status.SERVICE_ROLE_KEY! };
  return cached;
}

export function anonClient(): SupabaseClient {
  const { url, anonKey } = localStack();
  return createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function serviceClient(): SupabaseClient {
  const { url, serviceKey } = localStack();
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function newAnonymousUser(): Promise<{ client: SupabaseClient; userId: string }> {
  const client = anonClient();
  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user) throw error ?? new Error('anonymous sign-in failed');
  return { client, userId: data.user.id };
}

export async function deleteUser(userId: string): Promise<void> {
  await serviceClient().auth.admin.deleteUser(userId);
}
