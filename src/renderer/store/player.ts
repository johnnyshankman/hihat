import { create } from 'zustand';
import { LightweightAudioMetadata } from '../../common/common';

interface PlayerStore {
  paused: boolean;
  currentSong: string;
  currentSongDataURL: string;
  currentSongMetadata: LightweightAudioMetadata;
  shuffle: boolean;
  repeating: boolean;
  volume: number;
  currentSongTime: number;
  filteredLibrary: { [key: string]: LightweightAudioMetadata };
  overrideScrollToIndex: number | undefined;
  shuffleHistory: string[];

  deleteEverything: () => void;
  setVolume: (volume: number) => void;
  setPaused: (paused: boolean) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeating: (repeating: boolean) => void;
  setCurrentSong: (song: string) => void;
  setCurrentSongDataURL: (dataURL: string) => void;
  setCurrentSongMetadata: (metadata: LightweightAudioMetadata) => void;
  setCurrentSongTime: (time: number) => void;
  setFilteredLibrary: (filteredLibrary: {
    [key: string]: LightweightAudioMetadata;
  }) => void;
  setOverrideScrollToIndex: (index: number | undefined) => void;
  setShuffleHistory: (history: string[]) => void;
}

const usePlayerStore = create<PlayerStore>((set) => ({
  paused: true,
  currentSong: '',
  currentSongDataURL: '',
  currentSongMetadata: {} as LightweightAudioMetadata,
  shuffle: false,
  repeating: false,
  volume: 100,
  currentSongTime: 0,
  filteredLibrary: {},
  overrideScrollToIndex: undefined,
  shuffleHistory: [],
  deleteEverything: () => set({}, true),
  setVolume: (volume) => {
    /**
     * @dev set the volume of the audio tag to the new volume automatically
     * as there is only one audio tag in the entire app
     */
    const audioTag = document.querySelector('audio');
    if (audioTag) {
      audioTag.volume = volume / 100;
    }
    return set({ volume });
  },
  setPaused: (paused) => set({ paused }),
  // @note: when shuffle is toggled on or off we clear the shuffle history
  setShuffle: (shuffle) => set({ shuffle, shuffleHistory: [] }),
  setRepeating: (repeating) => set({ repeating }),
  setCurrentSong: (currentSong) => set({ currentSong }),
  setCurrentSongDataURL: (currentSongDataURL) => set({ currentSongDataURL }),
  setCurrentSongMetadata: (currentSongMetadata) => set({ currentSongMetadata }),
  setFilteredLibrary: (filteredLibrary) => set({ filteredLibrary }),
  setCurrentSongTime: (currentSongTime) => set({ currentSongTime }),
  setOverrideScrollToIndex: (overrideScrollToIndex) => {
    return set({ overrideScrollToIndex });
  },
  setShuffleHistory: (shuffleHistory) => set({ shuffleHistory }),
}));

export default usePlayerStore;
