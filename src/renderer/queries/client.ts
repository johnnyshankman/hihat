import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton QueryClient for the main renderer.
 *
 * Defaults are tuned for local IPC (not remote HTTP):
 *   - `staleTime: Infinity` — local IPC data only changes via mutations or
 *     the `library:scanComplete` push event, which explicitly invalidate.
 *     There is no third-party server we'd be racing against.
 *   - `gcTime: Infinity` — keep cache warm for the lifetime of the renderer.
 *   - `retry: false` — local IPC is sub-millisecond and doesn't fail
 *     transiently. A failure means a real error to surface.
 *   - `refetchOnWindowFocus: false` — Electron app, not a web tab. Tab
 *     focus shouldn't drive refetches.
 *
 * The miniPlayer renderer does NOT mount a `QueryClientProvider` — it
 * receives state via push events (`miniPlayer:trackChanged` etc.) and
 * doesn't query the DB. Only the main window has a cache.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      gcTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
});
