import { create } from 'zustand';
import { Track, Playlist } from '../../types/dbTypes';
import { LibraryStore, SearchIndexData } from './types';
import useUIStore from './uiStore';

// Helper function to build indexes from tracks
function buildIndexes(tracks: Track[]) {
  const trackIndex = new Map<string, Track>();
  const artistIndex = new Map<string, Set<string>>();
  const albumIndex = new Map<string, Set<string>>();
  const searchIndex = new Map<string, SearchIndexData>();

  tracks.forEach((track) => {
    // Build track index for O(1) lookup
    trackIndex.set(track.id, track);

    // Build artist index
    const artist = track.albumArtist || track.artist || 'Unknown Artist';
    if (!artistIndex.has(artist)) {
      artistIndex.set(artist, new Set());
    }
    artistIndex.get(artist)!.add(track.id);

    // Build album index
    const album = track.album || 'Unknown Album';
    if (!albumIndex.has(album)) {
      albumIndex.set(album, new Set());
    }
    albumIndex.get(album)!.add(track.id);

    // Build search index with pre-computed lowercase strings
    searchIndex.set(track.id, {
      titleLower: (track.title || '').toLowerCase(),
      artistLower: (track.artist || '').toLowerCase(),
      albumLower: (track.album || '').toLowerCase(),
      genreLower: (track.genre || '').toLowerCase(),
    });
  });

  return { trackIndex, artistIndex, albumIndex, searchIndex };
}

