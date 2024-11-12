import { create } from 'zustand';
import { Gapless5, LogLevel } from '@regosen/gapless-5';
import { LightweightAudioMetadata } from '../../common/common';
import { bufferToDataUrl, findNextSong } from '../utils/utils';

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
  skipToNextSong: () => void;
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
  setShuffle: (shuffle) => {
    return set((state) => {
      // Calculate new next song based on new shuffle state
      const nextSong = findNextSong(
        state.currentSong,
        state.filteredLibrary,
        shuffle,
      );

      // Replace existing next song with a shuffled one
      state.player.replaceTrack(
        1,
        `my-magic-protocol://getMediaFile/${nextSong.songPath}`,
      );

      // @note: we clear the shuffle history as it's no longer relevant
      return { shuffle, shuffleHistory: [] };
    });
  },
  // @see: forces calls to player.cue() in certain spots
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

      const nextSong = findNextSong(songPath, library, state.shuffle);

      // Clear and add new tracks
      state.player.pause();
      state.player.removeAllTracks();
      state.player.addTrack(`my-magic-protocol://getMediaFile/${songPath}`);
      state.player.addTrack(
        `my-magic-protocol://getMediaFile/${nextSong.songPath}`,
      );

      // @important: wait 500ms before playing to avoid the stutter in Gapless5
      window.setTimeout(() => {
        state.player.play();
      }, 1000);

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
        currentSongTime: 0,
      };
    });
  },
  /**
   * Used for when you want to skip to the next song without
   * having to wait for the current song to finish.
   */
  skipToNextSong: () => {
    return set((state) => {
      // play the next song gaplessly, if possible
      state.player.next(0, 0, 0);
      // remove the old track at index 0 instantly after hitting next
      state.player.removeTrack(0);

      // get the name of the song that is playing now
      const currentSong = state.player
        .getTracks()[0]
        .replace('my-magic-protocol://getMediaFile/', '');
      const currentSongMetadata = state.filteredLibrary[currentSong];
      const currentSongIndex = Object.keys(state.filteredLibrary).findIndex(
        (song) => song === currentSong,
      );

      // calculate the song to play after this one
      const nextSong = findNextSong(
        currentSong,
        state.filteredLibrary,
        state.shuffle,
      );
      // add the next song
      state.player.addTrack(
        `my-magic-protocol://getMediaFile/${nextSong.songPath}`,
      );

      let shuffleHistory: string[] = [];
      if (state.shuffle) {
        shuffleHistory = [...state.shuffleHistory, currentSong];
      }

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
        overrideScrollToIndex: currentSongIndex,
        shuffleHistory,
      };
    });
  },
  /**
   * Used for when the current song finishes playing.
   * Needs to be debounced to avoid a second call before the removeTrack call
   * finishes.
   */
  autoPlayNextSong: () => {
    return set((state) => {
      // get the name of the song that is playing now which is at index 1
      // since we've completed the song at index 0.
      const currentSong = state.player
        .getTracks()[1]
        .replace('my-magic-protocol://getMediaFile/', '');

      // remove the track at index 0 a half second later to avoid pausing unintentionally
      window.setTimeout(() => {
        state.player.removeTrack(0);
      }, 150);

      const currentSongMetadata = state.filteredLibrary[currentSong];
      const currentSongIndex = Object.keys(state.filteredLibrary).findIndex(
        (song) => song === currentSong,
      );
      // calculate the song to play after this one
      const nextSong = findNextSong(
        currentSong,
        state.filteredLibrary,
        state.shuffle,
      );
      let shuffleHistory: string[] = [];
      if (state.shuffle) {
        shuffleHistory = [...state.shuffleHistory, currentSong];
      }

      // add the next song
      state.player.addTrack(
        `my-magic-protocol://getMediaFile/${nextSong.songPath}`,
      );

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
        overrideScrollToIndex: currentSongIndex,
        shuffleHistory,
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
