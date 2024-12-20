import { create } from 'zustand';
import { Gapless5 } from '@regosen/gapless-5';
import { LightweightAudioMetadata, StoreStructure } from '../../common/common';
import {
  bufferToDataUrl,
  findNextSong,
  updateMediaSession,
} from '../utils/utils';

interface StoreActions {
  // Main store actions
  deleteEverything: () => void;
  setLibrary: (library: { [key: string]: LightweightAudioMetadata }) => void;
  setLibraryPath: (path: string) => void;
  setInitialized: (initialized: boolean) => void;
  setLastPlayedSong: (song: string) => void;

  // Player store actions
  setVolume: (volume: number) => void;
  setPaused: (paused: boolean) => void;
  setShuffle: (shuffle: boolean) => void;
  setRepeating: (repeating: boolean) => void;
  selectSpecificSong: (
    songPath: string,
    library?: { [key: string]: LightweightAudioMetadata },
  ) => void;
  setCurrentSongTime: (time: number) => void;
  setFilteredLibrary: (filteredLibrary: {
    [key: string]: LightweightAudioMetadata;
  }) => void;
  setOverrideScrollToIndex: (index: number | undefined) => void;
  setShuffleHistory: (history: string[]) => void;
  skipToNextSong: () => void;
  autoPlayNextSong: () => Promise<void>;
  playPreviousSong: () => Promise<void>;
  increasePlayCountOfSong: (songPath: string) => void;
  setHasIncreasedPlayCount: (hasIncreasedPlayCount: boolean) => void;
}

interface StoreState extends StoreStructure {
  // Player specific state
  player: Gapless5;
  paused: boolean;
  currentSong: string;
  currentSongArtworkDataURL: string;
  currentSongMetadata: LightweightAudioMetadata;
  shuffle: boolean;
  repeating: boolean;
  volume: number;
  currentSongTime: number;
  filteredLibrary: { [key: string]: LightweightAudioMetadata };
  overrideScrollToIndex: number;
  shuffleHistory: string[];
  hasIncreasedPlayCount: boolean;
}

