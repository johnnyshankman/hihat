import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queries/keys';
import useUIStore from '../stores/uiStore';
import useLibraryTaskStore from '../stores/libraryTaskStore';
import useSettingsAndPlaybackStore from '../stores/settingsAndPlaybackStore';
import type { DatabaseRecovery, LibraryTaskEnded } from '../../types/ipc';

function plural(count: number, noun: string): string {
  return `${count.toLocaleString()} ${noun}${count === 1 ? '' : 's'}`;
}

/** One-line summary for the progress panel's done state. */
function doneMessage(result: LibraryTaskEnded): string {
  const added = result.tracksAdded ?? 0;
  const removed = result.tracksRemoved ?? 0;
  if (result.kind === 'backup') return 'Your library is backed up.';
  if (result.kind === 'import') {
    return added > 0 ? `Added ${plural(added, 'song')}.` : 'No new songs.';
  }
  const parts: string[] = [];
  if (added > 0) parts.push(`${plural(added, 'song')} added`);
  if (removed > 0) parts.push(`${plural(removed, 'song')} removed`);
  return parts.length > 0 ? `${parts.join(', ')}.` : 'No changes.';
}

function notifyDatabaseRecovery(recovery: DatabaseRecovery): void {
  const { showNotification } = useUIStore.getState();
  if (recovery.outcome === 'restoredFromBackup') {
    showNotification(
      "hihat couldn't read its library database and restored the copy saved when it last opened. Changes made since then may be missing.",
      'warning',
    );
  } else {
    showNotification(
      `hihat couldn't read its library database and started a fresh one. The unreadable file was kept at ${recovery.corruptCopyPath}.`,
      'error',
    );
  }
}

/**
 * Mirror the main process's library task (rescan, import, backup) into
 * `libraryTaskStore`. Mount once at App level. On mount it also asks the
 * main process for the current state, so a reloaded or crashed-and-
 * reloaded renderer picks a running task back up, and learns about a
 * task the previous run never finished or a database recovery.
 */
export default function useLibraryTaskEvents(): void {
  const qc = useQueryClient();

  useEffect(() => {
    const tasks = useLibraryTaskStore.getState;
    const { showNotification } = useUIStore.getState();

    const unsubscribers = [
      window.electron.library.onTaskStarted((task) => {
        tasks().taskStarted(task);
      }),

      window.electron.library.onScanProgress((data) => {
        tasks().progress({ processed: data.processed, total: data.total });
      }),

      window.electron.backup.onProgress((data) => {
        if (data.phase === 'transferring') {
          tasks().progress({
            processed: data.currentTransfer ?? 0,
            total: data.total ?? 0,
            currentFile: data.currentFile || undefined,
            status: data.status,
          });
        } else {
          tasks().progress({ processed: 0, total: 0, status: data.status });
        }
      }),

      window.electron.library.onTaskEnded(async (result) => {
        // A scan or import that failed partway never sent scanComplete,
        // but it may have added songs before failing. Catch the library
        // up once, the same way completion does.
        if (result.kind !== 'backup' && result.outcome === 'error') {
          await Promise.all([
            qc.invalidateQueries({ queryKey: queryKeys.tracks }),
            qc.invalidateQueries({ queryKey: queryKeys.playlists }),
          ]);
          useSettingsAndPlaybackStore.getState().reconcileWithLibrary();
        }
        tasks().taskEnded(result, doneMessage(result));
      }),

      window.electron.backup.onSuccess(() => {
        showNotification('Library backup completed successfully', 'success');
      }),

      window.electron.backup.onError((message) => {
        // A backup that started and failed is shown in the panel; this
        // only covers one refused before it began.
        if (tasks().task?.phase === 'error') return;
        showNotification(`Backup failed: ${message}`, 'error');
      }),
    ];

    window.electron.library
      .getTaskState()
      .then((state) => {
        if (state.active) tasks().taskStarted(state.active);
        tasks().setInterrupted(state.interrupted);
        if (state.databaseRecovery) {
          notifyDatabaseRecovery(state.databaseRecovery);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        console.error('Error reading library task state:', error);
      });

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [qc]);
}
