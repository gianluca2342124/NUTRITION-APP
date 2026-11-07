import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const r = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          include: ['packages/*/src/**/*.test.ts', 'apps/web/src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        resolve: {
          alias: {
            '@': r('./apps/web/src'),
            'server-only': r('./supabase/tests/server-only-stub.ts'),
          },
        },
        test: {
          name: 'db',
          include: ['supabase/tests/**/*.test.ts'],
          environment: 'node',
          // Integration tests share one local database; run files sequentially.
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
