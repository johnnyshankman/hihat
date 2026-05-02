import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Playlist, Track } from '../../types/dbTypes';
import useUIStore from '../stores/uiStore';
import { queryKeys } from './keys';

/** Read all playlists. */
export function usePlaylists() {
  return useQuery<Playlist[]>({
    queryKey: queryKeys.playlists,
    queryFn: () => window.electron.playlists.getAll(),
  });
}

/**
 * Get a single playlist by id from the cached `usePlaylists` data.
 * Returns undefined if the playlists query hasn't loaded yet.
 */
export function usePlaylist(
  id: string | null | undefined,
): Playlist | undefined {
  const { data } = usePlaylists();
  if (!id || !data) return undefined;
  return data.find((p) => p.id === id);
}

/** Read tracks matching a smart-playlist rule set. */
export function useSmartPlaylistTracks(
  ruleSet: Playlist['ruleSet'],
  options: { enabled?: boolean } = {},
) {
  return useQuery<Track[]>({
    queryKey: queryKeys.smartPlaylistTracks(ruleSet),
    queryFn: () => window.electron.playlists.getSmartTracks(ruleSet),
    enabled: options.enabled !== false && ruleSet !== null,
  });
}

export function useCreatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlist: Omit<Playlist, 'id'>) =>
      window.electron.playlists.create(playlist),
    // Append the newly-created playlist (server returns it with its id).
    onSuccess: (created) => {
      qc.setQueryData<Playlist[]>(queryKeys.playlists, (old) =>
        old ? [...old, created] : [created],
      );
      useUIStore
        .getState()
        .showNotification(`Playlist "${created.name}" created`, 'success');
    },
    onError: (err) => {
      console.error('Failed to create playlist:', err);
      useUIStore
        .getState()
        .showNotification('Failed to create playlist', 'error');
    },
  });
}

export function useUpdatePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (playlist: Playlist) =>
      window.electron.playlists.update(playlist),
    onMutate: async (updated) => {
      await qc.cancelQueries({ queryKey: queryKeys.playlists });
      const prev = qc.getQueryData<Playlist[]>(queryKeys.playlists);
      qc.setQueryData<Playlist[]>(queryKeys.playlists, (old) =>
        old ? old.map((p) => (p.id === updated.id ? updated : p)) : old,
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.playlists, ctx.prev);
      console.error('Failed to update playlist:', err);
      useUIStore
        .getState()
        .showNotification('Failed to update playlist', 'error');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.playlists }),
  });
}

export function useDeletePlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => window.electron.playlists.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: queryKeys.playlists });
      const prev = qc.getQueryData<Playlist[]>(queryKeys.playlists);
      qc.setQueryData<Playlist[]>(queryKeys.playlists, (old) =>
        old ? old.filter((p) => p.id !== id) : old,
      );
      return { prev };
    },
    onSuccess: (_data, id) => {
      const name = qc
        .getQueryData<Playlist[]>(queryKeys.playlists)
        ?.find((p) => p.id === id)?.name;
      useUIStore
        .getState()
        .showNotification(`Playlist "${name ?? id}" deleted`, 'success');
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.playlists, ctx.prev);
      console.error('Failed to delete playlist:', err);
      useUIStore
        .getState()
        .showNotification('Failed to delete playlist', 'error');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.playlists }),
  });
}

export function useAddTrackToPlaylist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      trackId,
      playlistId,
    }: {
      trackId: string;
      playlistId: string;
    }) => {
      const playlists = qc.getQueryData<Playlist[]>(queryKeys.playlists);
      const playlist = playlists?.find((p) => p.id === playlistId);
      if (!playlist) {
        return Promise.reject(
          new Error(`Playlist with ID ${playlistId} not found`),
        );
      }
      if (playlist.trackIds.includes(trackId)) {
        return Promise.reject(new Error('TRACK_ALREADY_PRESENT'));
      }
      const updated: Playlist = {
        ...playlist,
        trackIds: [...playlist.trackIds, trackId],
      };
      return window.electron.playlists.update(updated).then(() => updated);
    },
    onMutate: async ({ trackId, playlistId }) => {
      await qc.cancelQueries({ queryKey: queryKeys.playlists });
      const prev = qc.getQueryData<Playlist[]>(queryKeys.playlists);
      qc.setQueryData<Playlist[]>(queryKeys.playlists, (old) =>
        old
          ? old.map((p) =>
              p.id === playlistId && !p.trackIds.includes(trackId)
                ? { ...p, trackIds: [...p.trackIds, trackId] }
                : p,
            )
          : old,
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.playlists, ctx.prev);
      // Treat "already present" as an info, not an error.
      if (err instanceof Error && err.message === 'TRACK_ALREADY_PRESENT') {
        useUIStore
          .getState()
          .showNotification('Track is already in this playlist', 'info');
        return;
      }
      console.error('Failed to add track to playlist:', err);
      useUIStore
        .getState()
        .showNotification('Failed to add track to playlist', 'error');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.playlists }),
  });
}

export function useUpdatePlaylistSortPreference() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      playlistId,
      sorting,
    }: {
      playlistId: string;
      sorting: Array<{ id: string; desc: boolean }>;
    }) => {
      const playlists = qc.getQueryData<Playlist[]>(queryKeys.playlists);
      const playlist = playlists?.find((p) => p.id === playlistId);
      if (!playlist) {
        return Promise.reject(
          new Error(`Playlist with ID ${playlistId} not found`),
        );
      }
      return window.electron.playlists
        .update({ ...playlist, sortPreference: sorting })
        .then(() => undefined);
    },
    onMutate: async ({ playlistId, sorting }) => {
      await qc.cancelQueries({ queryKey: queryKeys.playlists });
      const prev = qc.getQueryData<Playlist[]>(queryKeys.playlists);
      qc.setQueryData<Playlist[]>(queryKeys.playlists, (old) =>
        old
          ? old.map((p) =>
              p.id === playlistId ? { ...p, sortPreference: sorting } : p,
            )
          : old,
      );
      return { prev };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(queryKeys.playlists, ctx.prev);
      // Per audit (libraryStore.ts:471-475), this used to swallow errors.
      // Now they surface to the user.
      console.error('Failed to persist playlist sort preference:', err);
      useUIStore
        .getState()
        .showNotification('Failed to save sort preference', 'error');
    },
    onSettled: () => qc.invalidateQueries({ queryKey: queryKeys.playlists }),
  });
}