// Define the library store
const useLibraryStore = create<LibraryStore>((set, get) => ({
  // State
  tracks: [],
  playlists: [],
  isLoading: true,
  isScanning: false,
  selectedPlaylistId: null,
  selectedTrackId: null,
  libraryViewState: {
    sorting: [{ id: 'albumArtist', desc: false }],
    filtering: '',
  },
  browserFilters: {},
  searchFilters: {},
  playlistViewState: {
    sorting: [{ id: 'albumArtist', desc: false }],
    filtering: '',
    playlistId: null,
  },
  lastViewedTrackId: null,
  playlistSortPreferences: {},

  // Initialize empty indexes
  trackIndex: new Map(),
  artistIndex: new Map(),
  albumIndex: new Map(),
  searchIndex: new Map(),

  // Actions
  loadLibrary: async (isInitialLoad = true) => {
    // Only show loading screen on initial app load, not during library refreshes
    if (isInitialLoad) {
      set({ isLoading: true });
    }

    let allTracks: Track[] = [];
    try {
      const tracks = await window.electron.tracks.getAll();
      console.warn(
        'Loaded tracks from database:',
        tracks.length,
        'tracks found',
      );

      // Process tracks to ensure duration is properly set
      const processedTracks = tracks.map((track: any) => {
        // Ensure duration is a number
        let duration = 0;
        if (typeof track.duration === 'number') {
          duration = track.duration;
        } else if (track.duration) {
          // Try to convert to number if it's a string or other type
          duration = Number(track.duration);
        }

        return {
          ...track,
          duration,
        };
      });

      allTracks = processedTracks;

      // Build indexes for O(1) lookups
      const indexes = buildIndexes(allTracks);

      set({
        tracks: allTracks,
        isLoading: false,
        ...indexes,
      });
    } catch (error) {
      console.error('Error loading library:', error);
      useUIStore.getState().showNotification('Failed to load library', 'error');
      set({ isLoading: false });
    }
  },

  loadPlaylists: async () => {
    try {
      const allPlaylists = await window.electron.playlists.getAll();
      console.warn('Loaded playlists from database:', allPlaylists);

      // Populate per-playlist sort preferences from DB
      const sortPrefs: Record<
        string,
        Array<{ id: string; desc: boolean }>
      > = {};
      allPlaylists.forEach((p) => {
        if (p.sortPreference) {
          sortPrefs[p.id] = p.sortPreference;
        }
      });

      set({ playlists: allPlaylists, playlistSortPreferences: sortPrefs });
    } catch (error) {
      console.error('Error loading playlists:', error);
      useUIStore
        .getState()
        .showNotification('Failed to load playlists', 'error');
    }
  },

  selectPlaylist: (playlistId: string | null) => {
    // Reset playlistViewState to the new playlist's saved sort/filter
    // so trackSelectionUtils (used by next/prev track math) always sees
    // the view state matching the currently-selected playlist, even in
    // the brief window before the component renders.
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

  createPlaylist: async (name: string) => {
    try {
      const newPlaylist = await window.electron.playlists.create({
        name,
        trackIds: [],
        isSmart: false,
        smartPlaylistId: null,
        ruleSet: null,
        sortPreference: null,
      });

      set((state) => ({
        playlists: [...state.playlists, newPlaylist],
      }));

      useUIStore
        .getState()
        .showNotification(`Playlist "${name}" created`, 'success');
      return newPlaylist;
    } catch (error) {
      console.error('Error creating playlist:', error);
      useUIStore
        .getState()
        .showNotification('Failed to create playlist', 'error');
      throw error;
    }
  },

  updatePlaylist: async (playlist: Playlist) => {
    try {
      await window.electron.playlists.update(playlist);

      set((state) => ({
        playlists: state.playlists.map((p) =>
          p.id === playlist.id ? playlist : p,
        ),
      }));

      useUIStore
        .getState()
        .showNotification(`Playlist "${playlist.name}" updated`, 'success');
    } catch (error) {
      console.error('Error updating playlist:', error);
      useUIStore
        .getState()
        .showNotification('Failed to update playlist', 'error');
      throw error;
    }
  },

  deletePlaylist: async (playlistId: string) => {
    try {
      const { playlists } = get();
      const deletedPlaylist = playlists.find((p) => p.id === playlistId);

      // Prevent deletion of smart playlists
      if (deletedPlaylist?.isSmart) {
        useUIStore
          .getState()
          .showNotification('Smart playlists cannot be deleted', 'warning');
        return;
      }

      await window.electron.playlists.delete(playlistId);

      set((state) => ({
        playlists: state.playlists.filter((p) => p.id !== playlistId),
      }));

      useUIStore
        .getState()
        .showNotification(
          `Playlist "${deletedPlaylist?.name || playlistId}" deleted`,
          'success',
        );
    } catch (error) {
      console.error('Error deleting playlist:', error);
      useUIStore
        .getState()
        .showNotification('Failed to delete playlist', 'error');
      throw error;
    }
  },

  addTrackToPlaylist: async (trackId: string, playlistId: string) => {
    try {
      const { playlists, tracks } = get();

      // Find the playlist
      const playlist = playlists.find((p) => p.id === playlistId);
      if (!playlist) {
        throw new Error(`Playlist with ID ${playlistId} not found`);
      }

      // Check if the track is already in the playlist
      if (playlist.trackIds.includes(trackId)) {
        useUIStore
          .getState()
          .showNotification('Track is already in this playlist', 'info');
        return;
      }

      // Add the track to the playlist
      const updatedPlaylist = {
        ...playlist,
        trackIds: [...playlist.trackIds, trackId],
      };

      // Update the playlist in the database
      await window.electron.playlists.update(updatedPlaylist);

      // Update the playlists state
      set((state) => ({
        playlists: state.playlists.map((p) =>
          p.id === playlistId ? updatedPlaylist : p,
        ),
      }));

      // Find the track name for the notification
      const track = tracks.find((t) => t.id === trackId);
      useUIStore
        .getState()
        .showNotification(
          `Added "${track?.title || 'Track'}" to "${playlist.name}"`,
          'success',
        );
    } catch (error) {
      console.error('Error adding track to playlist:', error);
      useUIStore
        .getState()
        .showNotification('Failed to add track to playlist', 'error');
      throw error;
    }
  },

  scanLibrary: async (libraryPath: string) => {
    try {
      set({ isScanning: true });
      // this will trigger UX stuff (i hope)
      await window.electron.library.scan(libraryPath);
      // The scan complete event will trigger a library reload
      set({ isScanning: false });
    } catch (error) {
      set({ isScanning: false });
      console.error('Error scanning library:', error);
      useUIStore.getState().showNotification('Failed to scan library', 'error');
      throw error;
    }
  },

  importFiles: async (files: string[]) => {
    try {
      set({ isScanning: true });
      await window.electron.library.import(files);
      set({ isScanning: false });
      useUIStore
        .getState()
        .showNotification(
          `Processed ${files.length} ${files.length === 1 ? 'file' : 'files'}`,
          'success',
        );
    } catch (error) {
      console.error('Error importing files:', error);
      useUIStore.getState().showNotification('Failed to import files', 'error');
      set({ isScanning: false });
      throw error;
    }
  },

  updateLibraryViewState: (sorting: any, filtering: string) => {
    set({
      libraryViewState: {
        sorting,
        filtering,
      },
    });
  },

  updatePlaylistViewState: (
    sorting: any,
    filtering: string,
    playlistId: string | null,
  ) => {
    set({
      playlistViewState: {
        sorting,
        filtering,
        playlistId,
      },
    });
  },

  setLastViewedTrackId: (trackId: string | null) => {
    set({ lastViewedTrackId: trackId });
  },

  setBrowserFilter: (viewId: string, filter) => {
    set((state) => ({
      browserFilters: {
        ...state.browserFilters,
        [viewId]: filter,
      },
    }));
  },

  clearBrowserFilter: (viewId: string) => {
    set((state) => {
      const newFilters = { ...state.browserFilters };
      delete newFilters[viewId];
      return { browserFilters: newFilters };
    });
  },

  clearAllBrowserFilters: () => {
    set({ browserFilters: {} });
  },

  getBrowserFilter: (viewId: string) => {
    const { browserFilters } = get();
    return browserFilters[viewId] || { artist: null, album: null };
  },

  setSearchFilter: (viewId: string, filter: string) => {
    set((state) => {
      const searchFilters = {
        ...state.searchFilters,
        [viewId]: filter,
      };
      // Keep libraryViewState.filtering in sync for the library view so
      // trackSelectionUtils (used for next/prev track math) sees the
      // current filter immediately without any component-side fan-out.
      if (viewId === 'library') {
        return {
          searchFilters,
          libraryViewState: {
            ...state.libraryViewState,
            filtering: filter,
          },
        };
      }
      // For a playlist view ID that matches the currently-selected
      // playlist, mirror the filter into playlistViewState so next/prev
      // track math follows what the user sees.
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

  getSearchFilter: (viewId: string) => {
    const { searchFilters } = get();
    return searchFilters[viewId] || '';
  },

  setPlaylistSortPreference: (
    playlistId: string,
    sorting: Array<{ id: string; desc: boolean }>,
  ) => {
    if (!sorting || sorting.length === 0) return;

    // Update the session cache (do NOT update playlists array to avoid
    // triggering re-renders that cause infinite loops in Playlists.tsx).
    // If this playlist is the currently-selected one, also mirror the
    // sort into playlistViewState so trackSelectionUtils sees it.
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

    // Persist to DB (fire-and-forget)
    const { playlists } = get();
    const playlist = playlists.find((p) => p.id === playlistId);
    if (playlist) {
      window.electron.playlists
        .update({ ...playlist, sortPreference: sorting })
        .catch((err: unknown) => {
          console.error('Error persisting playlist sort preference:', err);
        });
    }
  },

  // NEW: Efficient data access methods using indexes
  getTrackById: (id: string) => {
    return get().trackIndex.get(id);
  },

  getTracksByIds: (ids: string[]) => {
    const { trackIndex } = get();
    return ids
      .map((id) => trackIndex.get(id))
      .filter((track): track is Track => !!track);
  },

  updateTrackInPlace: (updatedTrack: Track) => {
    const newTracks = get().tracks.map((t) =>
      t.id === updatedTrack.id ? updatedTrack : t,
    );
    const indexes = buildIndexes(newTracks);
    set({ tracks: newTracks, ...indexes });
  },
}));

let libraryBootstrapped = false;

/**
 * Wires the renderer-process library subsystem: registers the
 * `library:scanComplete` IPC listener and kicks off the initial library +
 * playlists load. Call once from the main app's mount effect (not from the
 * mini-player window, which has no library dependency).
 *
 * Idempotent — guarded so accidental double-calls (StrictMode, HMR) are safe.
 *
 * Fire-and-forget by design. The two initial loads run in parallel and the
 * function returns synchronously. Callers MUST NOT rely on bootstrap's
 * return to know "the library is ready" — instead, subscribe to
 * `useLibraryStore((s) => s.isLoading)` and react when it flips to false.
 * That's the contract `ThemedApp` already follows (see App.tsx — the second
 * useEffect runs `selectSpecificSong` once `isLoading` is false).
 *
 * If a future caller genuinely needs to await readiness (e.g. a programmatic
 * startup harness or test setup), convert the signature to
 * `async (): Promise<void>` and `await Promise.all([...])` the two loads.
 * Until then, keep this sync to avoid speculative API surface.
 */
export const bootstrapLibraryStore = (): void => {
  if (libraryBootstrapped) return;
  libraryBootstrapped = true;

  window.electron.ipcRenderer.on('library:scanComplete', (data: any) => {
    if (data.error) {
      console.warn(`Library scan failed: ${data.error}`);
      useUIStore.getState().showNotification(data.error, 'error');
      return;
    }

    const added = data.tracksAdded || 0;
    const removed = data.tracksRemoved || 0;

    let message = 'Library scan completed: ';
    const parts: string[] = [];
    if (added > 0)
      parts.push(`${added} new track${added !== 1 ? 's' : ''} added`);
    if (removed > 0)
      parts.push(`${removed} stale track${removed !== 1 ? 's' : ''} removed`);
    message += parts.length > 0 ? parts.join(', ') : 'no changes';

    console.warn(message);
    useUIStore.getState().showNotification(message, 'success');

    // Reload the library to get the updated tracks
    // Pass false to avoid showing loading screen during refresh
    useLibraryStore.getState().loadLibrary(false);
    // Reload the playlists to update the smart playlists
    useLibraryStore.getState().loadPlaylists();
  });

  useLibraryStore.getState().loadPlaylists();
  useLibraryStore.getState().loadLibrary();
};

export default useLibraryStore;
