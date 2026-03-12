import { create } from 'zustand';
import { Gapless5 } from '@regosen/gapless-5';
import { Track, Settings } from '../../types/dbTypes';
import { SettingsAndPlaybackStore } from './types';
import useLibraryStore from './libraryStore';
import useUIStore from './uiStore';
import {
  findNextSong,
  findPreviousSong,
  getFilePathFromTrackUrl,
  getTrackUrl,
  updateMediaSession,
} from '../utils/trackSelectionUtils';
import { playbackTracker, updatePlayCount } from '../utils/playbackTracker';

/**
 * Flush accumulated play-count tracking before a skip operation.
 * This replaces the work that onpause was doing, so we can remove
 * the pause() call from skip paths (which was causing UI flicker).
 */
function flushPlaybackTracking(state: SettingsAndPlaybackStore) {
  if (!state.paused && state.currentTrack) {
    const now = Date.now();
    const lastUpdate = state.lastPlaybackTimeUpdateRef;
    const secondsPlayed = Math.floor((now - lastUpdate) / 1000);
    if (secondsPlayed > 0) {
      const shouldCountPlay = playbackTracker.updateListenTime(
        state.currentTrack.id,
        secondsPlayed,
        state.currentTrack.duration,
      );
      if (shouldCountPlay) {
        updatePlayCount(state.currentTrack.id);
      }
    }
  }
}

