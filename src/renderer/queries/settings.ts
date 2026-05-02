import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Settings } from '../../types/dbTypes';
import useUIStore from '../stores/uiStore';
import { queryKeys } from './keys';

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
