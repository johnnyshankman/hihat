import { Gapless5 } from '@regosen/gapless-5';
import { Track, Playlist, Settings } from '../../types/dbTypes';

// Define the notification type
export interface Notification {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  autoHideDuration?: number;
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
  playlistViewState: {
    sorting: any;
    filtering: string;
    playlistId: string | null;
  };

  // Actions
  // import related actions
  loadLibrary: () => Promise<void>;
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
}

// Playback Store Types
export interface PlaybackStore {
  currentTrack: Track | null; // the current Track playing (DB type)
  paused: boolean; // play pause state
  position: number; // current position of the track
  duration: number; // duration of the track
  volume: number; // volume of the global player
  playbackSource: 'library' | 'playlist'; // the source of the playback (library or playlist)
  repeatMode: 'off' | 'track' | 'all'; // off, track, all
  shuffleMode: boolean; // shuffle mode
  shuffleHistory: Track[]; // history of shuffled tracks

  // Internal state (not exposed in the context API)
  player: Gapless5 | null;
  lastPositionUpdateRef: number;
  initPlayer: () => void;

  // // Actions
  // // table actions
  selectSpecificSong: (trackId: string, source: 'library' | 'playlist') => void;
  // // player actions
  setPaused: (paused: boolean) => void;
  skipToNextTrack: () => void;
  skipToPreviousTrack: () => void;
  seekToPosition: (position: number) => void;
  setVolume: (volume: number) => void;
  toggleRepeatMode: () => void;
  toggleShuffleMode: () => void;
  // // automatic actions (onfinishedtrack)
  autoPlayNextTrack: () => Promise<void>;
}

// Settings Store Types
export interface SettingsStore {
  settings: Settings | null;

  // Actions
  loadSettings: () => Promise<void>;
  updateColumnVisibility: (column: string, isVisible: boolean) => Promise<void>;
  updateTheme: (theme: 'light' | 'dark') => Promise<void>;
}

// UI Store Types
export interface UIStore {
  theme: 'light' | 'dark' | null;
  notifications: Notification[];
  currentView: 'library' | 'playlists' | 'settings';
  // Actions
  setTheme: (theme: 'light' | 'dark' | null) => void;
  showNotification: (
    message: string,
    type: 'info' | 'success' | 'warning' | 'error',
    autoHideDuration?: number,
  ) => void;
  removeNotification: (id: string) => void;
  setCurrentView: (view: 'library' | 'playlists' | 'settings') => void;
}
