import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useUIStore from '../stores/uiStore';
import { queryKeys } from './keys';

/**
 * Bridge between the main-process `library:scanComplete` push event and
 * the TanStack Query cache. Mount once at App level (in `ThemedApp`).
 *
 * - Invalidates the `tracks` and `playlists` queries so any mounted
 *   hook refetches the new state.
 * - Surfaces a user-facing notification with adds/removes (or the
 *   error message if the scan failed).
 */
export function useScanCompleteInvalidator(): void {
  const qc = useQueryClient();
  useEffect(() => {
    return window.electron.library.onScanComplete((data) => {
      if (data.error) {
        console.warn(`Library scan failed: ${data.error}`);
        useUIStore.getState().showNotification(data.error, 'error');
        return;
      }

      qc.invalidateQueries({ queryKey: queryKeys.tracks });
      qc.invalidateQueries({ queryKey: queryKeys.playlists });

      const added = data.tracksAdded || 0;
      const removed = data.tracksRemoved || 0;
      const parts: string[] = [];
      if (added > 0)
        parts.push(`${added} new track${added !== 1 ? 's' : ''} added`);
      if (removed > 0)
        parts.push(`${removed} stale track${removed !== 1 ? 's' : ''} removed`);
      const message = `Library scan completed: ${
        parts.length > 0 ? parts.join(', ') : 'no changes'
      }`;
      console.warn(message);
      useUIStore.getState().showNotification(message, 'success');
    });
  }, [qc]);
}
