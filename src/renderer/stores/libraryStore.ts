import { create } from 'zustand';
import { Track, Playlist } from '../../types/dbTypes';
import { LibraryStore } from './types';
import useUIStore from './uiStore';

// Define the library store
const useLibraryStore = create<LibraryStore>((set, get) => ({
  // State
  tracks: [],
  playlists: [],
  isLoading: true,
  selectedPlaylistId: null,
  selectedTrackId: null,
  libraryViewState: {
    sorting: [{ id: 'artist', desc: false }],
    filtering: '',
  },
  playlistViewState: {
    sorting: [{ id: 'artist', desc: false }],
    filtering: '',
    playlistId: null,
  },

  // Actions
  loadLibrary: async () => {
    set({ isLoading: true });

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

      set({ tracks: allTracks, isLoading: false });
    } catch (error) {
      console.error('Error loading library:', error);
      useUIStore.getState().showNotification('Failed to load library', 'error');
      set({ isLoading: false });
    }
  },

  loadPlaylists: async () => {
    try {
      const allPlaylists = await window.electron.playlists.getAll();
      set({ playlists: allPlaylists });
    } catch (error) {
      console.error('Error loading playlists:', error);
      useUIStore
        .getState()
        .showNotification('Failed to load playlists', 'error');
    }
  },

  selectPlaylist: (playlistId: string | null) => {
    set({ selectedPlaylistId: playlistId });
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
        ruleSet: null,
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
      set({ isLoading: true });
      await window.electron.library.scan(libraryPath);
      // The scan complete event will trigger a library reload
    } catch (error) {
      console.error('Error scanning library:', error);
      useUIStore.getState().showNotification('Failed to scan library', 'error');
      set({ isLoading: false });
      throw error;
    }
  },

  importFiles: async (files: string[]) => {
    try {
      set({ isLoading: true });
      await window.electron.library.import(files);
      await get().loadLibrary();
      useUIStore
        .getState()
        .showNotification(`Imported ${files.length} files`, 'success');
    } catch (error) {
      console.error('Error importing files:', error);
      useUIStore.getState().showNotification('Failed to import files', 'error');
      set({ isLoading: false });
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
}));

// Set up event listener for library scan completion
if (typeof window !== 'undefined') {
  window.electron.ipcRenderer.on('library:scanComplete', (data: any) => {
    console.log(`Library scan complete: ${data.tracksAdded} tracks added`);
    useUIStore
      .getState()
      .showNotification(
        `Library scan complete: ${data.tracksAdded} tracks added`,
        'success',
      );

    // Reload the library to get the updated tracks
    useLibraryStore.getState().loadLibrary();
  });

  // Initialize library on app start
  const initializeLibrary = async () => {
    await useLibraryStore.getState().loadPlaylists();
    await useLibraryStore.getState().loadLibrary();
  };

  initializeLibrary();
}

export default useLibraryStore;
