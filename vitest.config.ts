import { defineConfig } from 'vitest/config';

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
