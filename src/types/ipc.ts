/**
 * IPC Types
 *
 * This file defines TypeScript types for Inter-Process Communication (IPC)
 * between the main Electron process and the renderer process.
 */

import { Track, Playlist, Settings, MetadataToWrite } from './dbTypes';

/**
 * All available IPC channels for the application
 */
export type Channels =
  // Library operations
  | 'library:scan'
  | 'library:import'
  | 'library:backup'
  | 'library:restore'
  | 'library:scanProgress'
  | 'library:scanComplete'
  | 'library:resetDatabase'
  | 'library:resetTracks'
  | 'menu-backup-library'
  | 'backup-library-success'
  | 'backup-library-error'
  | 'backup-library-progress'

  // Track operations
  | 'tracks:getAll'
  | 'tracks:getById'
  | 'tracks:add'
  | 'tracks:update'
  | 'tracks:updateMetadata'
  | 'tracks:updatePlayCount'
  | 'tracks:delete'

  // Playlist operations
  | 'playlists:getAll'
  | 'playlists:getById'
  | 'playlists:create'
  | 'playlists:update'
  | 'playlists:delete'
  | 'playlists:getSmartTracks'

  // Settings operations
  | 'settings:get'
  | 'settings:update'

  // Dialog operations
  | 'dialog:select-directory'
  | 'dialog:select-files'

  // App operations
  | 'app:restart'
  | 'app:open-in-browser'
  | 'app:getLogFilePath'

  // UI operations
  | 'ui:toggleSidebar'
  | 'ui:openSettings'

  // File system operations
  | 'fileSystem:fileExists'
  | 'fileSystem:showInFinder'
  | 'fileSystem:downloadAlbumArt'
  | 'fileSystem:deleteFile'

  // Playback operations
  | 'playback:play'
  | 'playback:pause'
  | 'playback:resume'
  | 'playback:stop'
  | 'playback:next'
  | 'playback:previous'
  | 'playback:seek'
  | 'playback:setVolume'
  | 'playback:getStatus'
  | 'playback:trackChanged'
  | 'playback:stateChanged'
  | 'playback:positionChanged'

  // MiniPlayer operations
  | 'miniPlayer:open'
  | 'miniPlayer:close'
  | 'miniPlayer:requestState'
  | 'miniPlayer:playPause'
  | 'miniPlayer:nextTrack'
  | 'miniPlayer:previousTrack'
  | 'miniPlayer:seek'
  | 'miniPlayer:setVolume'
  | 'miniPlayer:toggleRepeat'
  | 'miniPlayer:toggleShuffle'
  | 'miniPlayer:trackChanged'
  | 'miniPlayer:stateChanged'
  | 'miniPlayer:positionChanged'
  | 'miniPlayer:albumArtChanged'

  // Player-MiniPlayer sync operations
  | 'player:stateUpdate'
  | 'player:trackUpdate'
  | 'player:positionUpdate'
  | 'player:pausePlayback'
  | 'player:resumePlayback'
  | 'player:seek'
  | 'player:setVolume'
  | 'player:toggleRepeat'
  | 'player:toggleShuffle'

  // Album Art operations
  | 'albumArt:get'

  // Migration operations
  | 'migration:start'
  | 'migration:progress'
  | 'migration:complete';

/**
 * Request types for each IPC channel
 */
export interface IPCRequests {
  // Library operations
  'library:scan': { libraryPath: string };
  'library:import': { files: string[] };
  'library:backup': { backupPath: string };
  'library:restore': { restorePath: string };
  'library:scanProgress': {
    processed: number;
    total: number;
    currentFile: string;
  };
  'library:scanComplete': { tracksAdded: number };
  'library:resetDatabase': void;
  'library:resetTracks': void;

  // Track operations
  'tracks:getAll': void;
  'tracks:getById': { id: string };
  'tracks:add': Omit<Track, 'id'>;
  'tracks:update': Track;
  'tracks:updateMetadata': {
    id: string;
    metadata: MetadataToWrite;
  };
  'tracks:updatePlayCount': { id: string; date: string };
  'tracks:delete': { id: string };

  // Playlist operations
  'playlists:getAll': void;
  'playlists:getById': { id: string };
  'playlists:create': Omit<Playlist, 'id'>;
  'playlists:update': Playlist;
  'playlists:delete': { id: string };
  'playlists:getSmartTracks': { ruleSet: Playlist['ruleSet'] };

