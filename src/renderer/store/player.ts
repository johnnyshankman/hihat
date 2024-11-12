import { create } from 'zustand';
import { Gapless5, LogLevel } from '@regosen/gapless-5';
import { LightweightAudioMetadata } from '../../common/common';
import { bufferToDataUrl } from '../utils/utils';

interface PlayerStore {
  /**
   * state
   */
  player: Gapless5;
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
  playNextSong: () => void;
  autoPlayNextSong: () => void;
}

const usePlayerStore = create<PlayerStore>((set) => ({
  /**
   * default state
   */
  player: new Gapless5({
    useHTML5Audio: true,
    loglevel: LogLevel.Debug,
    crossfade: 100,
    exclusive: true,
  }),
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
    return set((state) => {
      state.player.setVolume(volume / 100);
      return { volume };
    });
  },
  setPaused: (paused) => {
    return set((state) => {
      if (paused) {
        state.player.pause();
      } else {
        state.player.play();
      }
      return { paused };
    });
  },
  // @note: when shuffle is toggled on or off we clear the shuffle history
  setShuffle: (shuffle) => set({ shuffle, shuffleHistory: [] }),
  // @note: repeating does not cause the player's trackList to change
  setRepeating: (repeating) => set({ repeating }),
  // @note: makes it so that the track list is set to the 2 songs
  // that we want to play in a row, the current song and the next song
  selectSpecificSong: (songPath: string, library) => {
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

      const keys = Object.keys(library);
      const currentIndex = keys.indexOf(songPath || '');

      let nextSong = '';
      if (state.shuffle) {
        const randomIndex = Math.floor(Math.random() * keys.length);
        nextSong = keys[randomIndex];
        state.setShuffleHistory([...state.shuffleHistory, songPath]);
      } else {
        const nextIndex =
          currentIndex + 1 >= keys.length ? 0 : currentIndex + 1;
        nextSong = keys[nextIndex];
      }

      // Clear and add new tracks
      state.player.pause();
      state.player.removeAllTracks();
      state.player.addTrack(`my-magic-protocol://getMediaFile/${songPath}`);
      state.player.addTrack(`my-magic-protocol://getMediaFile/${nextSong}`);

      window.setTimeout(() => {
        state.player.play();
      }, 500);

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

      return {
        currentSong: songPath,
        currentSongMetadata: metadata,
        paused: false,
      };
    });
  },
  /**
   * plays song at index 1, then removes song at index 0, then adds the next song
   */
  playNextSong: () => {
    return set((state) => {
      // play the next song gaplessly, if possible
      state.player.next(0, 0, 0);

      // get the name of the song that is playing now which is at index 1
      // be sure to remove the my-magic-protocol://getMediaFile/ prefix
      const currentSong = state.player
        .getTracks()[1]
        .replace('my-magic-protocol://getMediaFile/', '');

      // remove the track at index 0 a second later
      window.setTimeout(() => {
        state.player.removeTrack(0);
      }, 500);

      const keys = Object.keys(state.filteredLibrary);
      const currentIndex = keys.indexOf(currentSong || '');
      const currentSongMetadata = state.filteredLibrary[currentSong];

      // calculate the song to play after this one
      let nextSong = '';
      if (state.shuffle) {
        const randomIndex = Math.floor(Math.random() * keys.length);
        nextSong = keys[randomIndex];
        state.setShuffleHistory([...state.shuffleHistory, currentSong]);
      } else {
        const nextIndex =
          currentIndex + 1 >= keys.length ? 0 : currentIndex + 1;
        nextSong = keys[nextIndex];
      }

      // add the next song
      state.player.addTrack(`my-magic-protocol://getMediaFile/${nextSong}`);

      // Handle album art
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
      window.electron.ipcRenderer.sendMessage('get-album-art', currentSong);

      return {
        currentSong,
        currentSongMetadata,
        paused: false,
      };
    });
  },
  autoPlayNextSong: () => {
    return set((state) => {
      // get the name of the song that is playing now which is at index 1
      // be sure to remove the my-magic-protocol://getMediaFile/ prefix
      const currentSong = state.player
        .getTracks()[1]
        .replace('my-magic-protocol://getMediaFile/', '');

      window.setTimeout(() => {
        state.player.removeTrack(0);
      }, 500);

      const keys = Object.keys(state.filteredLibrary);
      const currentIndex = keys.indexOf(currentSong || '');
      const currentSongMetadata = state.filteredLibrary[currentSong];

      // calculate the song to play after this one
      let nextSong = '';
      if (state.shuffle) {
        const randomIndex = Math.floor(Math.random() * keys.length);
        nextSong = keys[randomIndex];
        state.setShuffleHistory([...state.shuffleHistory, currentSong]);
      } else {
        const nextIndex =
          currentIndex + 1 >= keys.length ? 0 : currentIndex + 1;
        nextSong = keys[nextIndex];
      }

      // add the next song
      state.player.addTrack(`my-magic-protocol://getMediaFile/${nextSong}`);

      // Handle album art
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
      window.electron.ipcRenderer.sendMessage('get-album-art', currentSong);

      return {
        currentSong,
        currentSongMetadata,
      };
    });
  },
  setFilteredLibrary: (filteredLibrary) => set({ filteredLibrary }),
  setCurrentSongTime: (currentSongTime) => set({ currentSongTime }),
  setOverrideScrollToIndex: (overrideScrollToIndex) => {
    return set({ overrideScrollToIndex });
  },
  setShuffleHistory: (shuffleHistory) => set({ shuffleHistory }),
}));

export default usePlayerStore;
