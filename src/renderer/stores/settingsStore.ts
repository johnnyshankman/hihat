import { create } from 'zustand';
import { SettingsStore } from './types';
import useUIStore from './uiStore';
import { Settings } from '../../types/dbTypes';
import usePlaybackStore from './playbackStore';

// Define the settings store
const useSettingsStore = create<SettingsStore>((set) => ({
  // Default state
  id: 'app-settings', // db record name never changes
  libraryPath: '',
  theme: 'light',
  lastPlayedSongId: null,
  volume: 1.0,
  columns: {
    title: true,
    artist: true,
    album: true,
    albumArtist: false,
    genre: true,
    duration: true,
    playCount: true,
    dateAdded: true,
    lastPlayed: false,
  },

  setLibraryPath: async (libraryPath: Settings['libraryPath']) => {
    try {
      const state = useSettingsStore.getState();

      if (!state.id) {
        throw new Error('Settings not loaded');
      }

      // Update the settings in the database
      const updatedSettings = {
        id: state.id,
        libraryPath,
        theme: state.theme,
        columns: state.columns,
        lastPlayedSongId: state.lastPlayedSongId,
        volume: state.volume,
      };
      await window.electron.settings.update(updatedSettings);

      // Update the settings state
      set({ libraryPath });
    } catch (error) {
      console.error('Error updating library path:', error);
      useUIStore
        .getState()
        .showNotification('Failed to update library path', 'error');
    }
  },

  // Actions
  loadSettings: async () => {
    try {
      const appSettings = await window.electron.settings.get();
      set({
        libraryPath: appSettings.libraryPath,
        theme: appSettings.theme,
        columns: appSettings.columns,
        lastPlayedSongId: appSettings.lastPlayedSongId || null,
        volume: appSettings.volume !== null ? appSettings.volume : 1.0,
      });

      // Update playbackStore's volume with the value from settings
      const volumeValue =
        appSettings.volume !== null ? appSettings.volume : 1.0;

      // Update the volume state in playbackStore
      usePlaybackStore.setState({ volume: volumeValue });

      return appSettings;
    } catch (error) {
      console.error('Error loading settings:', error);
      useUIStore
        .getState()
        .showNotification('Failed to load settings', 'error');
      return {
        libraryPath: '',
        theme: 'light',
        lastPlayedSongId: null,
        volume: 1.0,
        columns: {
          title: true,
          artist: true,
          album: true,
          albumArtist: false,
          genre: true,
          duration: true,
          playCount: true,
          dateAdded: true,
          lastPlayed: false,
        },
      };
    }
  },

  setColumnVisibility: async (column: string, isVisible: boolean) => {
    try {
      const state = useSettingsStore.getState();

      if (!state.columns) {
        throw new Error('Settings not loaded');
      }

      // Update the column visibility
      const updatedColumns = {
        ...state.columns,
        [column]: isVisible,
      };

      // Update the settings in the database
      const updatedSettings = {
        id: state.id,
        libraryPath: state.libraryPath,
        theme: state.theme,
        columns: updatedColumns,
        lastPlayedSongId: state.lastPlayedSongId,
        volume: state.volume,
      };
      await window.electron.settings.update(updatedSettings);

      // Update the settings state
      set({ columns: updatedColumns });
    } catch (error) {
      console.error('Error updating column visibility:', error);
      useUIStore
        .getState()
        .showNotification('Failed to update column visibility', 'error');
    }
  },

  setTheme: async (theme: 'light' | 'dark') => {
    try {
      const store = useSettingsStore.getState();

      if (!store.id) {
        throw new Error('Settings not loaded');
      }

      // Update the settings in the database
      const updatedSettings = {
        id: store.id,
        libraryPath: store.libraryPath,
        theme,
        columns: store.columns,
        lastPlayedSongId: store.lastPlayedSongId,
        volume: store.volume,
      };
      await window.electron.settings.update(updatedSettings);

      // Update the settings state
      set({ theme });
    } catch (error) {
      console.error('Error updating theme:', error);
      useUIStore.getState().showNotification('Failed to update theme', 'error');
    }
  },

  setLastPlayedSongId: async (trackId: string | null) => {
    try {
      const store = useSettingsStore.getState();

      if (!store.id) {
        throw new Error('Settings not loaded');
      }

      // Update the settings in the database
      const updatedSettings = {
        id: store.id,
        libraryPath: store.libraryPath,
        theme: store.theme,
        columns: store.columns,
        lastPlayedSongId: trackId,
        volume: store.volume,
      };
      await window.electron.settings.update(updatedSettings);

      // Update the settings state
      set({ lastPlayedSongId: trackId });
    } catch (error) {
      console.error('Error updating last played song ID:', error);
      useUIStore
        .getState()
        .showNotification('Failed to update last played song', 'error');
    }
  },

  setVolume: async (volume: number) => {
    try {
      const store = useSettingsStore.getState();

      if (!store.id) {
        throw new Error('Settings not loaded');
      }

      // Update the settings in the database
      const updatedSettings = {
        id: store.id,
        libraryPath: store.libraryPath,
        theme: store.theme,
        columns: store.columns,
        lastPlayedSongId: store.lastPlayedSongId,
        volume,
      };
      await window.electron.settings.update(updatedSettings);

      // Update the settings state
      set({ volume });
    } catch (error) {
      console.error('Error updating volume:', error);
      useUIStore
        .getState()
        .showNotification('Failed to update volume', 'error');
    }
  },
}));

// Initialize settings on app start
if (typeof window !== 'undefined') {
  useSettingsStore.getState().loadSettings();
}

export default useSettingsStore;
