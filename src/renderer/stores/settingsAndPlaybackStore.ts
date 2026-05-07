import { create } from 'zustand';
import { Gapless5 } from '@regosen/gapless-5';
import type { Track, Settings } from '../../types/dbTypes';
import { SettingsAndPlaybackStore } from './types';
import useLibraryStore from './libraryStore';
import {
  getTracksSnapshot,
  getPlaylistsSnapshot,
  getSettingsSnapshot,
  queryClient,
  queryKeys,
} from '../queries';
import {
  computeCanGoNext,
  findNextSong,
  findPreviousSong,
  getTrackUrl,
  updateMediaSession,
} from '../utils/trackSelectionUtils';
import { playbackTracker, updatePlayCount } from '../utils/playbackTracker';
import { preloadNextInQueue, syncPlayerQueue } from '../utils/playerQueue';

/**
 * Persist `lastPlayedSongId` to the DB and reflect it in the TanStack
 * Query settings cache. The store no longer mirrors settings, so all
 * the internal playback paths that used to call
 * `persistLastPlayedSongId(id)` route through this helper. Optimistic
 * cache write keeps `useSettings()` consumers in sync without waiting
 * on the IPC roundtrip; failures log only — the user has visibility on
 * playback state via the player UI itself, no toast needed.
 */
function persistLastPlayedSongId(id: string | null): void {
  queryClient.setQueryData<Settings>(queryKeys.settings, (old) =>
    old ? { ...old, lastPlayedSongId: id } : old,
  );
  window.electron.settings
    .update({ lastPlayedSongId: id })
    .catch((err: unknown) => {
      console.error('Error persisting last played song ID:', err);
    });
}

/**
 * Derive Gapless-5's singleMode from our repeatMode. The store's
 * repeatMode is the single source of truth; player.singleMode is a
 * pure write target. Gapless-5's native single-track loop is required
 * here because a programmatic re-queue inside autoPlayNextTrack would
 * break gapless continuity — the audio library loops the decoded
 * buffer directly via AudioBufferSourceNode.loop, which we can't match.
 */
