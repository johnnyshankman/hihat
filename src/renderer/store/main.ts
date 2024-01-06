import { create } from 'zustand';
import { SongSkeletonStructure, StoreStructure } from '../../common/common';

interface AdditionalActions {
  deleteEverything: () => void;
  setLibrary: (library: { [key: string]: SongSkeletonStructure }) => void;
  setLastPlayedSong: (song: string) => void;
  setLibraryPath: (path: string) => void;
}

const useMainStore = create<StoreStructure & AdditionalActions>((set) => ({
  /**
   * StoreStructure
   */
  library: {},
  playlists: [],
  lastPlayedSong: '',
  libraryPath: '',

  /**
   * AdditionalActions
   */
  deleteEverything: () => set({}, true),
  setLibrary: (library: { [key: string]: SongSkeletonStructure }) => {
    // @dev: library source of truth is the BE so this only updates the FE store
    return set({
      library,
    });
  },
  setLastPlayedSong: (song: string) => {
    // @dev: send message that syncs the BE with the FE, affects next reboot
    window.electron.ipcRenderer.sendMessage('set-last-played-song', song);
    return set({
      lastPlayedSong: song,
    });
  },
  setLibraryPath: (path: string) => {
    return set({
      libraryPath: path,
    });
  },
}));

export default useMainStore;
