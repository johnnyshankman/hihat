import { Gapless5 } from '@regosen/gapless-5';
import { Track, Playlist, Settings } from '../../types/dbTypes';

// Define the notification type
export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
}

// Search index data for fast text searching
export interface SearchIndexData {
  titleLower: string;
  artistLower: string;
  albumLower: string;
  genreLower: string;
}

// Browser filter state for the two-column browser panel
export interface BrowserFilter {
  artist: string | null; // selected album artist, null = "All"
  album: string | null; // selected album, null = "All"
}

// Library Store Types
//
// libraryStore holds only client/UI state. Server state (tracks,
// playlists, settings) lives in TanStack Query — see
// src/renderer/queries/. Components consume `useTracks()`,
// `usePlaylists()`, `useSettings()` for reads and the matching
// mutation hooks for writes.
export interface LibraryStore {
  // ── UI / view state ─────────────────────────────────────────────
  selectedPlaylistId: string | null;
  selectedTrackId: string | null;
  lastViewedTrackId: string | null;

  libraryViewState: {
    sorting: any;
    filtering: string;
  };
  playlistViewState: {
    sorting: any;
    filtering: string;
    playlistId: string | null;
  };

  // Per-view browser filters (keyed by 'library' or playlist ID)
  browserFilters: Record<string, BrowserFilter>;
  // Per-view search filters (keyed by 'library' or playlist ID)
  searchFilters: Record<string, string>;

  // Per-playlist sort preferences. Session cache so the user's in-flight
  // sort changes don't trigger re-renders of the playlists query data
  // (which would loop). The setter persists to the DB via TanStack Query
  // mutation under the hood and rolls back on failure.
  playlistSortPreferences: Record<string, Array<{ id: string; desc: boolean }>>;

  // ── Actions ─────────────────────────────────────────────────────
  selectPlaylist: (playlistId: string | null) => void;
  selectTrack: (trackId: string | null) => void;

  updateLibraryViewState: (sorting: any, filtering: string) => void;
  updatePlaylistViewState: (
    sorting: any,
    filtering: string,
    playlistId: string | null,
  ) => void;
  setLastViewedTrackId: (trackId: string | null) => void;

  setBrowserFilter: (viewId: string, filter: BrowserFilter) => void;
  clearBrowserFilter: (viewId: string) => void;
  clearAllBrowserFilters: () => void;
  getBrowserFilter: (viewId: string) => BrowserFilter;

  setSearchFilter: (viewId: string, filter: string) => void;
  getSearchFilter: (viewId: string) => string;

  setPlaylistSortPreference: (
    playlistId: string,
    sorting: Array<{ id: string; desc: boolean }>,
  ) => void;

  // Seed the session sort-pref cache from playlists data when the
  // playlists query first resolves. Called once from a top-level effect
  // in `App.tsx` rather than fetched directly by the store (the store
  // doesn't import the queries layer to avoid circular deps).
  seedPlaylistSortPreferences: (playlists: Playlist[]) => void;
}

// Playback Store Types
export interface PlaybackStore {
  currentTrack: Track | null; // the current Track playing (DB type)
  paused: boolean; // play pause state
  position: number; // current position of the track
  duration: number; // duration of the track
  volume: number; // volume of the global player
  playbackSource: 'library' | 'playlist'; // the source of the playback (library or playlist)
  playbackSourcePlaylistId: string | null; // the ID of the specific playlist if playbackSource is 'playlist'
  playbackContextBrowserFilter: BrowserFilter | null; // the browser filter that was active when playback started
  repeatMode: 'off' | 'track' | 'all'; // off, track, all
  shuffleMode: boolean; // shuffle mode
  shuffleHistory: Track[]; // history of shuffled tracks
  shuffleHistoryPosition: number; // current position in shuffle history (-1 means at the tip)

  // Internal state (not exposed in the context API)
  player: Gapless5 | null;
  lastPositionUpdateRef: number;
  // New properties for play count tracking
  lastPlaybackTimeUpdateRef: number; // timestamp of last update for playback time tracking
  lastPosition: number; // last position for calculating actual playback time
  silentAudioRef: HTMLAudioElement | null; // reference to the silent audio element for MediaSession
  initPlayer: () => void; // initialize the player instance

  // Actions
  // table actions
  selectSpecificSong: (
    trackId: string,
    source: 'library' | 'playlist',
    playlistId?: string | null,
  ) => void;
  // player actions
  setPaused: (paused: boolean) => void;
  skipToNextTrack: () => void;
  skipToPreviousTrack: () => void;
  seekToPosition: (position: number) => void;
  setVolume: (volume: number) => void;
  toggleRepeatMode: () => void;
  toggleShuffleMode: () => void;
  setSilentAudioRef: (ref: HTMLAudioElement | null) => void; // set the silent audio element reference
  // automatic actions (onfinishedtrack)
  autoPlayNextTrack: () => Promise<void>;
}