  // Settings operations
  'settings:get': void;
  'settings:update': { settings: Settings };

  // Dialog operations
  'dialog:select-directory': void;
  'dialog:select-files': void;

  // App operations
  'app:restart': void;
  'app:open-in-browser': { link: string };
  'app:getLogFilePath': void;

  // UI operations
  'ui:toggleSidebar': void;
  'ui:openSettings': void;

  // File system operations
  'fileSystem:fileExists': { filePath: string };
  'fileSystem:showInFinder': { filePath: string };
  'fileSystem:downloadAlbumArt': { track: Track };
  'fileSystem:deleteFile': { filePath: string };

  // Playback operations
  'playback:play': { trackId: string };
  'playback:pause': void;
  'playback:resume': void;
  'playback:stop': void;
  'playback:next': void;
  'playback:previous': void;
  'playback:seek': { position: number };
  'playback:setVolume': { volume: number };
  'playback:getStatus': void;
  'playback:trackChanged': { track: Track | null };
  'playback:stateChanged': { isPlaying: boolean };
  'playback:positionChanged': { position: number; duration: number };

  // MiniPlayer operations
  'miniPlayer:open': void;
  'miniPlayer:close': void;
  'miniPlayer:requestState': void;
  'miniPlayer:playPause': void;
  'miniPlayer:nextTrack': void;
  'miniPlayer:previousTrack': void;
  'miniPlayer:seek': number;
  'miniPlayer:setVolume': number;
  'miniPlayer:toggleRepeat': void;
  'miniPlayer:toggleShuffle': void;
  'miniPlayer:trackChanged': Track | null;
  'miniPlayer:stateChanged': {
    isPlaying: boolean;
    duration: number;
    volume: number;
    repeatMode: 'off' | 'track' | 'all';
    shuffleMode: boolean;
  };
  'miniPlayer:positionChanged': number;
  'miniPlayer:albumArtChanged': string | null;

  // Player-MiniPlayer sync operations
  'player:stateUpdate': {
    isPlaying: boolean;
    duration: number;
    volume: number;
    repeatMode: 'off' | 'track' | 'all';
    shuffleMode: boolean;
  };
  'player:trackUpdate': Track | null;
  'player:positionUpdate': number;
  'player:pausePlayback': void;
  'player:resumePlayback': void;
  'player:seek': number;
  'player:setVolume': number;
  'player:toggleRepeat': void;
  'player:toggleShuffle': void;

  // Album Art operations
  'albumArt:get': string;

  // Migration operations
  'migration:start': void;
  'migration:progress': {
    phase: 'starting' | 'reading' | 'converting' | 'importing' | 'complete';
    message: string;
  };
  'migration:complete': {
    tracksCount: number;
    playlistsCount: number;
  };

  // New channels
  'menu-backup-library': string;
  'backup-library-success': void;
  'backup-library-error': string;
  'backup-library-progress': {
    phase: string;
    status: string;
    currentFile?: string;
    progress?: number;
    currentTransfer?: number;
    remaining?: number;
    total?: number;
    transferSpeed?: string;
    filesProcessed?: number;
    totalFiles?: number;
  };
}

/**
 * Response types for each IPC channel
 */
export interface IPCResponses {
  // Library operations
  'library:scan': { success: boolean; message: string; tracksAdded: number };
  'library:import': { success: boolean; message: string; tracksAdded: number };
  'library:backup': { success: boolean } | { error: string };
  'library:restore': { success: boolean } | { error: string };
  'library:scanProgress': {
    processed: number;
    total: number;
    currentFile: string;
  };
  'library:scanComplete': { tracksAdded: number };
  'library:resetDatabase': { success: boolean; message: string };
  'library:resetTracks': { success: boolean; message: string };

  // Track operations
  'tracks:getAll': Track[];
  'tracks:getById': Track | null;
  'tracks:add': Track;
  'tracks:update': boolean;
  'tracks:updateMetadata': {
    success: boolean;
    fileWriteSuccess: boolean;
    message?: string;
  };
  'tracks:updatePlayCount': boolean;
  'tracks:delete': boolean;

  // Playlist operations
  'playlists:getAll': Playlist[];
  'playlists:getById': Playlist | null;
  'playlists:create': Playlist;
  'playlists:update': boolean;
  'playlists:delete': boolean;
  'playlists:getSmartTracks': Track[];

