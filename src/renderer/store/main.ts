import { create } from 'zustand';
import { SongSkeletonStructure, StoreStructure } from '../../common/common';

interface AdditionalActions {
  deleteEverything: () => void;
  setLibrary: (library: { [key: string]: SongSkeletonStructure }) => void;
  setLastPlayedSong: (song: string) => void;
  setLibraryPath: (path: string) => void;
}

const useStoreStructure = create<StoreStructure & AdditionalActions>((set) => ({
  library: {},
  playlists: [],
  lastPlayedSong: '',
  libraryPath: '',
  deleteEverything: () => set({}, true),
  setLibrary: (library: { [key: string]: SongSkeletonStructure }) => {
    return set({
      library,
    });
  },
  setLastPlayedSong: (song: string) => {
    // send the message over the IPC to sync the backend with the FE
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

export default useStoreStructure;