const useMainStore = create<StoreState & StoreActions>((set) => ({
  // StoreStructure state
  library: {},
  playlists: [],
  lastPlayedSong: '',
  libraryPath: '',
  initialized: false,

  // Player state
  player: new Gapless5({
    useHTML5Audio: false,
    crossfade: 25,
    exclusive: true,
    loadLimit: 3,
  }),
  paused: false,
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
  hasIncreasedPlayCount: false,
  // Main store actions
  deleteEverything: () => set({}, true),
  setLibrary: (library) => set({ library }),
  setLibraryPath: (libraryPath) => set({ libraryPath }),
  setInitialized: (initialized) => set({ initialized }),
  setLastPlayedSong: (lastPlayedSong) => set({ lastPlayedSong }),
  setHasIncreasedPlayCount: (hasIncreasedPlayCount) =>
    set({ hasIncreasedPlayCount }),
  // Player store actions
  setVolume: (volume) => {
    return set((state) => {
      state.player.setVolume(volume / 100);
      return { volume };
    });
  },

  setPaused: (paused) => {
    return set((state) => {
      if (paused) {
        state.player.pause();
        const audioElement = document.querySelector('audio');
        if (audioElement) {
          audioElement.pause();
        }
      } else {
        state.player.play();
        const audioElement = document.querySelector('audio');
        if (audioElement) {
          audioElement.play();
        }
      }
      return { paused };
    });
  },

  setShuffle: (shuffle) => {
    return set((state) => {
      const nextSong = findNextSong(
        state.currentSong,
        state.filteredLibrary,
        shuffle,
      );

      // Get the current track index
      const currentIndex = state.player.getIndex();

      // Replace the last track with the new next song
      state.player.replaceTrack(
        currentIndex + 1,
        `my-magic-protocol://getMediaFile/${nextSong.songPath}`,
      );

      // Seed the shuffle history with the current song that is playing
      const shuffleHistory = shuffle ? [state.currentSong] : [];

      return { shuffle, shuffleHistory };
    });
  },

  setRepeating: (repeating) => {
    return set((state) => {
      state.player.singleMode = repeating;
      return { repeating };
    });
  },

  increasePlayCountOfSong: (songPath: string) => {
    return set((state) => {
      const newLibrary = {
        ...state.library,
        [songPath]: {
          ...state.library[songPath],
          additionalInfo: {
            ...state.library[songPath].additionalInfo,
            playCount: state.library[songPath].additionalInfo.playCount + 1,
          },
        },
      };
      const newFilteredLibrary = {
        ...state.filteredLibrary,
        [songPath]: {
          ...state.filteredLibrary[songPath],
          additionalInfo: {
            ...state.filteredLibrary[songPath].additionalInfo,
            playCount:
              state.filteredLibrary[songPath].additionalInfo.playCount + 1,
          },
        },
      };

      // @note: ensures the userConfig is updated for next boot of app
      window.electron.ipcRenderer.sendMessage('increment-play-count', {
        song: songPath,
      });

      return { library: newLibrary, filteredLibrary: newFilteredLibrary };
    });
  },

  selectSpecificSong: (songPath, library) => {
    return set((state) => {
      if (!library) {
        console.error('No library provided to setCurrentSongWithDetails');
        return {};
      }

      const songLibrary = library;
      const metadata = songLibrary[songPath];

      if (!metadata) {
        console.warn('No metadata found for requested song:', songPath);
        return {};
      }

      // Update shuffle history if needed, never longer than 100 items
      let shuffleHistory: string[] = [];
      if (state.shuffle) {
        shuffleHistory = [...state.shuffleHistory, songPath];
        if (shuffleHistory.length > 100) {
          shuffleHistory.shift();
        }
      }

      const nextSong = findNextSong(songPath, library, state.shuffle);

      state.player.pause();
      state.player.removeAllTracks();
      state.player.addTrack(`my-magic-protocol://getMediaFile/${songPath}`);
      state.player.addTrack(
        `my-magic-protocol://getMediaFile/${nextSong.songPath}`,
      );
      state.player.play();
      const audioElement = document.querySelector('audio');
      if (audioElement) {
        audioElement.play();
      }

      updateMediaSession(metadata);

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

      window.electron.ipcRenderer.sendMessage('get-album-art', songPath);
      window.electron.ipcRenderer.sendMessage('set-last-played-song', songPath);

      return {
        currentSong: songPath,
        currentSongMetadata: metadata,
        paused: false,
        currentSongTime: 0,
        hasIncreasedPlayCount: false,
        shuffleHistory,
      };
    });
  },

  setCurrentSongTime: (currentSongTime) => set({ currentSongTime }),
  setFilteredLibrary: (filteredLibrary) => set({ filteredLibrary }),
  setOverrideScrollToIndex: (overrideScrollToIndex) =>
    set({ overrideScrollToIndex }),
  setShuffleHistory: (shuffleHistory) => set({ shuffleHistory }),

  /**
   * Used for when you want to skip to the next song without
   * having to wait for the current song to finish.
   */
  skipToNextSong: () => {
    return set((state) => {
      if (state.repeating) {
        state.player.setPosition(0);
        return {
          currentSongTime: 0,
          hasIncreasedPlayCount: false,
        };
      }

      // If shuffle is on, directly find the next shuffled song
      const nextSong = findNextSong(
        state.currentSong,
        state.filteredLibrary,
        state.shuffle,
      );

      // Update shuffle history if needed, never longer than 100 items
      let shuffleHistory: string[] = [];
      if (state.shuffle) {
        shuffleHistory = [...state.shuffleHistory, nextSong.songPath];
        if (shuffleHistory.length > 100) {
          shuffleHistory.shift();
        }
      }

      // Calculate the song to play after this one
      const futureNextSong = findNextSong(
        nextSong.songPath,
        state.filteredLibrary,
        state.shuffle,
      );

      // First pause current playback
      state.player.pause();
      state.player.removeAllTracks();

      // Add the next song and future next song
      state.player.addTrack(
        `my-magic-protocol://getMediaFile/${nextSong.songPath}`,
      );
      state.player.addTrack(
        `my-magic-protocol://getMediaFile/${futureNextSong.songPath}`,
      );

      if (!state.paused) {
        state.player.play();
        const audioElement = document.querySelector('audio');
        if (audioElement) {
          audioElement.play();
        }
      }

      updateMediaSession(state.filteredLibrary[nextSong.songPath]);

      // handle album art request
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

      // request album art
      window.electron.ipcRenderer.sendMessage(
        'get-album-art',
        nextSong.songPath,
      );

      // update last played song in user config
      window.electron.ipcRenderer.sendMessage(
        'set-last-played-song',
        nextSong.songPath,
      );

      return {
        currentSong: nextSong.songPath,
        currentSongMetadata: state.filteredLibrary[nextSong.songPath],
        currentSongTime: 0,
        shuffleHistory,
        lastPlayedSong: nextSong.songPath,
        hasIncreasedPlayCount: false,
      };
    });
  },
  /**
   * Used for when the current song finishes playing.
   * Needs to be debounced to avoid a second call before the removeTrack call
   * finishes.
   */
  autoPlayNextSong: async () => {
    return set((state) => {
      if (state.repeating) {
        state.player.gotoTrack(0);
        state.player.play();
        const audioElement = document.querySelector('audio');
        if (audioElement) {
          audioElement.play();
        }
        return {
          currentSongTime: 0,
          hasIncreasedPlayCount: false,
        };
      }

      // this is already up by one
      const tracks = state.player.getTracks();
      const index = state.player.getIndex();

      // Get next song info before removing anything
      const nextSongPath = tracks[index].replace(
        'my-magic-protocol://getMediaFile/',
        '',
      );
      const nextSongMetadata = state.filteredLibrary[nextSongPath];

      // Calculate the song to play after this one
      const futureNextSong = findNextSong(
        nextSongPath,
        state.filteredLibrary,
        state.shuffle,
      );

      // Update shuffle history if needed, never longer than 100 items
      let shuffleHistory: string[] = [];
      if (state.shuffle) {
        shuffleHistory = [...state.shuffleHistory, nextSongPath];
        if (shuffleHistory.length > 100) {
          shuffleHistory.shift();
        }
      }

      // Add the future next song
      state.player.addTrack(
        `my-magic-protocol://getMediaFile/${futureNextSong.songPath}`,
      );

      // Update media session
      updateMediaSession(nextSongMetadata);

      // handle album art request
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

      // request album art, handler is set above
      window.electron.ipcRenderer.sendMessage('get-album-art', nextSongPath);

      // update last played song in user config
      window.electron.ipcRenderer.sendMessage(
        'set-last-played-song',
        nextSongPath,
      );

      return {
        currentSong: nextSongPath,
        currentSongMetadata: nextSongMetadata,
        paused: false,
        shuffleHistory,
        lastPlayedSong: nextSongPath,
        hasIncreasedPlayCount: false,
      };
    });
  },
  playPreviousSong: async () => {
    return set((state) => {
      if (!state.filteredLibrary) return {};

      const keys = Object.keys(state.filteredLibrary);
      const currentIndex = keys.indexOf(state.currentSong || '');

      // repeating case, start the song over and over and over
      if (state.repeating) {
        state.player.setPosition(0);
        return {
          currentSongTime: 0,
          hasIncreasedPlayCount: false,
        };
      }

      /**
       * @note if the song is past the 3 second mark, restart it.
       * this emulates the behavior of most music players / cd players
       */
      if (state.currentSongTime > 3) {
        state.player.setPosition(0);

        return {
          currentSongTime: 0,
          hasIncreasedPlayCount: false,
        };
      }

      // shuffle case
      if (state.shuffle && state.shuffleHistory.length > 0) {
        const previousSong =
          state.shuffleHistory[state.shuffleHistory.length - 1];
        state.selectSpecificSong(previousSong, state.filteredLibrary);

        return {
          shuffleHistory: state.shuffleHistory.slice(0, -1),
          hasIncreasedPlayCount: false,
        };
      }

      // normal case - go to previous song in list
      const prevIndex =
        currentIndex - 1 < 0 ? keys.length - 1 : currentIndex - 1;
      const prevSong = keys[prevIndex];
      state.selectSpecificSong(prevSong, state.filteredLibrary);
      // @note: selectSpecificSong does all the heavy lifting for us
      // so we don't need to return anything here
      return {};
    });
  },
}));

export default useMainStore;
