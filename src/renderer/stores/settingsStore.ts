import { create } from 'zustand';
import { Settings } from '../../types/dbTypes';
import { SettingsStore } from './types';
import useUIStore from './uiStore';

// Default settings
const defaultSettings: Settings = {
  id: 'app-settings',
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

// Define the settings store
const useSettingsStore = create<SettingsStore>((set) => ({
  // State
  settings: null,

  // Actions
  loadSettings: async () => {
    try {
      const appSettings = await window.electron.settings.get();
      set({ settings: appSettings });
      return appSettings;
    } catch (error) {
      console.error('Error loading settings:', error);
      useUIStore
        .getState()
        .showNotification('Failed to load settings', 'error');
      return defaultSettings;
    }
  },

  updateColumnVisibility: async (column: string, isVisible: boolean) => {
    try {
      const { settings } = useSettingsStore.getState();

      if (!settings) {
        throw new Error('Settings not loaded');
      }

      // Update the column visibility
      const updatedColumns = {
        ...settings.columns,
        [column]: isVisible,
      };

      // Update the settings in the database
      const updatedSettings = {
        ...settings,
        columns: updatedColumns,
      };

      await window.electron.settings.update(updatedSettings);

      // Update the settings state
      set({ settings: updatedSettings });
    } catch (error) {
      console.error('Error updating column visibility:', error);
      useUIStore
        .getState()
        .showNotification('Failed to update column visibility', 'error');
    }
  },

  updateTheme: async (theme: 'light' | 'dark') => {
    try {
      const { settings } = useSettingsStore.getState();

      if (!settings) {
        throw new Error('Settings not loaded');
      }

      // Update the settings in the database
      const updatedSettings = {
        ...settings,
        theme,
      };

      await window.electron.settings.update(updatedSettings);

      // Update the settings state
      set({ settings: updatedSettings });
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