  // Settings operations
  'settings:get': Settings;
  'settings:update': boolean;

  // Dialog operations
  'dialog:select-directory':
    | { canceled: boolean; filePaths: string[] }
    | { error: string };
  'dialog:select-files':
    | { canceled: boolean; filePaths: string[] }
    | { error: string };

  // App operations
  'app:restart': boolean;
  'app:open-in-browser': { success: boolean; message?: string };
  'app:getLogFilePath': { path: string | null; exists: boolean };

  // UI operations
  'ui:toggleSidebar': boolean;
  'ui:openSettings': void;

  // File system operations
  'fileSystem:fileExists': boolean;
  'fileSystem:showInFinder': { success: boolean; message?: string };
  'fileSystem:downloadAlbumArt': {
    success: boolean;
    message?: string;
    filePath?: string;
  };
  'fileSystem:deleteFile': {
    success: boolean;
    message?: string;
  };

  // Playback operations
  'playback:play': boolean;
  'playback:pause': boolean;
  'playback:resume': boolean;
  'playback:stop': boolean;
  'playback:next': boolean;
  'playback:previous': boolean;
  'playback:seek': boolean;
  'playback:setVolume': boolean;
  'playback:getStatus': {
    isPlaying: boolean;
    currentTrack: Track | null;
    position: number;
    duration: number;
    volume: number;
  };
  'playback:trackChanged': { track: Track | null };
  'playback:stateChanged': { isPlaying: boolean };
  'playback:positionChanged': { position: number; duration: number };

  // MiniPlayer operations
  'miniPlayer:open': void;
  'miniPlayer:close': void;
  'miniPlayer:requestState': void;
  'miniPlayer:playPause': void;
  'miniPlayer:nextTrack': void;
  'miniPlayer:previousTrack': void;
  'miniPlayer:seek': void;
  'miniPlayer:setVolume': void;
  'miniPlayer:toggleRepeat': void;
  'miniPlayer:toggleShuffle': void;
  'miniPlayer:trackChanged': void;
  'miniPlayer:stateChanged': void;
  'miniPlayer:positionChanged': void;
  'miniPlayer:albumArtChanged': void;

  // Player-MiniPlayer sync operations
  'player:stateUpdate': void;
  'player:trackUpdate': void;
  'player:positionUpdate': void;
  'player:pausePlayback': void;
  'player:resumePlayback': void;
  'player:seek': void;
  'player:setVolume': void;
  'player:toggleRepeat': void;
  'player:toggleShuffle': void;

  // Album Art operations
  'albumArt:get': string | null;

  // Migration operations
  'migration:start': void;
  'migration:progress': void;
  'migration:complete': void;

  // New channels
  'menu-backup-library': void;
  'backup-library-success': void;
  'backup-library-error': void;
  'backup-library-progress': void;
}

/**
 * Type for IPC handler functions
 */
export type IPCHandler<C extends Channels> = (
  args: IPCRequests[C],
) => Promise<IPCResponses[C]>;

/**
 * Type for IPC invoker functions
 */
export type IPCInvoker<C extends Channels> = (
  args: IPCRequests[C],
) => Promise<IPCResponses[C]>;

/**
 * IPC event channels that are sent from main to renderer
 */
export type IPCEvents =
  | 'playback:trackChanged'
  | 'playback:stateChanged'
  | 'playback:positionChanged'
  | 'library:scanProgress'
  | 'library:scanComplete'
  | 'backup-library-success'
  | 'backup-library-error'
  | 'backup-library-progress'
  | 'ui:toggleSidebar'
  | 'ui:openSettings'
  | 'player:playPause'
  | 'player:nextTrack'
  | 'player:previousTrack'
  | 'player:seek'
  | 'player:setVolume'
  | 'player:toggleRepeat'
  | 'player:toggleShuffle'
  | 'player:pausePlayback'
  | 'player:resumePlayback'
  | 'miniPlayer:trackChanged'
  | 'miniPlayer:stateChanged'
  | 'miniPlayer:positionChanged'
  | 'miniPlayer:albumArtChanged'
  | 'migration:start'
  | 'migration:progress'
  | 'migration:complete';

/**
 * Union type for all IPC channels
 */
export type IPCChannel = Channels | IPCEvents;
