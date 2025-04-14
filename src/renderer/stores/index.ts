// Export all stores
// For backward compatibility with the context API
import useUIStore from './uiStore';
import useSettingsAndPlaybackStore from './settingsAndPlaybackStore';
import useLibraryStore from './libraryStore';

export { default as useUIStore } from './uiStore';
export { default as useSettingsAndPlaybackStore } from './settingsAndPlaybackStore';
export { default as useLibraryStore } from './libraryStore';

// Combined hook that provides all store data (mimics the old useAppContext)
export const useAppStore = () => {
  const uiState = useUIStore();
  const settingsAndPlaybackState = useSettingsAndPlaybackStore();
  const libraryState = useLibraryStore();

  return {
    ...uiState,
    ...settingsAndPlaybackState,
    ...libraryState,
  };
};
