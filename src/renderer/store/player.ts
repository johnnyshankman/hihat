import { create } from 'zustand';
import { SongSkeletonStructure } from '../../common/common';

interface PlayerStore {
  paused: boolean;
  currentSong: string;
  currentSongDataURL: string;
  currentSongMetadata: SongSkeletonStructure;
  shuffle: boolean;
  repeating: boolean;
  volume: number;
  currentSongTime: number;
  filteredLibrary: { [key: string]: SongSkeletonStructure };
  overrideScrollToIndex: number | undefined;

  deleteEverything: () => void;
  setVolume: (volume: number) => void;
  setPaused: (paused: boolean) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeating: (repeating: boolean) => void;
  setCurrentSong: (song: string) => void;
  setCurrentSongDataURL: (dataURL: string) => void;
  setCurrentSongMetadata: (metadata: SongSkeletonStructure) => void;
  setCurrentSongTime: (time: number) => void;
  setFilteredLibrary: (filteredLibrary: {
    [key: string]: SongSkeletonStructure;
  }) => void;
  setOverrideScrollToIndex: (index: number | undefined) => void;
}

const usePlayerStore = create<PlayerStore>((set) => ({
  paused: true,
  currentSong: '',
  currentSongDataURL: '',
  currentSongMetadata: {} as SongSkeletonStructure,
  shuffle: false,
  repeating: false,
  volume: 100,
  currentSongTime: 0,
  filteredLibrary: {},
  overrideScrollToIndex: undefined,

  deleteEverything: () => set({}, true),
  setVolume: (volume) => set({ volume }),
  setPaused: (paused) => set({ paused }),
  setShuffle: (shuffle) => set({ shuffle }),
  setRepeating: (repeating) => set({ repeating }),
  setCurrentSong: (currentSong) => set({ currentSong }),
  setCurrentSongDataURL: (currentSongDataURL) => set({ currentSongDataURL }),
  setCurrentSongMetadata: (currentSongMetadata) => set({ currentSongMetadata }),
  setFilteredLibrary: (filteredLibrary) => set({ filteredLibrary }),
  setCurrentSongTime: (currentSongTime) => set({ currentSongTime }),
  setOverrideScrollToIndex: (overrideScrollToIndex) => {
    return set({ overrideScrollToIndex });
  },
}));

export default usePlayerStore;
