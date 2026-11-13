import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Track } from '../../types/dbTypes';
import { buildIndexes, TrackIndexes } from '../utils/trackIndexes';
import useUIStore from '../stores/uiStore';
import { isLibraryWriteRunning } from '../stores/libraryTaskStore';
import { queryClient } from './client';
import { queryKeys } from './keys';

export interface TracksData {
  tracks: Track[];
  indexes: TrackIndexes;
}

/**
 * Non-hook snapshot of the tracks cache. Use only from non-React code
 * paths (utility modules, callbacks fired from outside the React tree)
 * — components should call `useTracks()` so they re-render when the
 * cache changes.
 *
 * Returns `undefined` (rather than an empty `TracksData`) on purpose so
 * callers can later differentiate "cache hasn't loaded yet" from
 * "loaded, library is empty" if a use case ever needs that distinction.
 * Today every consumer just does `?.tracks ?? []`.
 */
export function getTracksSnapshot(): TracksData | undefined {
  return queryClient.getQueryData<TracksData>(queryKeys.tracks);
}

/**
 * Read all tracks. Indexes are computed inside the queryFn so every
 * consumer shares one set of Maps.
 */
export function useTracks() {
  return useQuery<TracksData>({
    queryKey: queryKeys.tracks,
    queryFn: async () => {
      const tracks = await window.electron.tracks.getAll();
      // Coerce duration to number — sql.js can return strings for some
      // numeric columns depending on the column type declaration.
      const processed: Track[] = tracks.map((t: Track) => ({
        ...t,
        duration:
          typeof t.duration === 'number' ? t.duration : Number(t.duration ?? 0),
      }));
      return { tracks: processed, indexes: buildIndexes(processed) };
    },
  });
}

/**
 * O(1) track lookup via the cached index. Falls back to undefined if
 * the tracks query hasn't loaded yet.
 */
export function useTrack(id: string | null | undefined): Track | undefined {
  const { data } = useTracks();
  if (!id || !data) return undefined;
  return data.indexes.trackIndex.get(id);
}

/**
 * Reflect a track mutation in the cache. Normally that's a refetch, but
 * while a scan or import is writing to the database a refetch would show
 * its half-finished library. Then patch just the affected rows and let
 * the task's completion refresh everything at once.
 */
function refreshAfterTrackMutation(
  qc: QueryClient,
  patch: (tracks: Track[]) => Track[],
): void {
  if (!isLibraryWriteRunning()) {
    qc.invalidateQueries({ queryKey: queryKeys.tracks });
    return;
  }
  qc.setQueryData<TracksData>(queryKeys.tracks, (old) => {
    if (!old) return old;
    const tracks = patch(old.tracks);
    return { tracks, indexes: buildIndexes(tracks) };
  });
}

export function useUpdateTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (track: Track) => window.electron.tracks.update(track),
    onSuccess: (_result, track) =>
      refreshAfterTrackMutation(qc, (tracks) =>
        tracks.map((t) => (t.id === track.id ? track : t)),
      ),
    onError: (err) => {
      console.error('Failed to update track:', err);
      useUIStore.getState().showNotification('Failed to update track', 'error');
    },
  });
}

export function useUpdateTrackMetadata() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      metadata,
    }: {
      id: string;
      metadata: Parameters<typeof window.electron.tracks.updateMetadata>[1];
    }) => window.electron.tracks.updateMetadata(id, metadata),
    onSuccess: (_result, { id, metadata }) =>
      refreshAfterTrackMutation(qc, (tracks) =>
        tracks.map((t) => (t.id === id ? { ...t, ...metadata } : t)),
      ),
    onError: (err) => {
      console.error('Failed to update track metadata:', err);
      useUIStore
        .getState()
        .showNotification('Failed to update track metadata', 'error');
    },
  });
}

export function useUpdatePlayCount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, date }: { id: string; date: string }) =>
      window.electron.tracks.updatePlayCount(id, date),
    onSuccess: (_result, { id, date }) =>
      refreshAfterTrackMutation(qc, (tracks) =>
        tracks.map((t) =>
          t.id === id
            ? { ...t, playCount: t.playCount + 1, lastPlayed: date }
            : t,
        ),
      ),
    // No notification on failure — play count is a background bookkeeping
    // operation; failure shouldn't interrupt the user with a toast.
    onError: (err) => console.error('Failed to update play count:', err),
  });
}

export function useDeleteTrack() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => window.electron.tracks.delete(id),
    onSuccess: (_result, id) => {
      refreshAfterTrackMutation(qc, (tracks) =>
        tracks.filter((t) => t.id !== id),
      );
      // Track deletions can also affect playlist track lists.
      qc.invalidateQueries({ queryKey: queryKeys.playlists });
    },
    onError: (err) => {
      console.error('Failed to delete track:', err);
      useUIStore.getState().showNotification('Failed to delete track', 'error');
    },
  });
}
