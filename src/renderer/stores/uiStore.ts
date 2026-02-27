import { create } from 'zustand';
import { Notification, UIStore } from './types';

// Define the UI store
const useUIStore = create<UIStore>((set) => ({
  // State
  notifications: [],
  currentView: 'library',
  settingsOpen: false,
  browserOpen: false,

  // Actions
  setCurrentView: (view: 'library' | 'playlists') => set({ currentView: view }),
  setSettingsOpen: (open: boolean) => set({ settingsOpen: open }),
  showNotification: (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error',
    autoHideDuration = 5000,
  ) => {
    // Generate a unique ID
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newNotification: Notification = {
      id,
      message,
      type,
      autoHideDuration,
    };

    // Add new notification without limiting (we'll handle display limits in the UI)
    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));

    // Don't auto-remove notifications anymore - let the user manage them
    // This prevents notifications from disappearing while the user is reading them
  },

  removeNotification: (id: string) =>
    set((state) => ({
      notifications: state.notifications.filter(
        (notification) => notification.id !== id,
      ),
    })),

  clearAllNotifications: () =>
    set(() => ({
      notifications: [],
    })),

  setBrowserOpen: (open: boolean) => {
    if (!open) {
      // Clear all browser filters when hiding
      // Use lazy require to avoid circular dependency (uiStore <-> libraryStore)
      // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires
      const libStore = require('./libraryStore').default;
      libStore.getState().clearAllBrowserFilters();
    }
    set({ browserOpen: open });
  },
}));

export default useUIStore;
