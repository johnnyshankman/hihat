// Export all stores
// For backward compatibility with the context API
import useUIStore from './uiStore';
import useSettingsStore from './settingsStore';
import useLibraryStore from './libraryStore';
import usePlaybackStore from './playbackStore';

export { default as useUIStore } from './uiStore';
export { default as useSettingsStore } from './settingsStore';
export { default as useLibraryStore } from './libraryStore';
export { default as usePlaybackStore } from './playbackStore';

// Combined hook that provides all store data (mimics the old useAppContext)
export const useAppStore = () => {
  const uiState = useUIStore();
  const settingsState = useSettingsStore();
  const libraryState = useLibraryStore();
  const playbackState = usePlaybackStore();

  return {
    ...uiState,
    ...settingsState,
    ...libraryState,
    ...playbackState,
  };
};
