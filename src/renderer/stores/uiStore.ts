import { create } from 'zustand';
import { Notification, UIStore } from './types';

// Define the UI store
const useUIStore = create<UIStore>((set) => ({
  // State
  notifications: [],
  currentView: 'library',
  settingsOpen: false,
  browserOpen: false,
  sidebarOpen: true,
  notificationPanelOpen: false,

  // Actions
  setCurrentView: (view: 'library' | 'playlists') => set({ currentView: view }),
  setSettingsOpen: (open: boolean) => set({ settingsOpen: open }),
  showNotification: (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error',
  ) => {
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const newNotification: Notification = {
      id,
      message,
      type,
    };

    set((state) => ({
      notifications: [...state.notifications, newNotification],
    }));
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

  setNotificationPanelOpen: (open: boolean) =>
    set({ notificationPanelOpen: open }),

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

  setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

export default useUIStore;
