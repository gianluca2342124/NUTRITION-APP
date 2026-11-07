import { createApiClient, type ApiClient } from '@repo/core';
import { env } from './env';
import { currentLocale } from './i18n';
import { supabase } from './supabase';

let api: ApiClient | null = null;

/** Typed client for the platform API (served by the web app). */
export function apiClient(): ApiClient {
  if (!api) {
    api = createApiClient({
      baseUrl: env.apiUrl,
      getAccessToken: async () => {
        try {
          const { data } = await supabase().auth.getSession();
          return data.session?.access_token ?? null;
        } catch {
          return null;
        }
      },
      locale: currentLocale,
    });
  }
  return api;
}
