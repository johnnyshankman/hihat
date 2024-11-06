import { create } from 'zustand';
import { LightweightAudioMetadata } from '../../common/common';
import { bufferToDataUrl } from '../utils/utils';

interface PlayerStore {
  /**
   * state
   */
  paused: boolean;
  currentSong: string; // holds the path of the current song
  currentSongArtworkDataURL: string; // holds the artwork of the current song
  currentSongMetadata: LightweightAudioMetadata; // holds the metadata of the current song
  shuffle: boolean;
  repeating: boolean;
  volume: number;
  currentSongTime: number;
  filteredLibrary: { [key: string]: LightweightAudioMetadata };
  overrideScrollToIndex: number;
  shuffleHistory: string[];

  /**
   * actions
   */
  deleteEverything: () => void;
  setVolume: (volume: number) => void;
  setPaused: (paused: boolean) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeating: (repeating: boolean) => void;
  setCurrentSong: (
    songPath: string,
    library?: { [key: string]: LightweightAudioMetadata },
  ) => void;
  setCurrentSongTime: (time: number) => void;
  setFilteredLibrary: (filteredLibrary: {
    [key: string]: LightweightAudioMetadata;
  }) => void;
  setOverrideScrollToIndex: (index: number | undefined) => void;
  setShuffleHistory: (history: string[]) => void;
}

const usePlayerStore = create<PlayerStore>((set) => ({
  /**
   * default state
   */
  paused: true,
  currentSong: '',
  currentSongArtworkDataURL: '',
  currentSongMetadata: {} as LightweightAudioMetadata,
  shuffle: false,
  repeating: false,
  volume: 100,
  currentSongTime: 0,
  filteredLibrary: {},
  overrideScrollToIndex: -1,
  shuffleHistory: [],

  /**
   * action implementations
   */
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
  setCurrentSong: (songPath: string, library) => {
    if (!library) {
      // eslint-disable-next-line no-console
      console.error('No library provided to setCurrentSongWithDetails');
      return;
    }

    const songLibrary = library;
    const metadata = songLibrary[songPath];

    /**
     * @important need this feature so we can restart the currently playing
     * song by first clearing the current song and then setting it again
     */
    if (songPath === '') {
      set({ currentSong: songPath });
      return;
    }

    if (!metadata) {
      // eslint-disable-next-line no-console
      console.warn('No metadata found for song:', songPath);
      return;
    }

    set({
      currentSong: songPath,
      currentSongMetadata: metadata,
    });

    // Set album art on response
    window.electron.ipcRenderer.once('get-album-art', async (event) => {
      let url = '';
      if (event.data) {
        url = await bufferToDataUrl(event.data, event.format);
      }

      set({ currentSongArtworkDataURL: url });

      if (navigator.mediaSession.metadata?.artwork) {
        navigator.mediaSession.metadata.artwork = [
          {
            src: url,
            sizes: '192x192',
            type: event.format,
          },
        ];
      }
    });

    // Request album art, response handler is above
    window.electron.ipcRenderer.sendMessage('get-album-art', songPath);
  },
  setFilteredLibrary: (filteredLibrary) => set({ filteredLibrary }),
  setCurrentSongTime: (currentSongTime) => set({ currentSongTime }),
  setOverrideScrollToIndex: (overrideScrollToIndex) => {
    return set({ overrideScrollToIndex });
  },
  setShuffleHistory: (shuffleHistory) => set({ shuffleHistory }),
}));

export default usePlayerStore;
