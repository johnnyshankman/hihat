import { useMutation, useQuery } from '@tanstack/react-query';
import { Track } from '../../types/dbTypes';
import useUIStore from '../stores/uiStore';
import { queryKeys } from './keys';

/**
 * Read album art for a file path.
 *
 * Result is keyed on `filePath` and cached with infinite stale time —
 * album art only changes when metadata is rewritten (which goes through
 * `useUpdateTrackMetadata`, after which the consumer would re-mount with
 * a new key). Several components mounting `useAlbumArt(samePath)` in the
 * same render share one IPC.
 */
export function useAlbumArt(
  filePath: string | null | undefined,
  options: { enabled?: boolean } = {},
) {
  return useQuery<string | null>({
    queryKey: queryKeys.albumArt(filePath ?? ''),
    queryFn: () => window.electron.albumArt.get(filePath as string),
    enabled: options.enabled !== false && Boolean(filePath),
    staleTime: Infinity,
  });
}

/** Download album art for a track to the user's Downloads folder. */
export function useDownloadAlbumArt() {
  return useMutation({
    mutationFn: (track: Track) =>
      window.electron.fileSystem.downloadAlbumArt(track),
    onSuccess: (result) => {
      if (!result.success) {
        useUIStore
          .getState()
          .showNotification(
            result.message ?? 'Failed to download album art',
            'error',
          );
      }
    },
    onError: (err) => {
      console.error('Failed to download album art:', err);
      useUIStore
        .getState()
        .showNotification('Failed to download album art', 'error');
    },
  });
}
