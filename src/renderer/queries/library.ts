import { useMutation, useQueryClient } from '@tanstack/react-query';
import useUIStore from '../stores/uiStore';
import { queryKeys } from './keys';

/**
 * Trigger a full library scan. The scan-complete push event also
 * invalidates the cache (see useScanCompleteInvalidator), so this
 * mutation only needs to surface loading/error state to the caller.
 */
export function useScanLibrary() {
  return useMutation({
    mutationFn: (libraryPath: string) =>
      window.electron.library.scan(libraryPath),
    onError: (err) => {
      console.error('Failed to scan library:', err);
      useUIStore.getState().showNotification('Failed to scan library', 'error');
    },
  });
}

/** Import specific files into the library. */
export function useImportFiles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: string[]) => window.electron.library.import(files),
    onSuccess: (result, files) => {
      qc.invalidateQueries({ queryKey: queryKeys.tracks });
      qc.invalidateQueries({ queryKey: queryKeys.playlists });
      const fileNoun = files.length === 1 ? 'file' : 'files';
      useUIStore
        .getState()
        .showNotification(
          result.success
            ? `Imported ${result.tracksAdded} of ${files.length} ${fileNoun}`
            : result.message,
          result.success ? 'success' : 'error',
        );
    },
    onError: (err) => {
      console.error('Failed to import files:', err);
      useUIStore.getState().showNotification('Failed to import files', 'error');
    },
  });
}

export function useBackupLibrary() {
  return useMutation({
    mutationFn: (backupPath: string) =>
      window.electron.library.backup(backupPath),
    onError: (err) => {
      console.error('Failed to back up library:', err);
      useUIStore
        .getState()
        .showNotification('Failed to back up library', 'error');
    },
  });
}

export function useRestoreLibrary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (restorePath: string) =>
      window.electron.library.restore(restorePath),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tracks });
      qc.invalidateQueries({ queryKey: queryKeys.playlists });
      qc.invalidateQueries({ queryKey: queryKeys.settings });
    },
    onError: (err) => {
      console.error('Failed to restore library:', err);
      useUIStore
        .getState()
        .showNotification('Failed to restore library', 'error');
    },
  });
}

export function useResetDatabase() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => window.electron.library.resetDatabase(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tracks });
      qc.invalidateQueries({ queryKey: queryKeys.playlists });
      qc.invalidateQueries({ queryKey: queryKeys.settings });
    },
    onError: (err) => console.error('Failed to reset database:', err),
  });
}

export function useResetTracks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => window.electron.library.resetTracks(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.tracks });
      qc.invalidateQueries({ queryKey: queryKeys.playlists });
    },
    onError: (err) => console.error('Failed to reset tracks:', err),
  });
}
