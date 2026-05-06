import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Settings } from '../../types/dbTypes';
import useUIStore from '../stores/uiStore';
import { queryClient } from './client';
import { queryKeys } from './keys';

/**
 * Stable default `columns` visibility map for components that render
 * before the settings query resolves. Matches the in-memory initial
 * state the Zustand `settingsAndPlaybackStore` used to ship with so
 * cold-render visibility looks identical pre/post-refactor.
 */
export const DEFAULT_COLUMNS: Settings['columns'] = {
  title: true,
  artist: true,
  album: true,
  albumArtist: true,
  genre: true,
  duration: true,
  playCount: true,
  dateAdded: true,
  lastPlayed: false,
};

/**
 * Non-hook snapshot of the settings cache. Use only from non-React
 * code paths (utility modules, callbacks fired from outside the React
 * tree, store actions) — components should call `useSettings()` so
 * they re-render when the cache changes.
 *
 * Returns `undefined` (rather than a default Settings object) on
 * purpose so callers can later differentiate "cache hasn't loaded
 * yet" from "loaded, here's the data" if a use case ever needs that
 * distinction. Today every consumer falls back to a stable default
 * when the cache hasn't warmed.
 */
export function getSettingsSnapshot(): Settings | undefined {
  return queryClient.getQueryData<Settings>(queryKeys.settings);
}

/** Read the application settings. */
export function useSettings() {
  return useQuery<Settings>({
    queryKey: queryKeys.settings,
    queryFn: () => window.electron.settings.get(),
  });
}

/**
 * Update settings via partial-merge.
 *
 * The IPC contract accepts `Partial<Settings>` and merges on the main side
 * (see settings:update handler), so concurrent writes to different fields
 * no longer race. Optimistic update mirrors the merge in the cache; if the
 * persist fails, we restore the previous state.
 */
export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partial: Partial<Settings>) =>
      window.electron.settings.update(partial),
    onMutate: async (partial) => {
      await qc.cancelQueries({ queryKey: queryKeys.settings });
      const prev = qc.getQueryData<Settings>(queryKeys.settings);
      qc.setQueryData<Settings>(queryKeys.settings, (old) =>
        old ? { ...old, ...partial } : old,
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.settings, ctx.prev);
      console.error('Failed to update settings:', err);
      useUIStore
        .getState()
        .showNotification('Failed to update settings', 'error');
    },
    // No invalidate — the optimistic merge is authoritative for what we
    // just wrote, and there are no side effects that would change other
    // settings fields. Skipping the refetch avoids unnecessary IPC churn
    // for high-frequency setters (volume, lastPlayedSongId).
  });
}
