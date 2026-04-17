import { create } from 'zustand';
import { Gapless5 } from '@regosen/gapless-5';
import { Settings } from '../../types/dbTypes';
import { SettingsAndPlaybackStore } from './types';
import useLibraryStore from './libraryStore';
import useUIStore from './uiStore';
import {
  computeCanGoNext,
  computeCanGoPrevOrRestart,
  getFilePathFromTrackUrl,
  getFilteredAndSortedTrackIds,
  getTrackUrl,
  updateMediaSession,
} from '../utils/trackSelectionUtils';
import { playbackTracker, updatePlayCount } from '../utils/playbackTracker';
import {
  advance as advanceQueue,
  buildQueue,
  jumpTo as jumpToQueue,
  peekNext as peekNextQueueId,
  removeAt as removeAtQueue,
  reshuffleFuture,
  retreat as retreatQueue,
  snapshotsEqual,
  syncWithLibrary as syncQueueWithLib,
  unshuffleFuture,
  type QueueSourceSnapshot,
  type QueueState,
} from '../utils/playbackQueue';

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

/**
 * Pull the queue slice out of store state into a plain QueueState that the
 * pure helpers in playbackQueue.ts operate on. The reverse merge happens
 * inline at the call sites via Zustand's `set({...})`.
 */
function getQueueState(state: SettingsAndPlaybackStore): QueueState {
  return {
    trackIds: state.queueTrackIds,
    currentIndex: state.queueCurrentIndex,
    source: state.queueSourceSnapshot,
  };
}

/**
 * Closure used by advanceQueue's shuffle-wrap path. Re-queries the
 * filtered+sorted source list for the snapshot the queue was built from.
 * Wraps the call in a try so a thrown getFilteredAndSortedTrackIds
 * (e.g. selected playlist deleted) doesn't crash skipToNextTrack — the
 * wrap simply yields no fresh pass and the queue remains exhausted.
 */
function makeRefreshSourceTrackIds(
  snapshot: QueueSourceSnapshot | null,
): () => string[] {
  return () => {
    if (!snapshot) return [];
    try {
      return getFilteredAndSortedTrackIds(
        snapshot.kind,
        snapshot.filter?.artist ?? null,
        snapshot.filter?.album ?? null,
      );
    } catch {
      return [];
    }
  };
}

/**
 * Push [current, next?] to Gapless5 and start playback. Used when we need
 * to fully rebuild Gapless's queue rather than fast-path through its
 * pre-loaded +1 slot — i.e. when the upcoming track changed unexpectedly
 * (selectSpecificSong on a new source, prev navigation, shuffle wrap).
 */
function rebuildGaplessQueue(
  state: SettingsAndPlaybackStore,
  currentFilePath: string,
  nextFilePath: string | null,
  shouldPlay: boolean,
): void {
  if (!state.player) return;
  state.player.removeAllTracks();
  state.player.addTrack(getTrackUrl(currentFilePath));
  if (nextFilePath) {
    state.player.addTrack(getTrackUrl(nextFilePath));
  }
  if (shouldPlay) {
    state.player.play();
    if (state.silentAudioRef) {
      state.silentAudioRef.play().catch((error) => {
        console.error('Error playing silent audio:', error);
      });
    }
  }
}

