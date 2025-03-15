import { create } from 'zustand';
import { Notification, UIStore } from './types';

// Define the UI store
const useUIStore = create<UIStore>((set) => ({
  // State
  theme: null,
  notifications: [],
  currentView: 'library',

  // Actions
  setTheme: (theme: 'light' | 'dark' | null) => set({ theme }),
  setCurrentView: (view: 'library' | 'playlists' | 'settings') =>
    set({ currentView: view }),
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

    // Add new notification and limit to max 3 in the state
    set((state) => {
      const updatedNotifications = [...state.notifications, newNotification];
      const limitedNotifications =
        updatedNotifications.length > 3
          ? updatedNotifications.slice(-3)
          : updatedNotifications;

      return { notifications: limitedNotifications };
    });

    // Auto-remove notification after duration
    if (autoHideDuration > 0) {
      setTimeout(() => {
        useUIStore.getState().removeNotification(id);
      }, autoHideDuration);
    }
  },

  removeNotification: (id: string) =>
    set((state) => ({
      notifications: state.notifications.filter(
        (notification) => notification.id !== id,
      ),
    })),
}));

export default useUIStore;
