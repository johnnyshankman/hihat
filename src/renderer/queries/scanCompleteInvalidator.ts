import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './keys';

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
 *
 * The outcome itself is shown in the progress panel from the
 * `library:taskEnded` event (see `useLibraryTaskEvents`), not here.
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
    });
  }, [qc, onRefreshed]);
}
