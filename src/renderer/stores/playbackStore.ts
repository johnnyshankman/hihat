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
import { playbackTracker, updatePlayCount } from '../utils/playbackTracker';

// Create the playback store
const usePlaybackStore = create<PlaybackStore>((set, get) => ({
  // Internal state (not exposed in the context API)
  player: null, // the gapless 5 player instance
  lastPositionUpdateRef: 0, // helps us throttle position updates to once per second
  lastPlaybackTimeUpdateRef: 0, // helps us track actual playback time for play count
  lastPosition: 0, // track the last position to calculate playback time

  // State
  currentTrack: null, // the current track playing
  paused: true, // play pause state
  position: 0, // current position of the playing track in seconds
  duration: 0, // duration of the playing track in seconds
  volume: 1.0, // volume of the global player from 0-1
  playbackSource: 'library', // the source of the playback (library or playlist)
  playbackSourcePlaylistId: null, // the ID of the specific playlist if playbackSource is 'playlist'
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

  selectSpecificSong: (trackId, playbackSource, playlistId = null) => {
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

      // Start tracking play count for the new track
      playbackTracker.startTrackingTrack(trackId);

      return {
        currentTrack: selectedTrack,
        paused: false,
        position: 0,
        lastPosition: 0,
        lastPlaybackTimeUpdateRef: Date.now(),
        duration: selectedTrack.duration,
        shuffleHistory,
        playbackSource,
        playbackSourcePlaylistId:
          playbackSource === 'playlist' ? playlistId : null,
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
        // For repeat track mode, start from the beginning
        state.player.setPosition(0);

        // When restarting the same track, reset our tracking for it
        if (state.currentTrack) {
          playbackTracker.resetTrack(state.currentTrack.id);
        }

        return {
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
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

      // Start tracking play count for the new track
      playbackTracker.startTrackingTrack(nextSong.id);

      return {
        currentTrack: nextSong,
        position: 0,
        lastPosition: 0,
        lastPlaybackTimeUpdateRef: Date.now(),
        duration: nextSong.duration,
        shuffleHistory,
      };
    });
  },

  skipToPreviousTrack: () => {
    return set((state) => {
      if (!state.player) {
        throw new Error('No player found while skipping to previous song');
      }

      // If we're less than 3 seconds into the song, go to previous track
      // Otherwise, restart the current track
      if (state.position <= 3) {
        if (!state.currentTrack) {
          throw new Error(
            'No current track found while skipping to previous song',
          );
        }

        // Find the previous song
        const previousSong = findPreviousSong(
          state.currentTrack.id,
          state.shuffleMode,
          state.playbackSource,
          state.repeatMode,
          state.shuffleHistory,
        );

        if (!previousSong) {
          // If no previous song, restart the current one
          state.player.setPosition(0);
          // Reset tracking for current track
          if (state.currentTrack) {
            playbackTracker.resetTrack(state.currentTrack.id);
          }

          return {
            position: 0,
            lastPosition: 0,
            lastPlaybackTimeUpdateRef: Date.now(),
          };
        }

        // We found a previous song, so play it
        // Calculate the song to play after this one (which is the current track)
        const futureNextSong = state.currentTrack;

        // First pause current playback
        state.player.pause();
        state.player.removeAllTracks();

        // Add the previous song and the current song (as the next track)
        state.player.addTrack(getTrackUrl(previousSong.filePath));
        state.player.addTrack(getTrackUrl(futureNextSong.filePath));

        if (!state.paused) {
          state.player.play();
          const audioElement = document.querySelector('audio');
          if (audioElement) {
            audioElement.play();
          }
        }

        updateMediaSession(previousSong);

        // Start tracking play count for the previous track
        playbackTracker.startTrackingTrack(previousSong.id);

        return {
          currentTrack: previousSong,
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
          duration: previousSong.duration,
          // Remove this track from shuffle history if it's there
          shuffleHistory: state.shuffleHistory.filter(
            (t) => t.id !== previousSong.id,
          ),
        };
      }
      // Restart the current track
      state.player.setPosition(0);

      // Reset tracking for current track
      if (state.currentTrack) {
        playbackTracker.resetTrack(state.currentTrack.id);
      }

      return {
        position: 0,
        lastPosition: 0,
        lastPlaybackTimeUpdateRef: Date.now(),
      };
    });
  },

  toggleRepeatMode: () => {
    return set((state) => {
      // Cycle through repeat modes: off -> track -> all -> off
      const modes: ('off' | 'track' | 'all')[] = ['off', 'track', 'all'];
      const currentIndex = modes.indexOf(state.repeatMode);
      const nextIndex = (currentIndex + 1) % modes.length;
      return { repeatMode: modes[nextIndex] };
    });
  },

  toggleShuffleMode: () => {
    return set((state) => {
      return { shuffleMode: !state.shuffleMode, shuffleHistory: [] };
    });
  },

  setPaused: (paused: boolean) => {
    return set((state) => {
      if (!state.player) {
        throw new Error('No player found while setting paused');
      }

      // If we're pausing, update play count tracking first
      if (paused && !state.paused && state.currentTrack) {
        const now = Date.now();
        const lastUpdate = state.lastPlaybackTimeUpdateRef;
        const secondsPlayed = Math.floor((now - lastUpdate) / 1000);

        if (secondsPlayed > 0) {
          // Update tracking with the actual playback time since last update
          const shouldCountPlay = playbackTracker.updateListenTime(
            state.currentTrack.id,
            secondsPlayed,
          );

          // If we crossed the 30-second threshold, update the play count
          if (shouldCountPlay) {
            updatePlayCount(state.currentTrack.id);
          }
        }
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

        // Reset the playback time tracker when resuming
        return {
          paused,
          lastPlaybackTimeUpdateRef: Date.now(),
          lastPosition: state.position,
        };
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
        // Track is finished naturally
        // NOTE: We should NOT unconditionally update play count here
        // We only count plays when the 30-second threshold is met
        // Which is handled by the playbackTracker's updateListenTime method

        get().autoPlayNextTrack();
      };

      player.onplay = () => {
        set({
          paused: false,
          lastPlaybackTimeUpdateRef: Date.now(),
          lastPosition: get().position,
        });
      };

      player.onpause = () => {
        // When pausing, update playback tracking
        const currentState = get();
        if (!currentState.paused && currentState.currentTrack) {
          const now = Date.now();
          const lastUpdate = currentState.lastPlaybackTimeUpdateRef;
          const secondsPlayed = Math.floor((now - lastUpdate) / 1000);

          if (secondsPlayed > 0) {
            // Update tracking with the actual playback time
            const shouldCountPlay = playbackTracker.updateListenTime(
              currentState.currentTrack.id,
              secondsPlayed,
            );

            // If we crossed the 30-second threshold, update the play count
            if (shouldCountPlay) {
              updatePlayCount(currentState.currentTrack.id);
            }
          }
        }

        set({ paused: true });
      };

      player.ontimeupdate = (time) => {
        // Throttle position updates to once per second
        const now = Date.now();
        const lastUpdate = get().lastPositionUpdateRef;
        const currentPosition = Math.floor(time / 1000);

        if (now - lastUpdate >= 1000) {
          // Update position
          set({
            lastPositionUpdateRef: now,
            // Convert from milliseconds to seconds
            position: currentPosition,
          });

          // Handle tracking actual playback time for play count
          const currentState = get();
          if (!currentState.paused && currentState.currentTrack) {
            const lastPlaybackUpdate = currentState.lastPlaybackTimeUpdateRef;
            const { lastPosition } = currentState;

            // Check if at least a second has passed since the last update
            if (now - lastPlaybackUpdate >= 1000) {
              // Calculate actual time played - handle seeking by checking position changes
              // Only count if position has actually increased (real playback, not seeking)
              if (currentPosition > lastPosition) {
                const secondsPlayed = currentPosition - lastPosition;

                // Update tracking with the actual playback time
                const shouldCountPlay = playbackTracker.updateListenTime(
                  currentState.currentTrack.id,
                  secondsPlayed,
                );

                // If we crossed the 30-second threshold, update the play count
                if (shouldCountPlay) {
                  updatePlayCount(currentState.currentTrack.id);
                }
              }

              // Update our tracking state
              set({
                lastPlaybackTimeUpdateRef: now,
                lastPosition: currentPosition,
              });
            }
          }
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

      // Before seeking, update play count tracking with time played so far
      if (!state.paused && state.currentTrack) {
        const now = Date.now();
        const lastUpdate = state.lastPlaybackTimeUpdateRef;
        const secondsPlayed = Math.floor((now - lastUpdate) / 1000);

        if (secondsPlayed > 0) {
          // Only count if position has actually increased (real playback, not seeking)
          if (state.position > state.lastPosition) {
            // Update tracking with the actual playback time
            const shouldCountPlay = playbackTracker.updateListenTime(
              state.currentTrack.id,
              secondsPlayed,
            );

            // If we crossed the 30-second threshold, update the play count
            if (shouldCountPlay) {
              updatePlayCount(state.currentTrack.id);
            }
          }
        }
      }

      state.player.setPosition(position * 1000);
      return {
        position,
        lastPosition: position,
        lastPlaybackTimeUpdateRef: Date.now(),
      };
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

        // For repeat track mode, reset tracking for the current track
        if (state.currentTrack) {
          playbackTracker.resetTrack(state.currentTrack.id);
        }

        return {
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
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

      // Start tracking play count for the new track
      playbackTracker.startTrackingTrack(currentTrackThatIsAudiblyPlaying.id);

      // We need to create a small delay between track changes to avoid the 2-second offset issue
      // The player is already playing the next track at this point
      // This ensures we start tracking from the proper position
      const timeUpdateDelay = Date.now() - 1000; // Small delay of 100ms

      return {
        currentTrack: currentTrackThatIsAudiblyPlaying,
        duration: currentTrackThatIsAudiblyPlaying.duration,
        paused: false,
        position: 0,
        lastPosition: 0,
        lastPlaybackTimeUpdateRef: timeUpdateDelay,
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
