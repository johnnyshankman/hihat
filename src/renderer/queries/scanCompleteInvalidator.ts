import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

/**
 * Bridge between the main-process `library:scanComplete` push event and
 * the TanStack Query cache. Mount once at App level (in `ThemedApp`).
 *
 * Phase 4 scope: only invalidate the cache. `bootstrapLibraryStore`'s
 * existing scanComplete listener still owns the user-facing notification
 * and the legacy Zustand refetch. Phase 5a removes that listener and
 * folds the notification into this hook.
 */
export function useScanCompleteInvalidator(): void {
  const qc = useQueryClient();
  useEffect(() => {
    return window.electron.library.onScanComplete((data) => {
      if (data.error) return;
      qc.invalidateQueries({ queryKey: queryKeys.tracks });
      qc.invalidateQueries({ queryKey: queryKeys.playlists });
    });
  }, [qc]);
}
