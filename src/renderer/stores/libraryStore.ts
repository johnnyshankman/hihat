import { create } from 'zustand';
import type { Playlist } from '../../types/dbTypes';
import { LibraryStore } from './types';
import { queryClient } from '../queries/client';
import { queryKeys } from '../queries/keys';
import useUIStore from './uiStore';

/**
 * libraryStore holds UI / view state only. Server state (tracks,
 * playlists) is owned by TanStack Query — see `src/renderer/queries/`.
 *
 * The store keeps the in-flight UI bits that don't belong in a server
 * cache: which playlist is selected, sort/filter for each view, the
 * browser-panel artist/album filter, the search box value, and a
 * session cache for per-playlist sort preferences (separate from the
 * persisted `playlist.sortPreference` so rapid sort changes don't loop
 * the playlists subscribers).
 */
const useLibraryStore = create<LibraryStore>((set, get) => ({
  // ── State ───────────────────────────────────────────────────────
  selectedPlaylistId: null,
  selectedTrackId: null,
  lastViewedTrackId: null,

  libraryViewState: {
    sorting: [{ id: 'albumArtist', desc: false }],
    filtering: '',
  },
  playlistViewState: {
    sorting: [{ id: 'albumArtist', desc: false }],
    filtering: '',
    playlistId: null,
  },

  browserFilters: {},
  searchFilters: {},
  playlistSortPreferences: {},

  // ── Actions ─────────────────────────────────────────────────────
  selectPlaylist: (playlistId: string | null) => {
    set((state) => {
      if (!playlistId) {
        return {
          selectedPlaylistId: null,
          playlistViewState: {
            sorting: state.playlistViewState.sorting,
            filtering: '',
            playlistId: null,
          },
        };
      }
      const savedSort = state.playlistSortPreferences[playlistId];
      const savedFilter = state.searchFilters[playlistId] ?? '';
      return {
        selectedPlaylistId: playlistId,
        playlistViewState: {
          sorting: savedSort ?? [{ id: 'albumArtist', desc: false }],
          filtering: savedFilter,
          playlistId,
        },
      };
    });
  },

  selectTrack: (trackId: string | null) => {
    set({ selectedTrackId: trackId });
  },

  updateLibraryViewState: (sorting: any, filtering: string) => {
    set({ libraryViewState: { sorting, filtering } });
  },

  updatePlaylistViewState: (
    sorting: any,
    filtering: string,
    playlistId: string | null,
  ) => {
    set({ playlistViewState: { sorting, filtering, playlistId } });
  },

  setLastViewedTrackId: (trackId: string | null) => {
    set({ lastViewedTrackId: trackId });
  },

  setBrowserFilter: (viewId, filter) => {
    set((state) => ({
      browserFilters: { ...state.browserFilters, [viewId]: filter },
    }));
  },

  clearBrowserFilter: (viewId) => {
    set((state) => {
      const next = { ...state.browserFilters };
      delete next[viewId];
      return { browserFilters: next };
    });
  },

  clearAllBrowserFilters: () => {
    set({ browserFilters: {} });
  },

  getBrowserFilter: (viewId) => {
    return get().browserFilters[viewId] || { artist: null, album: null };
  },

  setSearchFilter: (viewId, filter) => {
    set((state) => {
      const searchFilters = { ...state.searchFilters, [viewId]: filter };
      // Mirror into the matching view state so trackSelectionUtils sees
      // the user's filter immediately without a fan-out from JSX.
      if (viewId === 'library') {
        return {
          searchFilters,
          libraryViewState: { ...state.libraryViewState, filtering: filter },
        };
      }
      if (viewId === state.selectedPlaylistId) {
        return {
          searchFilters,
          playlistViewState: {
            ...state.playlistViewState,
            filtering: filter,
            playlistId: viewId,
          },
        };
      }
      return { searchFilters };
    });
  },

  getSearchFilter: (viewId) => {
    return get().searchFilters[viewId] || '';
  },

  /**
   * Update the session sort cache and persist via the playlists IPC.
   * Rolls back the in-memory state and surfaces an error toast if the
   * persist fails so the UI never shows a sort that wasn't saved.
   */
  setPlaylistSortPreference: (playlistId, sorting) => {
    if (!sorting || sorting.length === 0) return;

    const prevSort = get().playlistSortPreferences[playlistId];

    set((state) => {
      const playlistSortPreferences = {
        ...state.playlistSortPreferences,
        [playlistId]: sorting,
      };
      if (playlistId === state.selectedPlaylistId) {
        return {
          playlistSortPreferences,
          playlistViewState: {
            ...state.playlistViewState,
            sorting,
            playlistId,
          },
        };
      }
      return { playlistSortPreferences };
    });

    // Persist via TanStack Query: optimistic write to cache, then IPC.
    // We drive this from the store (instead of a hook) because
    // setPlaylistSortPreference is invoked from a non-component
    // callback path (table sort handler).
    const playlists = queryClient.getQueryData<Playlist[]>(queryKeys.playlists);
    const playlist = playlists?.find((p) => p.id === playlistId);
    if (!playlist) return;

    const updated: Playlist = { ...playlist, sortPreference: sorting };
    const prevPlaylists = playlists;
    queryClient.setQueryData<Playlist[]>(queryKeys.playlists, (old) =>
      old ? old.map((p) => (p.id === playlistId ? updated : p)) : old,
    );

    window.electron.playlists.update(updated).catch((err: unknown) => {
      // Revert both the session cache and the TQ cache.
      set((state) => {
        const next = { ...state.playlistSortPreferences };
        if (prevSort) next[playlistId] = prevSort;
        else delete next[playlistId];
        if (playlistId === state.selectedPlaylistId) {
          return {
            playlistSortPreferences: next,
            playlistViewState: {
              ...state.playlistViewState,
              sorting: prevSort ?? state.playlistViewState.sorting,
              playlistId,
            },
          };
        }
        return { playlistSortPreferences: next };
      });
      if (prevPlaylists) {
        queryClient.setQueryData(queryKeys.playlists, prevPlaylists);
      }
      console.error('Error persisting playlist sort preference:', err);
      useUIStore
        .getState()
        .showNotification('Failed to save sort preference', 'error');
    });
  },

  /**
   * Seed the session sort-pref cache from the playlists query data.
   * Idempotent — only fills entries that aren't already cached, so a
   * user's mid-session sort change isn't clobbered by a refetch.
   */
  seedPlaylistSortPreferences: (playlists) => {
    set((state) => {
      const next = { ...state.playlistSortPreferences };
      let mutated = false;
      playlists.forEach((p) => {
        if (p.sortPreference && !next[p.id]) {
          next[p.id] = p.sortPreference;
          mutated = true;
        }
      });
      return mutated ? { playlistSortPreferences: next } : state;
    });
  },
}));

export default useLibraryStore;
