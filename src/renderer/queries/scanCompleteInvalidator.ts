import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import useUIStore from '../stores/uiStore';
import type { ScanCompletePayload } from '../../types/ipc';
import { queryKeys } from './keys';

function completionMessage(data: ScanCompletePayload): string {
  const added = data.tracksAdded || 0;
  if (data.kind === 'import') {
    return added > 0
      ? `Imported ${added} new song${added !== 1 ? 's' : ''}`
      : 'Import finished: no new songs';
  }
  const removed = data.tracksRemoved || 0;
  const parts: string[] = [];
  if (added > 0)
    parts.push(`${added} new track${added !== 1 ? 's' : ''} added`);
  if (removed > 0)
    parts.push(`${removed} stale track${removed !== 1 ? 's' : ''} removed`);
  return `Library scan completed: ${
    parts.length > 0 ? parts.join(', ') : 'no changes'
  }`;
}

/**
 * Bridge between the main-process `library:scanComplete` push event and
 * the TanStack Query cache. Mount once at App level (in `ThemedApp`).
 *
 * A scan or import holds back track list refreshes while it runs (see
 * `refreshAfterTrackMutation`), so this is the one place the library
 * the user sees catches up, in a single batch:
 *
 * - Refetches the `tracks` and `playlists` queries and waits for them.
 * - Then calls `onRefreshed`, which App uses to reconcile playback with
 *   the new library (a playing song that no longer exists stops, and the
 *   preloaded next-up song is recomputed). Passed in rather than imported
 *   because the playback store already depends on this module's barrel.
 * - Surfaces one user-facing notification with the outcome.
 */
export function useScanCompleteInvalidator(onRefreshed: () => void): void {
  const qc = useQueryClient();
  useEffect(() => {
    return window.electron.library.onScanComplete(async (data) => {
      // A failed scan is reported in the progress panel (or inline on the
      // welcome screen) from its `library:taskEnded` event.
      if (data.error) {
        console.warn(`Library scan failed: ${data.error}`);
        return;
      }

      await Promise.all([
        qc.invalidateQueries({ queryKey: queryKeys.tracks }),
        qc.invalidateQueries({ queryKey: queryKeys.playlists }),
      ]);
      onRefreshed();

      const message = completionMessage(data);
      console.warn(message);
      useUIStore.getState().showNotification(message, 'success');
    });
  }, [qc, onRefreshed]);
}