// Define the settings and playback store
const useSettingsAndPlaybackStore = create<SettingsAndPlaybackStore>(
  (set, get) => ({
    // Settings state (from settingsStore)
    id: 'app-settings', // db record name never changes
    libraryPath: '',
    theme: 'dark',
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
    position: 0, // current position of the playing track in seconds
    duration: 0, // duration of the playing track in seconds
    playbackSource: 'library', // the source of the playback (library or playlist)
    playbackSourcePlaylistId: null, // the ID of the specific playlist if playbackSource is 'playlist'
    playbackContextBrowserFilter: null, // the browser filter that was active when playback started
    repeatMode: 'off', // off, track, all
    shuffleMode: false, // shuffle mode
    queueTrackIds: [], // materialized queue: past + current + future
    queueCurrentIndex: -1, // pointer into queueTrackIds; -1 = nothing playing
    queueSourceSnapshot: null, // what the queue was built from (for rebuild triggers)
    canGoNext: false, // stored boundary — refreshed by refreshPrevNextBoundaries after mutations
    canGoPrevOrRestart: false, // true when prev click would navigate OR restart the song

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

        // Signal the main process that settings are loaded so the window
        // can be shown with the correct theme. See the "Deferred window
        // show" comment in main.ts for the full pattern.
        window.electron.ipcRenderer.sendMessage('app:settingsLoaded');

        return appSettings;
      } catch (error) {
        console.error('Error loading settings:', error);
        useUIStore
          .getState()
          .showNotification('Failed to load settings', 'error');

        // Signal even on failure — the window must still show. The store
        // defaults to 'dark' so the fallback theme is reasonable.
        window.electron.ipcRenderer.sendMessage('app:settingsLoaded');

        return {
          libraryPath: '',
          theme: 'dark',
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
      // Guard: never clear the persisted sort via this path. Callers that
      // want "no sort" would regress to the default on next launch, which
      // is surprising. If that's ever needed, add a dedicated method.
      if (!sorting || sorting.length === 0) return;

      // Optimistic in-memory update first: the UI (component subscribers)
      // and trackSelectionUtils (libraryViewState) respond immediately,
      // before the DB round-trip completes. Errors in the DB write are
      // logged but do not revert the UI — the user sees the sort they
      // asked for and can retry the action.
      set({ librarySorting: sorting });
      const libState = useLibraryStore.getState();
      libState.updateLibraryViewState(
        sorting,
        libState.libraryViewState.filtering,
      );

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
      set({ silentAudioRef: ref });
    },

    /**
     * Recompute canGoNext / canGoPrevOrRestart from current state. Call this
     * after any mutation that might change the answer (new currentTrack,
     * repeat/shuffle toggle, library change, position crossing 3s). Holding
     * these as stored fields avoids running the filter/sort in getFiltered...
     * on every store-update tick, which matters for large libraries.
     */
    refreshPrevNextBoundaries: () => {
      set((state) => {
        const canGoNext = computeCanGoNext(state);
        const canGoPrevOrRestart = computeCanGoPrevOrRestart(state);
        if (
          canGoNext === state.canGoNext &&
          canGoPrevOrRestart === state.canGoPrevOrRestart
        ) {
          return {};
        }
        return { canGoNext, canGoPrevOrRestart };
      });
    },

    setVolume: (volume) => {
      set((state) => {
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
      set((state) => {
        if (!state.player) {
          throw new Error('No player found while selecting specific song');
        }

        const libState = useLibraryStore.getState();
        const selectedTrack = libState.tracks.find((t) => t.id === trackId);
        if (!selectedTrack) {
          throw new Error('No track found while selecting specific song');
        }

        const viewId =
          playbackSource === 'library' ? 'library' : playlistId || 'library';
        const browserFilter = libState.getBrowserFilter(viewId);
        const newSnapshot: QueueSourceSnapshot = {
          kind: playbackSource,
          playlistId: playbackSource === 'playlist' ? playlistId : null,
          filter: browserFilter,
        };

        // Same source + track already in queue: just re-pin the index.
        // Otherwise rebuild a fresh queue from the snapshot.
        let newQueue: QueueState;
        if (
          snapshotsEqual(state.queueSourceSnapshot, newSnapshot) &&
          state.queueTrackIds.includes(trackId)
        ) {
          newQueue = jumpToQueue(
            getQueueState(state),
            state.queueTrackIds.indexOf(trackId),
          );
        } else {
          const sourceTrackIds = getFilteredAndSortedTrackIds(
            playbackSource,
            browserFilter.artist,
            browserFilter.album,
          );
          newQueue = buildQueue({
            sourceTrackIds,
            startTrackId: trackId,
            shuffle: state.shuffleMode,
            source: newSnapshot,
          });
        }

        const nextId = peekNextQueueId(
          newQueue,
          state.repeatMode,
          state.shuffleMode,
        );
        const nextTrack = nextId
          ? libState.tracks.find((t) => t.id === nextId)
          : null;

        rebuildGaplessQueue(
          state,
          selectedTrack.filePath,
          nextTrack?.filePath ?? null,
          true,
        );

        updateMediaSession(selectedTrack);
        playbackTracker.startTrackingTrack(trackId);
        get().setLastPlayedSongId(trackId);

        return {
          currentTrack: selectedTrack,
          paused: false,
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
          duration: selectedTrack.duration,
          playbackSource,
          playbackSourcePlaylistId:
            playbackSource === 'playlist' ? playlistId : null,
          playbackContextBrowserFilter: browserFilter,
          queueTrackIds: newQueue.trackIds,
          queueCurrentIndex: newQueue.currentIndex,
          queueSourceSnapshot: newQueue.source,
        };
      });
      get().refreshPrevNextBoundaries();
    },

    skipToNextTrack: () => {
      set((state) => {
        if (!state.player) {
          throw new Error('No player found while skipping to next song');
        }

        // Repeat 'track': in-place restart. Gapless's singleMode handles
        // it on natural end; here on manual skip we just rewind to 0.
        if (state.repeatMode === 'track') {
          state.player.setPosition(0);
          if (state.currentTrack) {
            playbackTracker.resetTrack(state.currentTrack.id);
          }
          return {
            position: 0,
            lastPosition: 0,
            lastPlaybackTimeUpdateRef: Date.now(),
          };
        }

        if (!state.currentTrack || state.queueTrackIds.length === 0) return {};

        const result = advanceQueue(
          getQueueState(state),
          state.repeatMode,
          state.shuffleMode,
          makeRefreshSourceTrackIds(state.queueSourceSnapshot),
        );
        if (!result.changed) return {};

        const newQueue = result.state;
        const nextId = newQueue.trackIds[newQueue.currentIndex];
        const library = useLibraryStore.getState().tracks;
        const nextTrack = library.find((t) => t.id === nextId);
        if (!nextTrack) return {};

        const futureNextId = peekNextQueueId(
          newQueue,
          state.repeatMode,
          state.shuffleMode,
        );
        const futureNextTrack = futureNextId
          ? library.find((t) => t.id === futureNextId)
          : null;

        flushPlaybackTracking(state);

        // Fast path: if Gapless's pre-loaded +1 slot already holds the
        // track we want, swap to it instead of rebuilding (avoids a
        // ~200ms load delay on each skip).
        // Gapless5State: None=0, Loading=1, Starting=2, Play=3, Stop=4, Error=5
        const GAPLESS5_LOADING = 1;
        const queuedTracks = state.player.getTracks();
        const preloadedUrl = queuedTracks.length > 1 ? queuedTracks[1] : null;
        const nextSongUrl = getTrackUrl(nextTrack.filePath);
        const preloadedSource =
          queuedTracks.length > 1 ? state.player.playlist.sources[1] : null;
        const isPreloadReady =
          preloadedSource && preloadedSource.getState() !== GAPLESS5_LOADING;

        if (preloadedUrl === nextSongUrl && isPreloadReady) {
          state.player.gotoTrack(1);
          state.player.removeTrack(0);
          if (futureNextTrack) {
            state.player.addTrack(getTrackUrl(futureNextTrack.filePath));
          }
        } else {
          rebuildGaplessQueue(
            state,
            nextTrack.filePath,
            futureNextTrack?.filePath ?? null,
            !state.paused,
          );
        }

        if (!state.paused && state.silentAudioRef) {
          state.silentAudioRef.play().catch((error) => {
            console.error('Error playing silent audio:', error);
          });
        }

        updateMediaSession(nextTrack);
        playbackTracker.startTrackingTrack(nextTrack.id);
        get().setLastPlayedSongId(nextTrack.id);

        return {
          currentTrack: nextTrack,
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
          duration: nextTrack.duration,
          queueTrackIds: newQueue.trackIds,
          queueCurrentIndex: newQueue.currentIndex,
        };
      });
      get().refreshPrevNextBoundaries();
    },

    skipToPreviousTrack: () => {
      set((state) => {
        if (!state.player) {
          throw new Error('No player found while skipping to previous song');
        }

        // CD-player escape hatch: > 3s into the track, the prev button
        // restarts the current song instead of navigating back. Same
        // behavior in shuffle and non-shuffle.
        if (state.position > 3) {
          state.player.setPosition(0);
          if (state.currentTrack) {
            playbackTracker.resetTrack(state.currentTrack.id);
          }
          return {
            position: 0,
            lastPosition: 0,
            lastPlaybackTimeUpdateRef: Date.now(),
          };
        }

        if (!state.currentTrack || state.queueTrackIds.length === 0) return {};

        const result = retreatQueue(getQueueState(state), state.repeatMode);
        if (!result.changed) {
          // No previous track to go to — restart the current one.
          state.player.setPosition(0);
          if (state.currentTrack) {
            playbackTracker.resetTrack(state.currentTrack.id);
          }
          return {
            position: 0,
            lastPosition: 0,
            lastPlaybackTimeUpdateRef: Date.now(),
          };
        }

        const newQueue = result.state;
        const prevId = newQueue.trackIds[newQueue.currentIndex];
        const library = useLibraryStore.getState().tracks;
        const prevTrack = library.find((t) => t.id === prevId);
        if (!prevTrack) return {};

        // The previously-current track is now the +1 in the queue and
        // should be Gapless's pre-loaded slot (gives an instant skip-
        // forward back to where we were).
        const futureNextTrack = state.currentTrack;

        flushPlaybackTracking(state);
        rebuildGaplessQueue(
          state,
          prevTrack.filePath,
          futureNextTrack.filePath,
          !state.paused,
        );

        updateMediaSession(prevTrack);
        playbackTracker.startTrackingTrack(prevTrack.id);
        get().setLastPlayedSongId(prevTrack.id);

        return {
          currentTrack: prevTrack,
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
          duration: prevTrack.duration,
          queueTrackIds: newQueue.trackIds,
          queueCurrentIndex: newQueue.currentIndex,
        };
      });
      get().refreshPrevNextBoundaries();
    },

    toggleRepeatMode: () => {
      set((state) => {
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
      get().refreshPrevNextBoundaries();
    },

    toggleShuffleMode: () => {
      set((state) => {
        const nextShuffleMode = !state.shuffleMode;

        // Past stays intact when toggling. Only the future is reshuffled
        // or re-sorted — that's the user's mental model of "I want the
        // next songs to be (random / in order)" without rewriting history.
        if (state.queueTrackIds.length === 0 || state.queueCurrentIndex < 0) {
          return { shuffleMode: nextShuffleMode };
        }

        let newQueue: QueueState;
        if (nextShuffleMode) {
          newQueue = reshuffleFuture(getQueueState(state));
        } else {
          const sourceIds = makeRefreshSourceTrackIds(
            state.queueSourceSnapshot,
          )();
          newQueue = unshuffleFuture(getQueueState(state), sourceIds);
        }

        // Update Gapless's +1 slot if the new upcoming track changed,
        // so a subsequent skip-next or natural end picks up the right one.
        if (state.player && state.currentTrack) {
          const futureNextId = peekNextQueueId(
            newQueue,
            state.repeatMode,
            nextShuffleMode,
          );
          const library = useLibraryStore.getState().tracks;
          const futureNextTrack = futureNextId
            ? library.find((t) => t.id === futureNextId)
            : null;

          const queuedTracks = state.player.getTracks();
          const desiredUrl = futureNextTrack
            ? getTrackUrl(futureNextTrack.filePath)
            : null;
          const currentPreloadUrl =
            queuedTracks.length > 1 ? queuedTracks[1] : null;

          if (currentPreloadUrl !== desiredUrl) {
            // Drop everything past the currently-playing track (index 0)
            // and re-add the new +1 slot if there is one.
            while (state.player.getTracks().length > 1) {
              state.player.removeTrack(1);
            }
            if (desiredUrl) {
              state.player.addTrack(desiredUrl);
            }
          }
        }

        return {
          shuffleMode: nextShuffleMode,
          queueTrackIds: newQueue.trackIds,
          queueCurrentIndex: newQueue.currentIndex,
        };
      });
      get().refreshPrevNextBoundaries();
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
            // Update position (capture prev for threshold detection below)
            const prevPosition = get().position;
            set({
              lastPositionUpdateRef: now,
              // Convert from milliseconds to seconds
              position: currentPosition,
            });

            // canGoPrevOrRestart flips when position crosses 3s (the
            // "restart current track" escape hatch). Refresh only on a
            // crossing — not strictly necessary now that the boundary
            // check is O(1), but cheap and keeps the contract explicit.
            if (prevPosition <= 3 !== currentPosition <= 3) {
              get().refreshPrevNextBoundaries();
            }

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

        state.player.setPosition(position * 1000);
        return {
          position,
          lastPosition: position,
          lastPlaybackTimeUpdateRef: Date.now(),
        };
      });
      get().refreshPrevNextBoundaries();
    },

    autoPlayNextTrack: async () => {
      set((state) => {
        if (!state.player) {
          throw new Error('No player found while auto playing next track');
        }

        // Repeat track: Gapless's singleMode is on, but the existing behavior
        // also explicitly nudges back to track 0 + play to keep timing flush.
        // Preserved verbatim from the previous implementation.
        if (state.repeatMode === 'track') {
          state.player.gotoTrack(0);
          state.player.play();
          if (state.silentAudioRef) {
            state.silentAudioRef.play().catch((error) => {
              console.error('Error playing silent audio:', error);
            });
          }
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

        const result = advanceQueue(
          getQueueState(state),
          state.repeatMode,
          state.shuffleMode,
          makeRefreshSourceTrackIds(state.queueSourceSnapshot),
        );
        if (!result.changed) return {};

        const newQueue = result.state;
        const newCurrentId = newQueue.trackIds[newQueue.currentIndex];
        const library = useLibraryStore.getState().tracks;
        const newCurrentTrack = library.find((t) => t.id === newCurrentId);
        if (!newCurrentTrack) return {};

        const futureNextId = peekNextQueueId(
          newQueue,
          state.repeatMode,
          state.shuffleMode,
        );
        const futureNextTrack = futureNextId
          ? library.find((t) => t.id === futureNextId)
          : null;

        // Happy path: Gapless auto-advanced to its pre-loaded +1, which
        // matches our new current. Just append the new +1.
        // Edge case (shuffle wrap, source change): Gapless's current
        // doesn't match what advanceQueue produced — rebuild from scratch.
        const gaplessTracks = state.player.getTracks();
        const gaplessIndex = state.player.getIndex();
        const gaplessCurrentPath = gaplessTracks[gaplessIndex]
          ? getFilePathFromTrackUrl(gaplessTracks[gaplessIndex])
          : null;

        if (gaplessCurrentPath === newCurrentTrack.filePath) {
          if (futureNextTrack) {
            state.player.addTrack(getTrackUrl(futureNextTrack.filePath));
          }
        } else {
          rebuildGaplessQueue(
            state,
            newCurrentTrack.filePath,
            futureNextTrack?.filePath ?? null,
            true,
          );
        }

        updateMediaSession(newCurrentTrack);
        playbackTracker.startTrackingTrack(newCurrentTrack.id);
        get().setLastPlayedSongId(newCurrentTrack.id);

        return {
          currentTrack: newCurrentTrack,
          duration: newCurrentTrack.duration,
          paused: false,
          position: 0,
          lastPosition: 0,
          // Tiny backdated tracking ref so the first ontimeupdate after
          // the transition counts ~1s of playback (preserves prior
          // play-count semantics around track boundaries).
          lastPlaybackTimeUpdateRef: Date.now() - 1000,
          queueTrackIds: newQueue.trackIds,
          queueCurrentIndex: newQueue.currentIndex,
        };
      });
      get().refreshPrevNextBoundaries();
    },

    /**
     * Set the queue pointer to a specific index and start playback there.
     * Used by the PlaybackQueue view's double-click handler. The queue
     * trackIds are not mutated — only the pointer moves.
     */
    jumpToQueueIndex: (index: number) => {
      set((state) => {
        if (!state.player) return {};
        if (index < 0 || index >= state.queueTrackIds.length) return {};
        if (index === state.queueCurrentIndex) return {};

        const targetId = state.queueTrackIds[index];
        const library = useLibraryStore.getState().tracks;
        const targetTrack = library.find((t) => t.id === targetId);
        if (!targetTrack) return {};

        const newQueue = jumpToQueue(getQueueState(state), index);
        const futureNextId = peekNextQueueId(
          newQueue,
          state.repeatMode,
          state.shuffleMode,
        );
        const futureNextTrack = futureNextId
          ? library.find((t) => t.id === futureNextId)
          : null;

        flushPlaybackTracking(state);
        rebuildGaplessQueue(
          state,
          targetTrack.filePath,
          futureNextTrack?.filePath ?? null,
          !state.paused,
        );

        updateMediaSession(targetTrack);
        playbackTracker.startTrackingTrack(targetTrack.id);
        get().setLastPlayedSongId(targetTrack.id);

        return {
          currentTrack: targetTrack,
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
          duration: targetTrack.duration,
          queueCurrentIndex: newQueue.currentIndex,
        };
      });
      get().refreshPrevNextBoundaries();
    },

    /**
     * Remove the track at the given queue index. Used by the PlaybackQueue
     * view's "Remove from Queue" right-click action.
     *
     * If the removed entry IS the currently-playing track, removeAt's
     * convention is that the pointer keeps its position (now indexing the
     * next track). We then start playback of that new current track. If
     * removal emptied the queue, we stop playback.
     */
    removeFromQueue: (index: number) => {
      set((state) => {
        if (!state.player) return {};
        if (index < 0 || index >= state.queueTrackIds.length) return {};

        const wasCurrent = index === state.queueCurrentIndex;
        const newQueue = removeAtQueue(getQueueState(state), index);

        if (newQueue.trackIds.length === 0) {
          state.player.pause();
          state.player.removeAllTracks();
          if (state.silentAudioRef) state.silentAudioRef.pause();
          return {
            queueTrackIds: [],
            queueCurrentIndex: -1,
            currentTrack: null,
            paused: true,
            position: 0,
            duration: 0,
          };
        }

        if (!wasCurrent) {
          // The removal didn't disturb the current track. We may need to
          // refresh Gapless's +1 slot if the removed entry was the next
          // pre-loaded track.
          const futureNextId = peekNextQueueId(
            newQueue,
            state.repeatMode,
            state.shuffleMode,
          );
          const library = useLibraryStore.getState().tracks;
          const futureNextTrack = futureNextId
            ? library.find((t) => t.id === futureNextId)
            : null;

          const queuedTracks = state.player.getTracks();
          const desiredUrl = futureNextTrack
            ? getTrackUrl(futureNextTrack.filePath)
            : null;
          const currentPreloadUrl =
            queuedTracks.length > 1 ? queuedTracks[1] : null;

          if (currentPreloadUrl !== desiredUrl) {
            while (state.player.getTracks().length > 1) {
              state.player.removeTrack(1);
            }
            if (desiredUrl) state.player.addTrack(desiredUrl);
          }

          return {
            queueTrackIds: newQueue.trackIds,
            queueCurrentIndex: newQueue.currentIndex,
          };
        }

        // wasCurrent: jump playback to whatever the queue now points at.
        const newCurrentId = newQueue.trackIds[newQueue.currentIndex];
        const library = useLibraryStore.getState().tracks;
        const newCurrentTrack = library.find((t) => t.id === newCurrentId);
        if (!newCurrentTrack) {
          return {
            queueTrackIds: newQueue.trackIds,
            queueCurrentIndex: newQueue.currentIndex,
          };
        }

        const futureNextId = peekNextQueueId(
          newQueue,
          state.repeatMode,
          state.shuffleMode,
        );
        const futureNextTrack = futureNextId
          ? library.find((t) => t.id === futureNextId)
          : null;

        flushPlaybackTracking(state);
        rebuildGaplessQueue(
          state,
          newCurrentTrack.filePath,
          futureNextTrack?.filePath ?? null,
          !state.paused,
        );

        updateMediaSession(newCurrentTrack);
        playbackTracker.startTrackingTrack(newCurrentTrack.id);
        get().setLastPlayedSongId(newCurrentTrack.id);

        return {
          currentTrack: newCurrentTrack,
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
          duration: newCurrentTrack.duration,
          queueTrackIds: newQueue.trackIds,
          queueCurrentIndex: newQueue.currentIndex,
        };
      });
      get().refreshPrevNextBoundaries();
    },

    /**
     * Drop queue entries whose track IDs are no longer in the library.
     * Called from libraryStore.loadLibrary after a refresh, so a track
     * delete (single or bulk) keeps the queue / currentTrack consistent.
     *
     * If the currently-playing track survived deletion, we don't touch
     * Gapless. If it was deleted, syncWithLibrary advances the pointer
     * to the next surviving track and we restart Gapless from there.
     */
    syncQueueWithLibrary: (validTrackIds: ReadonlySet<string>) => {
      set((state) => {
        if (state.queueTrackIds.length === 0) return {};

        const oldCurrentId =
          state.queueCurrentIndex >= 0
            ? state.queueTrackIds[state.queueCurrentIndex]
            : null;

        const newQueue = syncQueueWithLib(getQueueState(state), validTrackIds);

        if (
          newQueue.trackIds.length === state.queueTrackIds.length &&
          newQueue.currentIndex === state.queueCurrentIndex
        ) {
          return {};
        }

        if (newQueue.trackIds.length === 0) {
          if (state.player) {
            state.player.pause();
            state.player.removeAllTracks();
          }
          if (state.silentAudioRef) state.silentAudioRef.pause();
          return {
            queueTrackIds: [],
            queueCurrentIndex: -1,
            currentTrack: null,
            paused: true,
            position: 0,
            duration: 0,
          };
        }

        const newCurrentId = newQueue.trackIds[newQueue.currentIndex];
        const library = useLibraryStore.getState().tracks;
        const newCurrentTrack = library.find((t) => t.id === newCurrentId);

        // Common case: current track unchanged, just trimmed past/future.
        // Pointer changed, but it's pointing at the same track ID.
        if (oldCurrentId && oldCurrentId === newCurrentId) {
          return {
            queueTrackIds: newQueue.trackIds,
            queueCurrentIndex: newQueue.currentIndex,
          };
        }

        // Current track was deleted — advance to the new current.
        if (!newCurrentTrack || !state.player) {
          return {
            queueTrackIds: newQueue.trackIds,
            queueCurrentIndex: newQueue.currentIndex,
          };
        }

        const futureNextId = peekNextQueueId(
          newQueue,
          state.repeatMode,
          state.shuffleMode,
        );
        const futureNextTrack = futureNextId
          ? library.find((t) => t.id === futureNextId)
          : null;

        rebuildGaplessQueue(
          state,
          newCurrentTrack.filePath,
          futureNextTrack?.filePath ?? null,
          !state.paused,
        );

        updateMediaSession(newCurrentTrack);
        playbackTracker.startTrackingTrack(newCurrentTrack.id);
        get().setLastPlayedSongId(newCurrentTrack.id);

        return {
          currentTrack: newCurrentTrack,
          position: 0,
          lastPosition: 0,
          lastPlaybackTimeUpdateRef: Date.now(),
          duration: newCurrentTrack.duration,
          queueTrackIds: newQueue.trackIds,
          queueCurrentIndex: newQueue.currentIndex,
        };
      });
      get().refreshPrevNextBoundaries();
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
