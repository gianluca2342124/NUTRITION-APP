/**
 * Public runtime configuration (inlined by Expo at build time).
 * Only public values belong here — never secrets.
 */
export const env = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  /** Origin of the web app that serves /api/v1 (e.g. http://192.168.1.20:3000 in development). */
  apiUrl: (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, ''),
};

export const backendConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey && env.apiUrl);
