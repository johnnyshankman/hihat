import { useMutation, useQuery } from '@tanstack/react-query';
import useUIStore from '../stores/uiStore';
import { queryKeys } from './keys';

/** Check whether a file exists on disk. */
export function useFileExists(
  filePath: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery<boolean>({
    queryKey: queryKeys.fileExists(filePath ?? ''),
    queryFn: () => window.electron.fileSystem.fileExists(filePath as string),
    enabled: options.enabled !== false && Boolean(filePath),
  });
}

/** Move a file to the trash. */
export function useDeleteFile() {
  return useMutation({
    mutationFn: (filePath: string) =>
      window.electron.fileSystem.deleteFile(filePath),
    onSuccess: (result) => {
      if (!result.success) {
        useUIStore
          .getState()
          .showNotification(result.message ?? 'Failed to delete file', 'error');
      }
    },
    onError: (err) => {
      console.error('Failed to delete file:', err);
      useUIStore.getState().showNotification('Failed to delete file', 'error');
    },
  });
}
