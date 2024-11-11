import { create } from 'zustand';
import { Gapless5 } from '@regosen/gapless-5';
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
}

const usePlayerStore = create<PlayerStore>((set) => ({
  /**
   * default state
   */
  player: new Gapless5(),
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
        console.log('playing');
        state.player.play();
      }
      return { paused };
    });
  },
  // @note: when shuffle is toggled on or off we clear the shuffle history
  setShuffle: (shuffle) => set({ shuffle, shuffleHistory: [] }),
  // @note: repeating does not cause the player's trackList to change
  setRepeating: (repeating) => set({ repeating }),
  // @note: cues up the next song
  selectSpecificSong: (songPath: string, library) => {
    return set((state) => {
      if (!library) {
        // eslint-disable-next-line no-console
        console.error('No library provided to setCurrentSongWithDetails');
        return {};
      }

      const songLibrary = library;
      const metadata = songLibrary[songPath];

      if (!metadata) {
        // eslint-disable-next-line no-console
        console.warn('No metadata found for requested song:', songPath);
        return {};
      }

      const keys = Object.keys(library);
      const currentIndex = keys.indexOf(songPath || '');

      /**
       * @important handle next song in queue
       * @note REPEAT situation is not handled here, it's handled
       * by just calling player.cue() somewhere else
       */
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

      // Set album art on response to request below
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

      // Request album art -- response handler is above
      window.electron.ipcRenderer.sendMessage('get-album-art', songPath);

      state.player.removeAllTracks();
      state.player.addTrack(`my-magic-protocol://getMediaFile/${songPath}`);
      state.player.addTrack(`my-magic-protocol://getMediaFile/${nextSong}`);

      // setup the naviagtor metadata
      const mediaData = {
        title: metadata.common.title,
        artist: metadata.common.artist,
        album: metadata.common.album,
      };

      if (navigator.mediaSession.metadata) {
        Object.assign(navigator.mediaSession.metadata, mediaData);
      } else {
        navigator.mediaSession.metadata = new MediaMetadata(mediaData);
      }

      return {
        currentSong: songPath,
        currentSongMetadata: metadata,
      };
    });
  },
  playNextSong: () => {
    return set((state) => {
      state.player.removeTrack(0);

      /**
       * @important handle putting the next song in track list (spot 1 not 0)
       * @note REPEAT situation is not handled here, it's handled
       * by just calling player.cue() somewhere else
       * @note swapping SHUFFLE or changing the filteredLibrary
       * will cause recalculation of the 2nd song in the track list
       */
      const keys = Object.keys(state.filteredLibrary);
      const currentIndex = keys.indexOf(state.currentSong);
      let nextSong = '';
      if (state.shuffle) {
        const randomIndex = Math.floor(Math.random() * keys.length);
        nextSong = keys[randomIndex];
        state.setOverrideScrollToIndex(randomIndex);
        state.setShuffleHistory([...state.shuffleHistory, state.currentSong]);
        state.player.addTrack(`my-magic-protocol://getMediaFile/${nextSong}`);
      } else {
        const nextIndex =
          currentIndex + 1 >= keys.length ? 0 : currentIndex + 1;
        nextSong = keys[nextIndex];
        state.player.addTrack(`my-magic-protocol://getMediaFile/${nextSong}`);
      }

      console.log(state.player.getTracks());

      return {
        currentSong: nextSong,
        currentSongMetadata: state.filteredLibrary[nextSong],
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
