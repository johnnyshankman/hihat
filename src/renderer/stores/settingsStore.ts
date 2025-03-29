import { create } from 'zustand';
import { SettingsStore } from './types';
import useUIStore from './uiStore';
import { Settings } from '../../types/dbTypes';

// Define the settings store
const useSettingsStore = create<SettingsStore>((set) => ({
  // Default state
  id: 'app-settings', // db record name never changes
  libraryPath: '',
  theme: 'light',
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
        ...state,
        libraryPath,
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
      });
      return appSettings;
    } catch (error) {
      console.error('Error loading settings:', error);
      useUIStore
        .getState()
        .showNotification('Failed to load settings', 'error');
      return {
        libraryPath: '',
        theme: 'light',
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
      };

      await window.electron.settings.update(updatedSettings);

      // Update the settings state
      set({ theme });
    } catch (error) {
      console.error('Error updating theme:', error);
      useUIStore.getState().showNotification('Failed to update theme', 'error');
    }
  },
}));

// Initialize settings on app start
if (typeof window !== 'undefined') {
  useSettingsStore.getState().loadSettings();
}

export default useSettingsStore;
