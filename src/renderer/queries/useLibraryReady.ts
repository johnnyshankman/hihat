import { useTracks } from './tracks';
import { usePlaylists } from './playlists';

/**
 * Aggregate loading/error state across the two cache-warming queries
 * the renderer needs before it can show meaningful UI: tracks and
 * playlists. Used by `MainLayout` to gate the loading splash.
 *
 * `isLoading` is true while either query is still on its initial fetch.
 * `isError` flips when either query errored; `error` carries whichever
 * one fired first so the user gets a concrete message.
 *
 * Note: We do not wait for settings because the main process gurantees
 * the renderer process window is not shown until settings are loaded
 */
export function useLibraryReady(): {
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
} {
  const tracks = useTracks();
  const playlists = usePlaylists();
  return {
    isLoading: tracks.isLoading || playlists.isLoading,
    isError: tracks.isError || playlists.isError,
    error: (tracks.error ?? playlists.error) as Error | null,
  };
}
