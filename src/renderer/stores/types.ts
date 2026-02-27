import { Gapless5 } from '@regosen/gapless-5';
import { Track, Playlist, Settings } from '../../types/dbTypes';

// Define the notification type
export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  autoHideDuration?: number;
}

// Search index data for fast text searching
export interface SearchIndexData {
  titleLower: string;
  artistLower: string;
  albumLower: string;
  genreLower: string;
}

// Library Store Types
export interface LibraryStore {
  tracks: Track[];
  playlists: Playlist[];
  isLoading: boolean;
  isScanning: boolean;
  selectedPlaylistId: string | null;
  selectedTrackId: string | null;
  libraryViewState: {
    sorting: any;
    filtering: string;
  };
  artistFilter: string | null;
  playlistViewState: {
    sorting: any;
    filtering: string;
    playlistId: string | null;
  };
  lastViewedTrackId: string | null;

  // NEW: Indexed data structures for O(1) lookups
  trackIndex: Map<string, Track>; // trackId -> Track
  artistIndex: Map<string, Set<string>>; // artist -> Set<trackIds>
  albumIndex: Map<string, Set<string>>; // album -> Set<trackIds>
  searchIndex: Map<string, SearchIndexData>; // trackId -> pre-computed search data

  // Actions
  // import related actions
  loadLibrary: (isInitialLoad?: boolean) => Promise<void>;
  loadPlaylists: () => Promise<void>;
  scanLibrary: (libraryPath: string) => Promise<void>;
  importFiles: (files: string[]) => Promise<void>;
  // user actions
  selectPlaylist: (playlistId: string | null) => void;
  selectTrack: (trackId: string | null) => void;
  createPlaylist: (name: string) => Promise<void>;
  updatePlaylist: (playlist: Playlist) => Promise<void>;
  deletePlaylist: (playlistId: string) => Promise<void>;
  addTrackToPlaylist: (trackId: string, playlistId: string) => Promise<void>;
  updateLibraryViewState: (sorting: any, filtering: string) => void;
  updatePlaylistViewState: (
    sorting: any,
    filtering: string,
    playlistId: string | null,
  ) => void;
  setLastViewedTrackId: (trackId: string | null) => void;
  setArtistFilter: (artist: string | null) => void;

  // Per-playlist sort preferences (session cache + DB backed)
  playlistSortPreferences: Record<string, Array<{ id: string; desc: boolean }>>;
  setPlaylistSortPreference: (
    playlistId: string,
    sorting: Array<{ id: string; desc: boolean }>,
  ) => void;

  // NEW: Efficient data access methods
  getTrackById: (id: string) => Track | undefined;
  getTracksByIds: (ids: string[]) => Track[];
  getTracksByArtist: (artist: string) => Track[];
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
  playbackContextArtistFilter: string | null; // the artist filter that was active when playback started
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
  artistBrowserOpen: boolean;
  showNotification: (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error',
    autoHideDuration?: number,
  ) => void;
  removeNotification: (id: string) => void;
  clearAllNotifications: () => void;
  setCurrentView: (view: 'library' | 'playlists') => void;
  setSettingsOpen: (open: boolean) => void;
  setArtistBrowserOpen: (open: boolean) => void;
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
  playbackContextArtistFilter: string | null;
  repeatMode: 'off' | 'track' | 'all';
  shuffleMode: boolean;
  shuffleHistory: Track[];
  shuffleHistoryPosition: number;

  // Internal state
  player: Gapless5 | null;
  lastPositionUpdateRef: number;
  lastPlaybackTimeUpdateRef: number;
  lastPosition: number;
  silentAudioRef: HTMLAudioElement | null;

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
}
