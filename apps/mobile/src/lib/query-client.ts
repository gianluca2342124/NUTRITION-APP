import { QueryClient } from '@tanstack/react-query';
import { localDateString } from '@repo/core';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
    mutations: { retry: 0 },
  },
});

/** Today's local calendar date (YYYY-MM-DD). */
export const today = () => localDateString(new Date());
