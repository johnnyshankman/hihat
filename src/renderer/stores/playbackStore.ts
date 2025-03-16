import { create } from 'zustand';
import { Gapless5 } from '@regosen/gapless-5';
import { Track } from '../../types/dbTypes';
import { PlaybackStore } from './types';
import useLibraryStore from './libraryStore';
import {
  findNextSong,
  findPreviousSong,
  getFilePathFromTrackUrl,
  getTrackUrl,
  updateMediaSession,
} from '../utils/trackSelectionUtils';

// Create the playback store
const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  // Internal state (not exposed in the context API)
  player: null, // the gapless 5 player instance
  lastPositionUpdateRef: 0, // helps us throttle position updates to once per second

  // State
  currentTrack: null, // the current track playing
  paused: true, // play pause state
  position: 0, // current position of the playing track in seconds
  duration: 0, // duration of the playing track in seconds
  volume: 1.0, // volume of the global player from 0-1
  playbackSource: 'library', // the source of the playback (library or playlist)
  repeatMode: 'off', // off, track, all
  shuffleMode: false, // shuffle mode
  shuffleHistory: [], // history of shuffled tracks

  // Player store actions
  setVolume: (volume) => {
    return set((state) => {
      if (!state.player) {
        throw new Error('No player found while setting volume');
      }
      state.player.setVolume(volume);
      return { volume };
    });
  },

  selectSpecificSong: (trackId, playbackSource) => {
    return set((state) => {
      if (!state.player) {
        throw new Error('No player found while selecting specific song');
      }

      const library = useLibraryStore.getState().tracks;

      const selectedTrack = library.find((t) => t.id === trackId);

      if (!selectedTrack) {
        throw new Error('No track found while selecting specific song');
      }

      // Update shuffle history if needed, never longer than 100 items
      let shuffleHistory: Track[] = [];
      if (state.shuffleMode) {
        shuffleHistory = [...state.shuffleHistory, selectedTrack];
        if (shuffleHistory.length > 100) {
          shuffleHistory.shift();
        }
      }

      const nextSong = findNextSong(
        trackId,
        state.shuffleMode,
        playbackSource,
        state.repeatMode,
      );

      state.player.pause();
      state.player.removeAllTracks();
      state.player.addTrack(getTrackUrl(selectedTrack.filePath));
      if (nextSong) {
        state.player.addTrack(getTrackUrl(nextSong.filePath));
      }
      state.player.play();
      const audioElement = document.querySelector('audio');
      if (audioElement) {
        audioElement.play();
      }

      updateMediaSession(selectedTrack);

      return {
        currentTrack: selectedTrack,
        paused: false,
        position: 0,
        duration: selectedTrack.duration,
        shuffleHistory,
        playbackSource,
      };
    });
  },

  /**
   * Used for when you want to skip to the next song without
   * having to wait for the current song to finish.
   */
  skipToNextTrack: () => {
    return set((state) => {
      if (!state.player) {
        throw new Error('No player found while skipping to next song');
      }

      if (state.repeatMode === 'track') {
        state.player.setPosition(0);
        return {
          position: 0,
          hasIncreasedPlayCount: false,
        };
      }

      if (!state.currentTrack) {
        throw new Error('No current track found while skipping to next song');
      }

      // @todo: make it take into account repeat mode 'all'
      const nextSong = findNextSong(
        state.currentTrack?.id,
        state.shuffleMode,
        state.playbackSource,
        state.repeatMode,
      );

      if (!nextSong) {
        return {};
      }

      // Update shuffle history if needed, never longer than 100 items
      let shuffleHistory: Track[] = [];
      if (state.shuffleMode) {
        shuffleHistory = [...state.shuffleHistory, state.currentTrack];
        if (shuffleHistory.length > 100) {
          shuffleHistory.shift();
        }
      }

      // Calculate the song to play after this one
      const futureNextSong = findNextSong(
        nextSong.id,
        state.shuffleMode,
        state.playbackSource,
        state.repeatMode,
      );

      // First pause current playback
      state.player.pause();
      state.player.removeAllTracks();

      // Add the next song and future next song
      state.player.addTrack(getTrackUrl(nextSong.filePath));
      if (futureNextSong) {
        state.player.addTrack(getTrackUrl(futureNextSong.filePath));
      }

      if (!state.paused) {
        state.player.play();
        const audioElement = document.querySelector('audio');
        if (audioElement) {
          audioElement.play();
        }
      }

      updateMediaSession(nextSong);

      return {
        currentTrack: nextSong,
        position: 0,
        duration: nextSong.duration,
        shuffleHistory,
        paused: false,
      };
    });
  },

  skipToPreviousTrack: async () => {
    return set((state) => {
      if (!state.player) {
        throw new Error('No player found while skipping to previous song');
      }

      if (!state.currentTrack) {
        throw new Error(
          'No current track found while skipping to previous song',
        );
      }

      // repeating case, start the song over and over and over
      if (state.repeatMode === 'track') {
        state.player.setPosition(0);
        return {
          position: 0,
        };
      }

      /**
       * @note if the song is past the 3 second mark, restart it.
       * this emulates the behavior of most music players / cd players
       */
      if (state.position > 3) {
        state.player.setPosition(0);

        return {
          position: 0,
          hasIncreasedPlayCount: false,
        };
      }

      // shuffle case
      if (state.shuffleMode && state.shuffleHistory.length > 0) {
        const previousSong =
          state.shuffleHistory[state.shuffleHistory.length - 1];
        state.selectSpecificSong(previousSong.id, state.playbackSource);

        return {
          shuffleHistory: state.shuffleHistory.slice(0, -1),
          hasIncreasedPlayCount: false,
        };
      }

      // find the previous song in the library
      const prevSong = findPreviousSong(
        state.currentTrack?.id,
        state.playbackSource,
        state.repeatMode,
      );

      if (!prevSong) {
        return {};
      }

      state.selectSpecificSong(prevSong.id, state.playbackSource);
      // @note: selectSpecificSong does all the heavy lifting for us
      // so we don't need to return anything here
      return {};
    });
  },

  toggleShuffleMode: () => {
    return set((state) => {
      if (!state.currentTrack) {
        throw new Error('No current track found while toggling shuffle mode');
      }
      if (!state.playbackSource) {
        throw new Error('No playback source found while toggling shuffle mode');
      }
      if (!state.player) {
        throw new Error('No player found while toggling shuffle mode');
      }

      const newShuffleMode = !state.shuffleMode;

      const nextSong = findNextSong(
        state.currentTrack?.id,
        newShuffleMode,
        state.playbackSource,
        state.repeatMode,
      );

      // Get the current track index
      const currentIndex = state.player.getIndex();

      if (!nextSong) {
        throw new Error('No next song found while toggling shuffle mode');
      }

      // Replace the last track with the new next song
      state.player.replaceTrack(
        currentIndex + 1,
        getTrackUrl(nextSong.filePath),
      );

      // cleare the shuffle history
      return { shuffleMode: newShuffleMode, shuffleHistory: [] };
    });
  },

  toggleRepeatMode: () => {
    return set((state) => {
      // cycle between off, track, all
      const newRepeatMode =
        // eslint-disable-next-line no-nested-ternary
        state.repeatMode === 'off'
          ? 'track'
          : state.repeatMode === 'track'
            ? 'all'
            : 'off';
      return { repeatMode: newRepeatMode };
    });
  },

  setPaused: (paused: boolean) => {
    return set((state) => {
      if (!state.player) {
        throw new Error('No player found while setting paused');
      }

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

  // Helper function to get the player instance
  initPlayer: () => {
    const state = get();
    // lazily initialize the player
    if (!state.player) {
      const player = new Gapless5({
        useHTML5Audio: false,
        crossfade: 25, // 25ms crossfade between tracks
        exclusive: true, // Only one track can play at a time
        loadLimit: 3, // Load up to 3 tracks at a time
      });

      // Set up error handler
      player.onerror = (error: string) => {
        console.error('Audio player error:', error);
      };

      // Set up event handlers
      player.onfinishedtrack = () => {
        get().autoPlayNextTrack();
      };

      player.onplay = () => {
        set({ paused: false });
      };

      player.onpause = () => {
        set({ paused: true });
      };

      player.ontimeupdate = (time) => {
        // Throttle position updates to once per second
        const now = Date.now();
        const lastUpdate = get().lastPositionUpdateRef;
        if (now - lastUpdate >= 1000) {
          set({
            lastPositionUpdateRef: now,
            // Convert from milliseconds to seconds
            position: Math.floor(time / 1000),
          });
        }
      };

      // Set the player ref in state
      set({ player });
    }
  },

  seekToPosition: (position: number) => {
    return set((state) => {
      if (!state.player) {
        throw new Error('No player found while seeking to position');
      }

      state.player.setPosition(position * 1000);
      return { position };
    });
  },

  /**
   *
   * @returns Triggered when a song is finished playing
   * @note the state.currentTrack during this execution is actually the previous song
   * @note the PLAYER's current track however is "actualCurrentTrackThatIsAutoplaying"
   */
  autoPlayNextTrack: async () => {
    return set((state) => {
      if (!state.player) {
        throw new Error('No player found while auto playing next track');
      }

      // at this point the new song is already playing
      if (state.repeatMode === 'track') {
        state.player.gotoTrack(0);
        state.player.play();
        const audioElement = document.querySelector('audio');
        if (audioElement) {
          audioElement.play();
        }
        return {
          position: 0,
        };
      }

      // lets understand what song is currently playing
      const tracks = state.player.getTracks();
      const index = state.player.getIndex();

      // get the song info of the song that is currently playing
      const currentlyAutoplayingSongFilePath = getFilePathFromTrackUrl(
        tracks[index],
      );

      // get the metadata of the song that is currently playing
      const currentTrackThatIsAudiblyPlaying = useLibraryStore
        .getState()
        .tracks.find((t) => t.filePath === currentlyAutoplayingSongFilePath);

      if (!currentTrackThatIsAudiblyPlaying) {
        throw new Error('No next track found while auto playing next track');
      }

      // Calculate the song to play after the song that is already playing now
      const nextSong = findNextSong(
        currentTrackThatIsAudiblyPlaying.id,
        state.shuffleMode,
        state.playbackSource,
        state.repeatMode,
      );

      // Update shuffle history if needed, never longer than 100 items
      let shuffleHistory: Track[] = [];
      if (state.shuffleMode && state.currentTrack) {
        // cleverly shim in the LAST played song into the shuffle history
        // luckicly state.currentTrack is outdate and still holding it
        shuffleHistory = [...state.shuffleHistory, state.currentTrack];
        if (shuffleHistory.length > 100) {
          shuffleHistory.shift();
        }
      }

      if (!nextSong) {
        return {};
      }

      // Add the FUTURE next song to the player queue
      state.player.addTrack(getTrackUrl(nextSong?.filePath));

      // Update media session
      updateMediaSession(currentTrackThatIsAudiblyPlaying);

      return {
        currentTrack: currentTrackThatIsAudiblyPlaying,
        duration: currentTrackThatIsAudiblyPlaying.duration,
        paused: false,
        shuffleHistory,
      };
    });
  },
}));

// Set up event listeners for playback events from the main process
// @TODO: unclear why this is needed
if (typeof window !== 'undefined') {
  window.electron.ipcRenderer.on('playback:trackChanged', (data: any) => {
    usePlaybackStore.setState({ currentTrack: data.track });
  });

  window.electron.ipcRenderer.on('playback:stateChanged', (data: any) => {
    usePlaybackStore.setState({ paused: !data.paused });
  });

  window.electron.ipcRenderer.on('playback:positionChanged', (data: any) => {
    // Convert from milliseconds to seconds
    usePlaybackStore.setState({
      position: data.position / 1000,
      duration: data.duration / 1000,
    });
  });
}

export default usePlaybackStore;
