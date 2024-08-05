import { create } from 'zustand';
import { LightweightAudioMetadata, StoreStructure } from '../../common/common';

interface AdditionalActions {
  deleteEverything: () => void;
  setLibrary: (library: { [key: string]: LightweightAudioMetadata }) => void;
  setLastPlayedSong: (song: string) => void;
  setLibraryPath: (path: string) => void;
  setInitialized: (initialized: boolean) => void;
}

const useMainStore = create<StoreStructure & AdditionalActions>((set) => ({
  /**
   * StoreStructure
   */
  library: {},
  playlists: [],
  lastPlayedSong: '',
  libraryPath: '',
  initialized: false,

  /**
   * AdditionalActions
   */
  deleteEverything: () => set({}, true),
  setLibrary: (library: { [key: string]: LightweightAudioMetadata }) => {
    // @dev: library source of truth is the BE so this only updates the FE store
    return set({
      library,
    });
  },
  setLastPlayedSong: (song: string) => {
    return set({
      lastPlayedSong: song,
    });
  },
  setLibraryPath: (path: string) => {
    return set({
      libraryPath: path,
    });
  },
  setInitialized: (initialized: boolean) => {
    return set({
      initialized,
    });
  },
}));

export default useMainStore;
