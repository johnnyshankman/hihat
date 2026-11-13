import { useMutation, useQueryClient } from '@tanstack/react-query';
import useUIStore from '../stores/uiStore';
import { queryKeys } from './keys';

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