// Settings Store Types
export interface SettingsStore {
  libraryPath: Settings['libraryPath'];
  theme: Settings['theme'];
  columns: Settings['columns'];
  id: Settings['id'];
  lastPlayedSongId: Settings['lastPlayedSongId'];
  volume: Settings['volume'];
  columnWidths: Settings['columnWidths'];

  // Actions
  loadSettings: () => Promise<void>;
  setColumnVisibility: (column: string, isVisible: boolean) => Promise<void>;
  setColumnWidths: (columnWidths: Record<string, number>) => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => Promise<void>;
  setLibraryPath: (libraryPath: Settings['libraryPath']) => Promise<void>;
  setLastPlayedSongId: (trackId: string | null) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
}

// UI Store Types
export interface UIStore {
  notifications: Notification[];
  currentView: 'library' | 'playlists';
  settingsOpen: boolean;
  browserOpen: boolean;
  sidebarOpen: boolean;
  showNotification: (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error',
  ) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  notificationPanelOpen: boolean;
  setNotificationPanelOpen: (open: boolean) => void;
  setCurrentView: (view: 'library' | 'playlists') => void;
  setSettingsOpen: (open: boolean) => void;
  setBrowserOpen: (open: boolean) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
}

// Combined Settings and Playback Store Types
export interface SettingsAndPlaybackStore {
  // Settings state
  libraryPath: Settings['libraryPath'];
  theme: Settings['theme'];
  columns: Settings['columns'];
  id: Settings['id'];
  lastPlayedSongId: Settings['lastPlayedSongId'];
  columnWidths: Settings['columnWidths'];
  librarySorting: Settings['librarySorting'];
  columnOrder: Settings['columnOrder'];

  // Playback state
  currentTrack: Track | null;
  paused: boolean;
  position: number;
  duration: number;
  volume: number; // Shared state between settings and playback
  playbackSource: 'library' | 'playlist';
  playbackSourcePlaylistId: string | null;
  playbackContextBrowserFilter: BrowserFilter | null;
  repeatMode: 'off' | 'track' | 'all';
  shuffleMode: boolean;
  shuffleHistory: Track[];
  shuffleHistoryPosition: number;

  // Derived boundary state: true when the Next button should be enabled.
  // Stored (rather than computed per-render) so large libraries don't pay
  // O(n log n) filter/sort on every store update — refreshed by
  // refreshCanGoNext at mutation points that can change the answer.
  canGoNext: boolean;

  // Internal state
  player: Gapless5 | null;
  lastPositionUpdateRef: number;
  lastPlaybackTimeUpdateRef: number;
  lastPosition: number;
  silentAudioRef: HTMLAudioElement | null;

  // Track preloaded at Gapless-5 queue index 1. Written by every site that
  // mutates the player queue; read by autoPlayNextTrack (as the new
  // currentTrack after auto-advance) and by skipToNextTrack's fast-path
  // eligibility check. Source of truth is the store, not player.getTracks().
  preloadedTrack: Track | null;
  // True once Gapless-5's onload event reports the preloaded track as
  // fully decoded and ready for a gapless transition. Reset to false any
  // time preloadedTrack changes.
  preloadReady: boolean;
  // Count of stale finished tracks sitting at the front of Gapless-5's
  // queue from prior auto-advances. See the leak note in playerQueue.ts.
  // Incremented once per auto-advance, reset to 0 on any full rebuild
  // (syncPlayerQueue) or on the fast-path cleanup in skipToNextTrack.
  // Used only to tell the fast path how many removeTrack(0) calls it
  // needs to execute after gotoTrack — never read as authoritative
  // playback state.
  queueLeadingStaleCount: number;

  // Combined actions
  // Settings actions
  loadSettings: () => Promise<Settings>;
  setColumnVisibility: (column: string, isVisible: boolean) => Promise<void>;
  setColumnWidths: (columnWidths: Record<string, number>) => Promise<void>;
  setLibrarySorting: (
    sorting: Array<{ id: string; desc: boolean }>,
  ) => Promise<void>;
  setColumnOrder: (columnOrder: string[]) => Promise<void>;
  setTheme: (theme: 'light' | 'dark') => Promise<void>;
  setLibraryPath: (libraryPath: Settings['libraryPath']) => Promise<void>;
  setLastPlayedSongId: (trackId: string | null) => Promise<void>;

  // Volume is shared between settings and playback
  setVolume: (volume: number) => void;

  // Playback actions
  initPlayer: () => void;
  selectSpecificSong: (
    trackId: string,
    source: 'library' | 'playlist',
    playlistId?: string | null,
  ) => void;
  setPaused: (paused: boolean) => void;
  skipToNextTrack: () => void;
  skipToPreviousTrack: () => void;
  seekToPosition: (position: number) => void;
  toggleRepeatMode: () => void;
  toggleShuffleMode: () => void;
  setSilentAudioRef: (ref: HTMLAudioElement | null) => void;
  autoPlayNextTrack: () => Promise<void>;
  refreshCanGoNext: () => void;
}
