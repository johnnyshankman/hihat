import { create } from 'zustand';
import { Gapless5, LogLevel } from '@regosen/gapless-5';
import { LightweightAudioMetadata } from '../../common/common';
import {
  bufferToDataUrl,
  findNextSong,
  updateMediaSession,
} from '../utils/utils';

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
  autoPlayNextSong: () => Promise<void>;
  playPreviousSong: () => Promise<void>;
}

const usePlayerStore = create<PlayerStore>((set) => ({
  /**
   * default state
   */
  player: new Gapless5({
    useHTML5Audio: false,
    loglevel: LogLevel.Debug,
    crossfade: 100,
    exclusive: true,
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
  setRepeating: (repeating) => {
    return set((state) => {
      state.player.singleMode = repeating;
      return { repeating };
    });
  },
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
      state.player.play();
      const audioElement = document.querySelector('audio');
      if (audioElement) {
        audioElement.play();
      }

      updateMediaSession(metadata);

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
      window.electron.ipcRenderer.sendMessage('get-album-art', songPath);

      window.electron.ipcRenderer.sendMessage('set-last-played-song', songPath);

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
      if (state.repeating) {
        state.player.setPosition(0);
        return {
          currentSongTime: 0,
        };
      }

      const tracks = state.player.getTracks();
      if (tracks.length < 2) return {}; // Safety check

      // Get next song info before removing anything
      const nextSongPath = tracks[1].replace(
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

      // Update shuffle history if needed
      let shuffleHistory: string[] = [];
      if (state.shuffle) {
        shuffleHistory = [...state.shuffleHistory, nextSongPath];
        if (shuffleHistory.length > 100) {
          shuffleHistory.shift();
        }
      }

      // First pause current playback
      state.player.pause();

      // Remove current track and start playing next track
      state.player.removeTrack(0);

      if (!state.paused) {
        state.player.play();
        const audioElement = document.querySelector('audio');
        if (audioElement) {
          audioElement.play();
        }

        // @note: sometimes the song doesn't play if we don't wait for the onload event
        state.player.onload = () => {
          state.player.play();
        };
      } else {
        state.player.pause();
        const audioElement = document.querySelector('audio');
        if (audioElement) {
          audioElement.pause();
        }
      }

      // Add the future next song
      state.player.addTrack(
        `my-magic-protocol://getMediaFile/${futureNextSong.songPath}`,
      );

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
      // request album art
      window.electron.ipcRenderer.sendMessage('get-album-art', nextSongPath);

      // update last played song in user config
      window.electron.ipcRenderer.sendMessage(
        'set-last-played-song',
        nextSongPath,
      );

      return {
        currentSong: nextSongPath,
        currentSongMetadata: nextSongMetadata,
        currentSongTime: 0,
        shuffleHistory,
        lastPlayedSong: nextSongPath,
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
        };
      }

      const tracks = state.player.getTracks();
      if (tracks.length < 2) return {}; // Safety check

      // Get next song info before removing anything
      const nextSongPath = tracks[1].replace(
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

      // Update shuffle history if needed
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

      // In exactly 1s remove all tracks before the current playing track
      window.setTimeout(() => {
        const currentTrack = state.player.currentSource();
        // find the index in the tracks array of the current track
        const currentTrackIndex = state.player
          .getTracks()
          .findIndex((track) => track === currentTrack.audioPath);
        // remove all tracks before the current track's index
        for (let i = 0; i < currentTrackIndex; i += 1) {
          state.player.removeTrack(i);
        }
      }, 1000);

      return {
        currentSong: nextSongPath,
        currentSongMetadata: nextSongMetadata,
        paused: false,
        shuffleHistory,
        lastPlayedSong: nextSongPath,
      };
    });
  },
  playPreviousSong: async () => {
    return set((state) => {
      if (!state.filteredLibrary) return {};

      const keys = Object.keys(state.filteredLibrary);
      const currentIndex = keys.indexOf(state.currentSong || '');

      // repeating case, start the song over
      if (state.repeating) {
        state.player.setPosition(0);
        return {
          currentSongTime: 0,
        };
      }

      /**
       * @note if the song is past the 3 second mark, restart it.
       * if the song is under the 3 second mark, let them go back.
       * this emulates the behavior of most music players / cd players
       */
      if (!state.paused && state.currentSongTime > 3) {
        state.player.setPosition(0);
        return {
          currentSongTime: 0,
        };
      }

      // shuffle case
      if (state.shuffle && state.shuffleHistory.length > 0) {
        const previousSong =
          state.shuffleHistory[state.shuffleHistory.length - 1];
        state.selectSpecificSong(previousSong, state.filteredLibrary);
        return {
          // @todo: up for debate if we should override the scroll to index
          overrideScrollToIndex: keys.indexOf(previousSong),
          shuffleHistory: state.shuffleHistory.slice(0, -1),
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
  setFilteredLibrary: (filteredLibrary) => set({ filteredLibrary }),
  setCurrentSongTime: (currentSongTime) => set({ currentSongTime }),
  setOverrideScrollToIndex: (overrideScrollToIndex) => {
    return set({ overrideScrollToIndex });
  },
  setShuffleHistory: (shuffleHistory) => set({ shuffleHistory }),
}));

export default usePlayerStore;