function applyRepeatModeToPlayer(
  player: Gapless5,
  mode: 'off' | 'track' | 'all',
): void {
  player.singleMode = mode === 'track';
}

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
    // Playback runtime state. Settings (libraryPath / theme / columns /
    // columnWidths / librarySorting / columnOrder / lastPlayedSongId /
    // volume) are server state owned by TanStack Query — see
    // src/renderer/queries/settings.ts. Reads via useSettings() in
    // components or getSettingsSnapshot() in non-React paths.
    currentTrack: null, // the current track playing
    paused: true, // play pause state
    position: 0, // current position of the playing track in seconds
    duration: 0, // duration of the playing track in seconds
    playbackSource: 'library', // the source of the playback (library or playlist)
    playbackSourcePlaylistId: null, // the ID of the specific playlist if playbackSource is 'playlist'
    playbackContextBrowserFilter: null, // the browser filter that was active when playback started
    repeatMode: 'off', // off, track, all
    shuffleMode: false, // shuffle mode
    shuffleHistory: [], // history of shuffled tracks
    shuffleHistoryPosition: -1, // current position in shuffle history (-1 means at the tip)
    canGoNext: false, // stored boundary — refreshed by refreshCanGoNext after mutations

    // Internal state (from playbackStore)
    player: null, // the gapless 5 player instance
    lastPositionUpdateRef: 0, // helps us throttle position updates to once per second
    lastPlaybackTimeUpdateRef: 0, // helps us track actual playback time for play count
    lastPosition: 0, // track the last position to calculate playback time
    silentAudioRef: null, // reference to the silent audio element for MediaSession support
    preloadedTrack: null, // track sitting at Gapless-5 queue index 1 (store-owned)
    preloadReady: false, // true once the preloaded track is decoded and ready
    queueLeadingStaleCount: 0, // stale finished tracks at the front of Gapless-5's queue

    // Playback actions
    setSilentAudioRef: (ref) => {
      set({ silentAudioRef: ref });
    },

    /**
     * Recompute canGoNext from current state. Call this after any mutation
     * that might change the answer (new currentTrack, repeat/shuffle toggle,
     * library change). Holding it as a stored field avoids running the
     * filter/sort in getFilteredAndSortedTrackIds on every store-update tick,
     * which matters for large libraries.
     */
    refreshCanGoNext: () => {
      set((state) => {
        const canGoNext = computeCanGoNext(state);
        if (canGoNext === state.canGoNext) {
          return {};
        }
        return { canGoNext };
      });
    },

    setVolume: (volume) => {
      // Apply to the audio engine synchronously so the user hears the
      // change at click-time, then mirror into the TanStack Query
      // settings cache for `useSettings()` consumers, then persist via
      // partial-merge IPC. Fire-and-forget on the persist — the engine
      // is already updated and the next reader sees the optimistic
      // cache write either way.
      const { player } = get();
      if (player) player.setVolume(volume);
      queryClient.setQueryData<Settings>(queryKeys.settings, (old) =>
        old ? { ...old, volume } : old,
      );
      window.electron.settings.update({ volume }).catch((error: unknown) => {
        console.error('Error updating volume in settings:', error);
      });
    },

    selectSpecificSong: (trackId, playbackSource, playlistId = null) => {
      set((state) => {
        if (!state.player) {
          throw new Error('No player found while selecting specific song');
        }

        // Tracks are server state owned by TanStack Query; the store
        // doesn't keep its own copy. Reads outside React (like this
        // playback path) go through the queryClient snapshot.
        const library = getTracksSnapshot()?.tracks ?? [];

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

        syncPlayerQueue(state.player, {
          current: selectedTrack,
          next: nextSong,
          shouldPlay: true,
          pauseBeforeLoad: true,
        });

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
        persistLastPlayedSongId(trackId);

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
          preloadedTrack: nextSong ?? null,
          preloadReady: false,
          queueLeadingStaleCount: 0,
        };
      });
      get().refreshCanGoNext();
    },

    skipToNextTrack: () => {
      set((state) => {
        if (!state.player) {
          throw new Error('No player found while skipping to next song');
        }

        if (state.repeatMode === 'track') {
          // For repeat track mode, start from the beginning
          // invariant: update state.position alongside setPosition
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
              syncPlayerQueue(state.player, {
                current: nextSong,
                next: futureNextSong ?? null,
                shouldPlay: !state.paused,
              });

              if (!state.paused && state.silentAudioRef) {
                state.silentAudioRef.play().catch((error) => {
                  console.error('Error playing silent audio:', error);
                });
              }

              updateMediaSession(nextSong);

              // Start tracking play count for the new track
              playbackTracker.startTrackingTrack(nextSong.id);

              // Save the track ID as the last played song
              persistLastPlayedSongId(nextSong.id);

              return {
                currentTrack: nextSong,
                position: 0,
                lastPosition: 0,
                lastPlaybackTimeUpdateRef: Date.now(),
                duration: nextSong.duration,
                shuffleHistoryPosition: newPosition,
                preloadedTrack: futureNextSong ?? null,
                preloadReady: false,
                queueLeadingStaleCount: 0,
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
          const library = getTracksSnapshot()?.tracks ?? [];
          const playlists = getPlaylistsSnapshot() ?? [];
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
          syncPlayerQueue(state.player, {
            current: nextSong,
            next: futureNextSong ?? null,
            shouldPlay: !state.paused,
          });

          if (!state.paused && state.silentAudioRef) {
            state.silentAudioRef.play().catch((error) => {
              console.error('Error playing silent audio:', error);
            });
          }

          updateMediaSession(nextSong);

          // Start tracking play count for the new track
          playbackTracker.startTrackingTrack(nextSong.id);

          // Save the track ID as the last played song
          persistLastPlayedSongId(nextSong.id);

          return {
            currentTrack: nextSong,
            position: 0,
            lastPosition: 0,
            lastPlaybackTimeUpdateRef: Date.now(),
            duration: nextSong.duration,
            shuffleHistory,
            shuffleHistoryPosition: shuffleHistory.length - 1, // Now at the new tip
            preloadedTrack: futureNextSong ?? null,
            preloadReady: false,
            queueLeadingStaleCount: 0,
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

        // Fast path is only safe when the preloaded track is fully decoded:
        // gotoTrack on a still-loading source silently fails (the source
        // transitions Loading -> Stop, and play() then tries to play with
        // no buffered data instead of queuing). state.preloadReady is
        // flipped true by Gapless-5's onload event in initPlayer below.
        const isFastPathEligible =
          state.preloadedTrack?.id === nextSong.id && state.preloadReady;

        if (isFastPathEligible) {
          // FAST PATH: switch to the already-buffered preloaded track.
          //
          // Jump by URL (not by index) so we're robust to the known leak
          // where Gapless-5's queue accumulates stale finished tracks at
          // the front after each auto-advance. `gotoTrack(1)` would land
          // on whatever sits at index 1, which after N auto-advances is
          // NOT the preloaded track — it's one of the stale leaders.
          //
          // After jumping, remove every track ahead of the new current:
          // one for each stale leading entry (queueLeadingStaleCount) plus
          // one for the prior current that's now the old index 0 slot.
          const nextSongUrl = getTrackUrl(nextSong.filePath);
          state.player.gotoTrack(nextSongUrl);
          const removalsBeforeCurrent = state.queueLeadingStaleCount + 1;
          for (let i = 0; i < removalsBeforeCurrent; i += 1) {
            state.player.removeTrack(0);
          }
          if (futureNextSong) {
            preloadNextInQueue(state.player, futureNextSong);
          }
        } else {
          // SLOW PATH: queue doesn't match, rebuild
          syncPlayerQueue(state.player, {
            current: nextSong,
            next: futureNextSong ?? null,
            shouldPlay: !state.paused,
          });
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
        persistLastPlayedSongId(nextSong.id);

        return {
          currentTrack: nextSong,
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
          duration: nextSong.duration,
          preloadedTrack: futureNextSong ?? null,
          preloadReady: false,
          queueLeadingStaleCount: 0,
        };
      });
      get().refreshCanGoNext();
    },

    skipToPreviousTrack: () => {
      set((state) => {
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
              syncPlayerQueue(state.player, {
                current: previousSong,
                next: futureNextSong ?? null,
                shouldPlay: !state.paused,
              });

              if (!state.paused && state.silentAudioRef) {
                state.silentAudioRef.play().catch((error) => {
                  console.error('Error playing silent audio:', error);
                });
              }

              updateMediaSession(previousSong);

              // Start tracking play count for the previous track
              playbackTracker.startTrackingTrack(previousSong.id);

              // Save the track ID as the last played song
              persistLastPlayedSongId(previousSong.id);

              return {
                currentTrack: previousSong,
                position: 0,
                lastPosition: 0,
                lastPlaybackTimeUpdateRef: Date.now(),
                duration: previousSong.duration,
                shuffleHistoryPosition: newPosition,
                preloadedTrack: futureNextSong ?? null,
                preloadReady: false,
                queueLeadingStaleCount: 0,
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
            // invariant: update state.position alongside setPosition
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
          syncPlayerQueue(state.player, {
            current: previousSong,
            next: futureNextSong,
            shouldPlay: !state.paused,
          });

          if (!state.paused && state.silentAudioRef) {
            state.silentAudioRef.play().catch((error) => {
              console.error('Error playing silent audio:', error);
            });
          }

          updateMediaSession(previousSong);

          // Start tracking play count for the previous track
          playbackTracker.startTrackingTrack(previousSong.id);

          // Save the track ID as the last played song
          persistLastPlayedSongId(previousSong.id);

          return {
            currentTrack: previousSong,
            position: 0,
            lastPosition: 0,
            lastPlaybackTimeUpdateRef: Date.now(),
            duration: previousSong.duration,
            preloadedTrack: futureNextSong,
            preloadReady: false,
            queueLeadingStaleCount: 0,
          };
        }
        // Restart the current track
        // invariant: update state.position alongside setPosition
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
      get().refreshCanGoNext();
    },

    toggleRepeatMode: () => {
      set((state) => {
        // Cycle through repeat modes: off -> track -> all -> off
        const modes: ('off' | 'track' | 'all')[] = ['off', 'track', 'all'];
        const currentIndex = modes.indexOf(state.repeatMode);
        const nextIndex = (currentIndex + 1) % modes.length;

        const repeatMode = modes[nextIndex];

        /**
         * @important Leverage the Gapless5 player's singleMode to achieve perfect
         * repeating in single song repeat mode.
         * We don't do this programmatically in the autoPlayNextTrack/skipToNextTrack
         * methods like we do with repeat mode 'all' or 'none' because it would
         * break the gapless playback.
         */
        if (state.player) {
          applyRepeatModeToPlayer(state.player, repeatMode);
        }

        return { repeatMode, player: state.player };
      });
      get().refreshCanGoNext();
    },

    toggleShuffleMode: () => {
      set((state) => {
        return {
          shuffleMode: !state.shuffleMode,
          shuffleHistory: [],
          shuffleHistoryPosition: -1,
        };
      });
      get().refreshCanGoNext();
    },

    setPaused: (paused: boolean) => {
      set((state) => {
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
        // Volume comes from the TanStack Query settings cache. If the
        // query hasn't resolved yet (rare — local IPC is sub-ms but
        // not zero), fall back to 1.0; the reconcile-volume effect in
        // App.tsx applies the persisted value once useSettings settles.
        const initialVolume = getSettingsSnapshot()?.volume ?? 1.0;
        const player = new Gapless5({
          useHTML5Audio: false,
          crossfade: 25, // 25ms crossfade between tracks
          exclusive: true, // Only one track can play at a time
          loadLimit: 3, // Load up to 3 tracks at a time
          volume: initialVolume,
        });

        // E2E diagnostic hook: lets Playwright specs observe what
        // Gapless-5 is actually playing versus what the store thinks
        // is playing. Installed lazily on first player creation (no
        // module-load side effects), the only legitimate consumer of
        // player.getTracks()/getIndex() outside the dev-only invariant
        // assert. Read-only, no mutation.
        // eslint-disable-next-line no-underscore-dangle
        (
          window as unknown as Record<string, unknown>
        ).__hihat_e2e_getPlayerState = () => {
          const s = get();
          const p = s.player ?? player;
          const urlToFilePath = (url: string | undefined): string | null => {
            if (!url) return null;
            return decodeURIComponent(
              url.replace('hihat-audio://getfile/', ''),
            );
          };
          const tracks = p.getTracks();
          const index = p.getIndex();
          return {
            storeCurrentTrackFilePath: s.currentTrack?.filePath ?? null,
            storePreloadedTrackFilePath: s.preloadedTrack?.filePath ?? null,
            storePreloadReady: s.preloadReady,
            playerQueueLength: tracks.length,
            playerIndex: index,
            playerCurrentFilePath: urlToFilePath(tracks[index]),
          };
        };

        // Seed singleMode from the store's repeatMode so the player
        // reflects state on first construction, not only after a toggle.
        applyRepeatModeToPlayer(player, state.repeatMode);

        // Set up error handler
        player.onerror = (error: string) => {
          console.error('Audio player error:', error);
        };

        // Flip preloadReady when the track we preloaded at index 1
        // finishes decoding. skipToNextTrack's fast path gates on this
        // (gotoTrack on a still-loading source silently fails).
        player.onload = (trackPath: string, fullyLoaded: boolean) => {
          const { preloadedTrack } = get();
          if (
            preloadedTrack &&
            getTrackUrl(preloadedTrack.filePath) === trackPath
          ) {
            set({ preloadReady: fullyLoaded });
          }
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
      set((state) => {
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

        // invariant: update state.position alongside setPosition
        state.player.setPosition(position * 1000);
        return {
          position,
          lastPosition: position,
          lastPlaybackTimeUpdateRef: Date.now(),
        };
      });
    },

    autoPlayNextTrack: async () => {
      set((state) => {
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

        // Gapless-5 has auto-advanced to queue index 1, which is the track
        // we tracked as preloadedTrack when we last mutated the queue. No
        // need to re-derive that from player.getTracks()/getIndex() — the
        // store already knows what's playing.
        //
        // Known leak: the finished track at index 0 is never cleaned up.
        // Every preloadNextInQueue below grows the Gapless-5 queue by one
        // entry instead of rotating it. See `assertQueueInvariant` in
        // playerQueue.ts for the full story — short version is that
        // removing index 0 mid-transition triggers a Gapless-5 bug that
        // pauses playback instead of auto-advancing.
        const currentTrackThatIsAudiblyPlaying = state.preloadedTrack;

        if (!currentTrackThatIsAudiblyPlaying) {
          // Nothing was preloaded (e.g., reached the end of the source with
          // no repeat). Let the caller fall through — the downstream
          // branches will either compute a new song via findNextSong or
          // bail out cleanly.
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
                preloadNextInQueue(state.player, futureNextSong);
              }

              // Update media session
              updateMediaSession(currentTrackThatIsAudiblyPlaying);

              // Start tracking play count for the new track
              playbackTracker.startTrackingTrack(
                currentTrackThatIsAudiblyPlaying.id,
              );

              // Save the track ID as the last played song
              persistLastPlayedSongId(currentTrackThatIsAudiblyPlaying.id);

              return {
                currentTrack: currentTrackThatIsAudiblyPlaying,
                duration: currentTrackThatIsAudiblyPlaying.duration,
                paused: false,
                position: 0,
                lastPosition: 0,
                lastPlaybackTimeUpdateRef: Date.now() - 1000,
                shuffleHistoryPosition: newPosition,
                preloadedTrack: futureNextSong ?? null,
                preloadReady: false,
                queueLeadingStaleCount: state.queueLeadingStaleCount + 1,
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
          const library = getTracksSnapshot()?.tracks ?? [];
          const playlists = getPlaylistsSnapshot() ?? [];
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
          preloadNextInQueue(state.player, nextSong);

          // Update media session
          updateMediaSession(currentTrackThatIsAudiblyPlaying);

          // Start tracking play count for the new track
          playbackTracker.startTrackingTrack(
            currentTrackThatIsAudiblyPlaying.id,
          );

          // Save the track ID as the last played song
          persistLastPlayedSongId(currentTrackThatIsAudiblyPlaying.id);

          return {
            currentTrack: currentTrackThatIsAudiblyPlaying,
            duration: currentTrackThatIsAudiblyPlaying.duration,
            paused: false,
            position: 0,
            lastPosition: 0,
            lastPlaybackTimeUpdateRef: Date.now() - 1000,
            shuffleHistory,
            shuffleHistoryPosition: shuffleHistory.length - 1, // At the new tip
            preloadedTrack: nextSong,
            preloadReady: false,
            queueLeadingStaleCount: state.queueLeadingStaleCount + 1,
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
        preloadNextInQueue(state.player, nextSong);

        // Update media session
        updateMediaSession(currentTrackThatIsAudiblyPlaying);

        // Start tracking play count for the new track
        playbackTracker.startTrackingTrack(currentTrackThatIsAudiblyPlaying.id);

        // Save the track ID as the last played song
        persistLastPlayedSongId(currentTrackThatIsAudiblyPlaying.id);

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
          preloadedTrack: nextSong,
          preloadReady: false,
          queueLeadingStaleCount: state.queueLeadingStaleCount + 1,
        };
      });
      get().refreshCanGoNext();
    },
  }),
);

export default useSettingsAndPlaybackStore;