// Define the settings and playback store
const useSettingsAndPlaybackStore = create<SettingsAndPlaybackStore>(
  (set, get) => ({
    // Settings state (from settingsStore)
    id: 'app-settings', // db record name never changes
    libraryPath: '',
    theme: 'light',
    lastPlayedSongId: null,
    volume: 1.0,
    columns: {
      title: true,
      artist: true,
      album: true,
      albumArtist: true,
      genre: true,
      duration: true,
      playCount: true,
      dateAdded: true,
      lastPlayed: false,
    },
    columnWidths: null,
    librarySorting: null,
    columnOrder: null,

    // Playback state (from playbackStore)
    currentTrack: null, // the current track playing
    paused: true, // play pause state
    skipInProgress: false, // true while a skip operation is in-flight
    position: 0, // current position of the playing track in seconds
    duration: 0, // duration of the playing track in seconds
    playbackSource: 'library', // the source of the playback (library or playlist)
    playbackSourcePlaylistId: null, // the ID of the specific playlist if playbackSource is 'playlist'
    playbackContextBrowserFilter: null, // the browser filter that was active when playback started
    repeatMode: 'off', // off, track, all
    shuffleMode: false, // shuffle mode
    shuffleHistory: [], // history of shuffled tracks
    shuffleHistoryPosition: -1, // current position in shuffle history (-1 means at the tip)

    // Internal state (from playbackStore)
    player: null, // the gapless 5 player instance
    lastPositionUpdateRef: 0, // helps us throttle position updates to once per second
    lastPlaybackTimeUpdateRef: 0, // helps us track actual playback time for play count
    lastPosition: 0, // track the last position to calculate playback time
    silentAudioRef: null, // reference to the silent audio element for MediaSession support

    // Settings actions
    setLibraryPath: async (libraryPath: Settings['libraryPath']) => {
      try {
        const state = get();

        if (!state.id) {
          throw new Error('Settings not loaded');
        }

        // Update the settings in the database
        const updatedSettings = {
          id: state.id,
          libraryPath,
          theme: state.theme,
          columns: state.columns,
          lastPlayedSongId: state.lastPlayedSongId,
          volume: state.volume,
          columnWidths: state.columnWidths,
          librarySorting: state.librarySorting,
          columnOrder: state.columnOrder,
        };
        await window.electron.settings.update(updatedSettings);

        // Update the settings state
        set({ libraryPath });
      } catch (error) {
        console.error('Error updating library path:', error);
        useUIStore
          .getState()
          .showNotification('Failed to update library path', 'error');
      }
    },

    loadSettings: async () => {
      try {
        const appSettings = await window.electron.settings.get();
        set({
          libraryPath: appSettings.libraryPath,
          theme: appSettings.theme,
          columns: appSettings.columns,
          lastPlayedSongId: appSettings.lastPlayedSongId || null,
          volume: appSettings.volume !== null ? appSettings.volume : 1.0,
          columnWidths: appSettings.columnWidths || null,
          librarySorting: appSettings.librarySorting || null,
          columnOrder: appSettings.columnOrder || null,
        });

        // Propagate persisted library sorting to libraryStore
        if (appSettings.librarySorting) {
          useLibraryStore
            .getState()
            .updateLibraryViewState(
              appSettings.librarySorting,
              useLibraryStore.getState().libraryViewState.filtering,
            );
        }

        // Also make sure we initialize the volume for the player if it exists
        const { player } = get();
        if (player) {
          const volumeValue =
            appSettings.volume !== null ? appSettings.volume : 1.0;
          player.setVolume(volumeValue);
        }

        return appSettings;
      } catch (error) {
        console.error('Error loading settings:', error);
        useUIStore
          .getState()
          .showNotification('Failed to load settings', 'error');
        return {
          libraryPath: '',
          theme: 'light',
          lastPlayedSongId: null,
          volume: 1.0,
          columns: {
            title: true,
            artist: true,
            album: true,
            albumArtist: false,
            genre: true,
            duration: true,
            playCount: true,
            dateAdded: true,
            lastPlayed: false,
          },
          id: 'app-settings',
          columnWidths: null,
          librarySorting: null,
          columnOrder: null,
        };
      }
    },

    setColumnVisibility: async (column: string, isVisible: boolean) => {
      try {
        const state = get();

        if (!state.columns) {
          throw new Error('Settings not loaded');
        }

        // Update the column visibility
        const updatedColumns = {
          ...state.columns,
          [column]: isVisible,
        };

        // Update the settings in the database
        const updatedSettings = {
          id: state.id,
          libraryPath: state.libraryPath,
          theme: state.theme,
          columns: updatedColumns,
          lastPlayedSongId: state.lastPlayedSongId,
          volume: state.volume,
          columnWidths: state.columnWidths,
          librarySorting: state.librarySorting,
          columnOrder: state.columnOrder,
        };
        await window.electron.settings.update(updatedSettings);

        // Update the settings state
        set({ columns: updatedColumns });
      } catch (error) {
        console.error('Error updating column visibility:', error);
        useUIStore
          .getState()
          .showNotification('Failed to update column visibility', 'error');
      }
    },

    setColumnWidths: async (columnWidths: Record<string, number>) => {
      try {
        const state = get();

        if (!state.id) {
          throw new Error('Settings not loaded');
        }

        const updatedSettings = {
          id: state.id,
          libraryPath: state.libraryPath,
          theme: state.theme,
          columns: state.columns,
          lastPlayedSongId: state.lastPlayedSongId,
          volume: state.volume,
          columnWidths,
          librarySorting: state.librarySorting,
          columnOrder: state.columnOrder,
        };
        await window.electron.settings.update(updatedSettings);

        set({ columnWidths });
      } catch (error) {
        console.error('Error updating column widths:', error);
      }
    },

    setLibrarySorting: async (
      sorting: Array<{ id: string; desc: boolean }>,
    ) => {
      try {
        const state = get();

        if (!state.id) {
          throw new Error('Settings not loaded');
        }

        const updatedSettings = {
          id: state.id,
          libraryPath: state.libraryPath,
          theme: state.theme,
          columns: state.columns,
          lastPlayedSongId: state.lastPlayedSongId,
          volume: state.volume,
          columnWidths: state.columnWidths,
          librarySorting: sorting,
          columnOrder: state.columnOrder,
        };
        await window.electron.settings.update(updatedSettings);

        set({ librarySorting: sorting });
      } catch (error) {
        console.error('Error updating library sorting:', error);
      }
    },

    setColumnOrder: async (columnOrder: string[]) => {
      try {
        const state = get();

        if (!state.id) {
          throw new Error('Settings not loaded');
        }

        const updatedSettings = {
          id: state.id,
          libraryPath: state.libraryPath,
          theme: state.theme,
          columns: state.columns,
          lastPlayedSongId: state.lastPlayedSongId,
          volume: state.volume,
          columnWidths: state.columnWidths,
          librarySorting: state.librarySorting,
          columnOrder,
        };
        await window.electron.settings.update(updatedSettings);

        set({ columnOrder });
      } catch (error) {
        console.error('Error updating column order:', error);
      }
    },

    setTheme: async (theme: 'light' | 'dark') => {
      try {
        const state = get();

        if (!state.id) {
          throw new Error('Settings not loaded');
        }

        // Update the settings in the database
        const updatedSettings = {
          id: state.id,
          libraryPath: state.libraryPath,
          theme,
          columns: state.columns,
          lastPlayedSongId: state.lastPlayedSongId,
          volume: state.volume,
          columnWidths: state.columnWidths,
          librarySorting: state.librarySorting,
          columnOrder: state.columnOrder,
        };
        await window.electron.settings.update(updatedSettings);

        // Update the settings state
        set({ theme });
      } catch (error) {
        console.error('Error updating theme:', error);
        useUIStore
          .getState()
          .showNotification('Failed to update theme', 'error');
      }
    },

    setLastPlayedSongId: async (trackId: string | null) => {
      try {
        const state = get();

        if (!state.id) {
          throw new Error('Settings not loaded');
        }

        // Update the settings in the database
        const updatedSettings = {
          id: state.id,
          libraryPath: state.libraryPath,
          theme: state.theme,
          columns: state.columns,
          lastPlayedSongId: trackId,
          volume: state.volume,
          columnWidths: state.columnWidths,
          librarySorting: state.librarySorting,
          columnOrder: state.columnOrder,
        };
        await window.electron.settings.update(updatedSettings);

        // Update the settings state
        set({ lastPlayedSongId: trackId });
      } catch (error) {
        console.error('Error updating last played song ID:', error);
        useUIStore
          .getState()
          .showNotification('Failed to update last played song', 'error');
      }
    },

    // Playback actions
    setSilentAudioRef: (ref) => {
      return set({ silentAudioRef: ref });
    },

    setVolume: (volume) => {
      return set((state) => {
        if (state.player) {
          state.player.setVolume(volume);
        }

        // Also update volume in settings DB
        try {
          const updatedSettings = {
            id: state.id,
            libraryPath: state.libraryPath,
            theme: state.theme,
            columns: state.columns,
            lastPlayedSongId: state.lastPlayedSongId,
            volume,
            columnWidths: state.columnWidths,
            librarySorting: state.librarySorting,
            columnOrder: state.columnOrder,
          };
          window.electron.settings.update(updatedSettings);
        } catch (error) {
          console.error('Error updating volume in settings:', error);
        }

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
        let shuffleHistoryPosition = -1;
        if (state.shuffleMode) {
          // Clear history if changing playback source or playlist
          const sourceChanged =
            playbackSource !== state.playbackSource ||
            (playbackSource === 'playlist' &&
              playlistId !== state.playbackSourcePlaylistId);

          if (sourceChanged) {
            // Starting fresh with new source
            shuffleHistory = [selectedTrack];
            shuffleHistoryPosition = 0;
          } else {
            // Same source, maintain history
            // If we're in the middle of history, truncate everything after our position
            if (
              state.shuffleHistoryPosition >= 0 &&
              state.shuffleHistoryPosition < state.shuffleHistory.length - 1
            ) {
              shuffleHistory = state.shuffleHistory.slice(
                0,
                state.shuffleHistoryPosition + 1,
              );
            } else {
              shuffleHistory = [...state.shuffleHistory];
            }

            // Add the selected track
            shuffleHistory.push(selectedTrack);
            shuffleHistoryPosition = shuffleHistory.length - 1;

            if (shuffleHistory.length > 100) {
              shuffleHistory.shift();
              shuffleHistoryPosition = Math.max(0, shuffleHistoryPosition - 1);
            }
          }
        }

        // Capture the current browser filter at the time of playback
        const viewId =
          playbackSource === 'library' ? 'library' : playlistId || 'library';
        const browserFilter = useLibraryStore
          .getState()
          .getBrowserFilter(viewId);

        const nextSong = findNextSong(
          trackId,
          state.shuffleMode,
          playbackSource,
          state.repeatMode,
          browserFilter.artist,
          state.shuffleHistory,
          browserFilter.album,
        );

        state.player.pause();
        state.player.removeAllTracks();
        state.player.addTrack(getTrackUrl(selectedTrack.filePath));
        if (nextSong) {
          state.player.addTrack(getTrackUrl(nextSong.filePath));
        }
        state.player.play();

        // Play the silent audio for MediaSession
        if (state.silentAudioRef) {
          state.silentAudioRef.play().catch((error) => {
            console.error('Error playing silent audio:', error);
          });
        }

        updateMediaSession(selectedTrack);

        // Start tracking play count for the new track
        playbackTracker.startTrackingTrack(trackId);

        // Save the track ID as the last played song
        get().setLastPlayedSongId(trackId);

        return {
          currentTrack: selectedTrack,
          paused: false,
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
          duration: selectedTrack.duration,
          shuffleHistory,
          shuffleHistoryPosition,
          playbackSource,
          playbackSourcePlaylistId:
            playbackSource === 'playlist' ? playlistId : null,
          playbackContextBrowserFilter: browserFilter, // Store the browser filter context
        };
      });
    },

    skipToNextTrack: () => {
      return set((state) => {
        if (!state.player) {
          throw new Error('No player found while skipping to next song');
        }

        // Guard against rapid skip clicks while a skip is still loading
        if (state.skipInProgress) {
          return {};
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

        // If in shuffle mode
        if (state.shuffleMode) {
          // Check if we're navigating within history (not at the tip)
          if (
            state.shuffleHistoryPosition >= 0 &&
            state.shuffleHistoryPosition < state.shuffleHistory.length - 1
          ) {
            // Move forward in shuffle history
            const newPosition = state.shuffleHistoryPosition + 1;
            const nextSong = state.shuffleHistory[newPosition];

            if (nextSong) {
              // Calculate the song after this one in history
              const futureNextSong = state.shuffleHistory[newPosition + 1];

              flushPlaybackTracking(state);
              state.player.removeAllTracks();

              // Add the next song and future next song if it exists
              state.player.addTrack(getTrackUrl(nextSong.filePath));
              if (futureNextSong) {
                state.player.addTrack(getTrackUrl(futureNextSong.filePath));
              }

              if (!state.paused) {
                state.player.play();
                // Play the silent audio for MediaSession
                if (state.silentAudioRef) {
                  state.silentAudioRef.play().catch((error) => {
                    console.error('Error playing silent audio:', error);
                  });
                }
              }

              updateMediaSession(nextSong);

              // Start tracking play count for the new track
              playbackTracker.startTrackingTrack(nextSong.id);

              // Save the track ID as the last played song
              get().setLastPlayedSongId(nextSong.id);

              return {
                currentTrack: nextSong,
                position: 0,
                lastPosition: 0,
                lastPlaybackTimeUpdateRef: Date.now(),
                duration: nextSong.duration,
                shuffleHistoryPosition: newPosition,
                skipInProgress: !state.paused,
              };
            }
          }

          // We're at the tip of history, need to get a new random song
          // Use the playback context artist filter, not the current one
          const artistFilter =
            state.playbackContextBrowserFilter?.artist || null;
          const albumFilter = state.playbackContextBrowserFilter?.album || null;

          const nextSong = findNextSong(
            state.currentTrack?.id,
            state.shuffleMode,
            state.playbackSource,
            state.repeatMode,
            artistFilter,
            state.shuffleHistory,
            albumFilter,
          );

          if (!nextSong) {
            return {};
          }

          // Check if we need to clear history (when all songs have been played with repeat all)
          // Get total available tracks to determine if we've played them all
          const library = useLibraryStore.getState().tracks;
          const { playlists } = useLibraryStore.getState();
          let totalAvailableTracks = 0;

          if (state.playbackSource === 'library') {
            let filtered = library;
            if (artistFilter) {
              filtered = filtered.filter(
                (t) =>
                  (t.albumArtist || t.artist || 'Unknown Artist') ===
                  artistFilter,
              );
            }
            if (albumFilter) {
              filtered = filtered.filter(
                (t) => (t.album || 'Unknown Album') === albumFilter,
              );
            }
            totalAvailableTracks = filtered.length;
          } else if (state.playbackSource === 'playlist') {
            const playlist = playlists.find(
              (p) => p.id === state.playbackSourcePlaylistId,
            );
            totalAvailableTracks = playlist?.trackIds.length || 0;
          }

          const allTracksPlayed =
            state.shuffleHistory.length >= totalAvailableTracks - 1;

          // Add current track to history and new track
          let shuffleHistory =
            allTracksPlayed && state.repeatMode === 'all'
              ? [] // Clear history when starting over with repeat all
              : [...state.shuffleHistory];

          // If we were in the middle of history, truncate everything after our position
          if (
            state.shuffleHistoryPosition >= 0 &&
            state.shuffleHistoryPosition < shuffleHistory.length - 1
          ) {
            shuffleHistory = shuffleHistory.slice(
              0,
              state.shuffleHistoryPosition + 1,
            );
          }

          // Add the current track if not already at the end
          if (
            shuffleHistory.length === 0 ||
            shuffleHistory[shuffleHistory.length - 1].id !==
              state.currentTrack.id
          ) {
            shuffleHistory.push(state.currentTrack);
          }

          // Add the new next song
          shuffleHistory.push(nextSong);

          // Keep history limited to 100 items
          if (shuffleHistory.length > 100) {
            shuffleHistory.shift();
          }

          // Calculate the song to play after this one
          const futureNextSong = findNextSong(
            nextSong.id,
            state.shuffleMode,
            state.playbackSource,
            state.repeatMode,
            artistFilter,
            [...state.shuffleHistory, state.currentTrack, nextSong].filter(
              Boolean,
            ),
            albumFilter,
          );

          flushPlaybackTracking(state);
          state.player.removeAllTracks();

          // Add the next song and future next song
          state.player.addTrack(getTrackUrl(nextSong.filePath));
          if (futureNextSong) {
            state.player.addTrack(getTrackUrl(futureNextSong.filePath));
          }

          if (!state.paused) {
            state.player.play();
            // Play the silent audio for MediaSession
            if (state.silentAudioRef) {
              state.silentAudioRef.play().catch((error) => {
                console.error('Error playing silent audio:', error);
              });
            }
          }

          updateMediaSession(nextSong);

          // Start tracking play count for the new track
          playbackTracker.startTrackingTrack(nextSong.id);

          // Save the track ID as the last played song
          get().setLastPlayedSongId(nextSong.id);

          return {
            currentTrack: nextSong,
            position: 0,
            lastPosition: 0,
            lastPlaybackTimeUpdateRef: Date.now(),
            duration: nextSong.duration,
            shuffleHistory,
            shuffleHistoryPosition: shuffleHistory.length - 1, // Now at the new tip
            skipInProgress: !state.paused,
          };
        }

        // Non-shuffle mode - standard behavior
        // Use the playback context browser filter, not the current one
        const artistFilter = state.playbackContextBrowserFilter?.artist || null;
        const albumFilter = state.playbackContextBrowserFilter?.album || null;

        const nextSong = findNextSong(
          state.currentTrack?.id,
          state.shuffleMode,
          state.playbackSource,
          state.repeatMode,
          artistFilter,
          state.shuffleHistory,
          albumFilter,
        );

        if (!nextSong) {
          return {};
        }

        // Calculate the song to play after this one
        const futureNextSong = findNextSong(
          nextSong.id,
          state.shuffleMode,
          state.playbackSource,
          state.repeatMode,
          artistFilter,
          state.shuffleHistory,
          albumFilter,
        );

        flushPlaybackTracking(state);

        // Check if next track is already pre-loaded at queue index 1
        const queuedTracks = state.player.getTracks();
        const preloadedUrl = queuedTracks.length > 1 ? queuedTracks[1] : null;
        const nextSongUrl = getTrackUrl(nextSong.filePath);

        // Only use the fast path if the pre-loaded source has finished loading.
        // If still loading, gotoTrack's internal stopAllTracks transitions the
        // source from Loading to Stop, causing play() to fail silently because
        // it tries playAudioFile() with no loaded data instead of queuing.
        // Gapless5State: None=0, Loading=1, Starting=2, Play=3, Stop=4, Error=5
        const GAPLESS5_LOADING = 1;
        const preloadedSource =
          queuedTracks.length > 1 ? state.player.playlist.sources[1] : null;
        const isPreloadReady =
          preloadedSource && preloadedSource.getState() !== GAPLESS5_LOADING;

        if (preloadedUrl === nextSongUrl && isPreloadReady) {
          // FAST PATH: switch to already-buffered track (no load delay)
          state.player.gotoTrack(1);
          state.player.removeTrack(0);
          if (futureNextSong) {
            state.player.addTrack(getTrackUrl(futureNextSong.filePath));
          }
        } else {
          // SLOW PATH: queue doesn't match, rebuild
          state.player.removeAllTracks();
          state.player.addTrack(nextSongUrl);
          if (futureNextSong) {
            state.player.addTrack(getTrackUrl(futureNextSong.filePath));
          }
          if (!state.paused) {
            state.player.play();
          }
        }

        if (!state.paused && state.silentAudioRef) {
          state.silentAudioRef.play().catch((error) => {
            console.error('Error playing silent audio:', error);
          });
        }

        updateMediaSession(nextSong);

        // Start tracking play count for the new track
        playbackTracker.startTrackingTrack(nextSong.id);

        // Save the track ID as the last played song
        get().setLastPlayedSongId(nextSong.id);

        return {
          currentTrack: nextSong,
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
          duration: nextSong.duration,
          skipInProgress: !state.paused,
        };
      });
    },

    skipToPreviousTrack: () => {
      return set((state) => {
        if (!state.player) {
          throw new Error('No player found while skipping to previous song');
        }

        // Guard against rapid skip clicks while a skip is still loading
        if (state.skipInProgress) {
          return {};
        }

        // If we're less than 3 seconds into the song, go to previous track
        // Otherwise, restart the current track
        if (state.position <= 3) {
          if (!state.currentTrack) {
            throw new Error(
              'No current track found while skipping to previous song',
            );
          }

          // If in shuffle mode and we can go back in history
          if (state.shuffleMode && state.shuffleHistoryPosition > 0) {
            // Move backward in shuffle history
            const newPosition = state.shuffleHistoryPosition - 1;
            const previousSong = state.shuffleHistory[newPosition];

            if (previousSong) {
              // Calculate the next song (which is the current position in history)
              const futureNextSong =
                state.shuffleHistory[state.shuffleHistoryPosition];

              flushPlaybackTracking(state);
              state.player.removeAllTracks();

              // Add the previous song and the current song (as the next track)
              state.player.addTrack(getTrackUrl(previousSong.filePath));
              if (futureNextSong) {
                state.player.addTrack(getTrackUrl(futureNextSong.filePath));
              }

              if (!state.paused) {
                state.player.play();
                // Play the silent audio for MediaSession
                if (state.silentAudioRef) {
                  state.silentAudioRef.play().catch((error) => {
                    console.error('Error playing silent audio:', error);
                  });
                }
              }

              updateMediaSession(previousSong);

              // Start tracking play count for the previous track
              playbackTracker.startTrackingTrack(previousSong.id);

              // Save the track ID as the last played song
              get().setLastPlayedSongId(previousSong.id);

              return {
                currentTrack: previousSong,
                position: 0,
                lastPosition: 0,
                lastPlaybackTimeUpdateRef: Date.now(),
                duration: previousSong.duration,
                shuffleHistoryPosition: newPosition,
                skipInProgress: !state.paused,
              };
            }
          }

          // Find the previous song (for non-shuffle or when at beginning of history)
          // Use the playback context artist filter, not the current one
          const artistFilter =
            state.playbackContextBrowserFilter?.artist || null;
          const albumFilter = state.playbackContextBrowserFilter?.album || null;

          const previousSong = findPreviousSong(
            state.currentTrack.id,
            false, // Don't use shuffle history in findPreviousSong since we handle it above
            state.playbackSource,
            state.repeatMode,
            [], // Empty shuffle history since we handle it above
            artistFilter,
            albumFilter,
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

          flushPlaybackTracking(state);
          state.player.removeAllTracks();

          // Add the previous song and the current song (as the next track)
          state.player.addTrack(getTrackUrl(previousSong.filePath));
          state.player.addTrack(getTrackUrl(futureNextSong.filePath));

          if (!state.paused) {
            state.player.play();
            // Play the silent audio for MediaSession
            if (state.silentAudioRef) {
              state.silentAudioRef.play().catch((error) => {
                console.error('Error playing silent audio:', error);
              });
            }
          }

          updateMediaSession(previousSong);

          // Start tracking play count for the previous track
          playbackTracker.startTrackingTrack(previousSong.id);

          // Save the track ID as the last played song
          get().setLastPlayedSongId(previousSong.id);

          return {
            currentTrack: previousSong,
            position: 0,
            lastPosition: 0,
            lastPlaybackTimeUpdateRef: Date.now(),
            duration: previousSong.duration,
            skipInProgress: !state.paused,
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

        const repeatMode = modes[nextIndex];

        /**
         * @important Leverage the Gapless5 player's singleMode to achive perfect
         * repeating in single song repeat mode.
         * We dont do this programmatically in the autoPlayNextTrack/skipToNextTrack methods
         * like we do with repeat mode 'all' or 'none' because it would break the gapless playback.
         */
        if (repeatMode === 'track') {
          if (state.player) {
            state.player.singleMode = true;
          }
        } else if (state.player) {
          state.player.singleMode = false;
        }

        return { repeatMode, player: state.player };
      });
    },

    toggleShuffleMode: () => {
      return set((state) => {
        return {
          shuffleMode: !state.shuffleMode,
          shuffleHistory: [],
          shuffleHistoryPosition: -1,
        };
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
              state.currentTrack.duration,
            );

            // If we crossed the play count threshold, update the play count
            if (shouldCountPlay) {
              updatePlayCount(state.currentTrack.id);
            }
          }
        }

        if (paused) {
          state.player.pause();
          // Pause the silent audio for MediaSession
          if (state.silentAudioRef) {
            state.silentAudioRef.pause();
          }
        } else {
          state.player.play();
          // Play the silent audio for MediaSession
          if (state.silentAudioRef) {
            state.silentAudioRef.play().catch((error) => {
              console.error('Error playing silent audio:', error);
            });
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
          volume: state.volume,
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
            skipInProgress: false,
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
                currentState.currentTrack.duration,
              );

              // If we crossed the play count threshold, update the play count
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
                    currentState.currentTrack.duration,
                  );

                  // If we crossed the play count threshold, update the play count
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
                state.currentTrack.duration,
              );

              // If we crossed the play count threshold, update the play count
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

    autoPlayNextTrack: async () => {
      return set((state) => {
        if (!state.player) {
          throw new Error('No player found while auto playing next track');
        }

        // at this point the new song is already playing
        if (state.repeatMode === 'track') {
          // so go back to the track we were just playing and play it again
          state.player.gotoTrack(0);
          state.player.play();

          // Play the silent audio for MediaSession
          if (state.silentAudioRef) {
            state.silentAudioRef.play().catch((error) => {
              console.error('Error playing silent audio:', error);
            });
          }

          // For repeat track mode, reset tracking for the current track
          if (state.currentTrack) {
            playbackTracker.resetTrack(state.currentTrack.id);
          }

          return {
            position: 0,
            lastPosition: 0,
            paused: false,
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

        // Handle shuffle mode with history
        if (state.shuffleMode) {
          // Check if we're navigating within history
          if (
            state.shuffleHistoryPosition >= 0 &&
            state.shuffleHistoryPosition < state.shuffleHistory.length - 1
          ) {
            // We're in the middle of history, move forward
            const newPosition = state.shuffleHistoryPosition + 1;
            const nextTrackInHistory = state.shuffleHistory[newPosition];

            // Add the next song from history
            if (nextTrackInHistory) {
              const futureNextSong = state.shuffleHistory[newPosition + 1];
              if (futureNextSong) {
                state.player.addTrack(getTrackUrl(futureNextSong.filePath));
              }

              // Update media session
              updateMediaSession(currentTrackThatIsAudiblyPlaying);

              // Start tracking play count for the new track
              playbackTracker.startTrackingTrack(
                currentTrackThatIsAudiblyPlaying.id,
              );

              // Save the track ID as the last played song
              get().setLastPlayedSongId(currentTrackThatIsAudiblyPlaying.id);

              return {
                currentTrack: currentTrackThatIsAudiblyPlaying,
                duration: currentTrackThatIsAudiblyPlaying.duration,
                paused: false,
                position: 0,
                lastPosition: 0,
                lastPlaybackTimeUpdateRef: Date.now() - 1000,
                shuffleHistoryPosition: newPosition,
              };
            }
          }

          // We're at the tip of history, get a new random song
          // Use the playback context browser filter, not the current one
          const artistFilter =
            state.playbackContextBrowserFilter?.artist || null;
          const albumFilter = state.playbackContextBrowserFilter?.album || null;

          const nextSong = findNextSong(
            currentTrackThatIsAudiblyPlaying.id,
            state.shuffleMode,
            state.playbackSource,
            state.repeatMode,
            artistFilter,
            state.shuffleHistory,
            albumFilter,
          );

          if (!nextSong) {
            return {};
          }

          // Check if we need to clear history (when all songs have been played with repeat all)
          // Get total available tracks to determine if we've played them all
          const library = useLibraryStore.getState().tracks;
          const { playlists } = useLibraryStore.getState();
          let totalAvailableTracks = 0;

          if (state.playbackSource === 'library') {
            let filtered = library;
            if (artistFilter) {
              filtered = filtered.filter(
                (t) =>
                  (t.albumArtist || t.artist || 'Unknown Artist') ===
                  artistFilter,
              );
            }
            if (albumFilter) {
              filtered = filtered.filter(
                (t) => (t.album || 'Unknown Album') === albumFilter,
              );
            }
            totalAvailableTracks = filtered.length;
          } else if (state.playbackSource === 'playlist') {
            const playlist = playlists.find(
              (p) => p.id === state.playbackSourcePlaylistId,
            );
            totalAvailableTracks = playlist?.trackIds.length || 0;
          }

          const allTracksPlayed =
            state.shuffleHistory.length >= totalAvailableTracks - 1;

          // Update shuffle history
          let shuffleHistory =
            allTracksPlayed && state.repeatMode === 'all'
              ? [] // Clear history when starting over with repeat all
              : [...state.shuffleHistory];

          // If we were in the middle of history, truncate everything after our position
          if (
            state.shuffleHistoryPosition >= 0 &&
            state.shuffleHistoryPosition < shuffleHistory.length - 1
          ) {
            shuffleHistory = shuffleHistory.slice(
              0,
              state.shuffleHistoryPosition + 1,
            );
          }

          // Add the track that just finished if not already at the end
          if (
            state.currentTrack &&
            (shuffleHistory.length === 0 ||
              shuffleHistory[shuffleHistory.length - 1].id !==
                state.currentTrack.id)
          ) {
            shuffleHistory.push(state.currentTrack);
          }

          // Add the currently playing track
          shuffleHistory.push(currentTrackThatIsAudiblyPlaying);

          // Keep history limited to 100 items
          if (shuffleHistory.length > 100) {
            shuffleHistory.shift();
          }

          // Add the FUTURE next song to the player queue
          state.player.addTrack(getTrackUrl(nextSong.filePath));

          // Update media session
          updateMediaSession(currentTrackThatIsAudiblyPlaying);

          // Start tracking play count for the new track
          playbackTracker.startTrackingTrack(
            currentTrackThatIsAudiblyPlaying.id,
          );

          // Save the track ID as the last played song
          get().setLastPlayedSongId(currentTrackThatIsAudiblyPlaying.id);

          return {
            currentTrack: currentTrackThatIsAudiblyPlaying,
            duration: currentTrackThatIsAudiblyPlaying.duration,
            paused: false,
            position: 0,
            lastPosition: 0,
            lastPlaybackTimeUpdateRef: Date.now() - 1000,
            shuffleHistory,
            shuffleHistoryPosition: shuffleHistory.length - 1, // At the new tip
          };
        }

        // Non-shuffle mode - standard behavior
        // Use the playback context browser filter, not the current one
        const artistFilter = state.playbackContextBrowserFilter?.artist || null;
        const albumFilter = state.playbackContextBrowserFilter?.album || null;

        const nextSong = findNextSong(
          currentTrackThatIsAudiblyPlaying.id,
          state.shuffleMode,
          state.playbackSource,
          state.repeatMode,
          artistFilter,
          state.shuffleHistory,
          albumFilter,
        );

        if (!nextSong) {
          return {};
        }

        // Add the FUTURE next song to the player queue
        state.player.addTrack(getTrackUrl(nextSong?.filePath));

        // Update media session
        updateMediaSession(currentTrackThatIsAudiblyPlaying);

        // Start tracking play count for the new track
        playbackTracker.startTrackingTrack(currentTrackThatIsAudiblyPlaying.id);

        // Save the track ID as the last played song
        get().setLastPlayedSongId(currentTrackThatIsAudiblyPlaying.id);

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
        };
      });
    },
  }),
);

// Set up event listeners for playback events from the main process
if (typeof window !== 'undefined') {
  window.electron.ipcRenderer.on('playback:trackChanged', (data: any) => {
    useSettingsAndPlaybackStore.setState({ currentTrack: data.track });
  });

  window.electron.ipcRenderer.on('playback:stateChanged', (data: any) => {
    useSettingsAndPlaybackStore.setState({ paused: !data.paused });
  });

  window.electron.ipcRenderer.on('playback:positionChanged', (data: any) => {
    // Convert from milliseconds to seconds
    useSettingsAndPlaybackStore.setState({
      position: data.position / 1000,
      duration: data.duration / 1000,
    });
  });

  // Initialize settings on app start
  useSettingsAndPlaybackStore.getState().loadSettings();
}

export default useSettingsAndPlaybackStore;
