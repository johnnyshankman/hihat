/**
 * Preload Script
 *
 * This script runs in the renderer process before the web page is loaded.
 * It exposes a safe subset of Node.js and Electron APIs to the renderer process
 * through the contextBridge.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import {
  Channels,
  IPCRequests,
  IPCResponses,
  PlayerPlaybackState,
} from '../types/ipc';
import { MetadataToWrite, Track } from '../types/dbTypes';

/**
 * Exposes IPC functions to the renderer process
 */
const electronHandler = {
  // Generic IPC functions
  //
  // NOTE: The `sendMessage`, `on`, and `once` methods below accept untyped
  // `unknown[]` rest args and bypass the typed namespaced wrappers (e.g.
  // `library.onScanProgress`, `player.onPlayPause`). Use the namespaced
  // wrappers in renderer code; these generic methods exist as an internal
  // escape hatch only.
  ipcRenderer: {
    /**
     * @deprecated Use the typed namespaced wrappers instead (e.g.
     * `window.electron.player.sendStateUpdate(state)`,
     * `window.electron.backup.start(path)`).
     */
    sendMessage<C extends Channels>(channel: C, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },

    /**
     * @deprecated Use the typed namespaced subscription wrappers instead
     * (e.g. `window.electron.library.onScanProgress(cb)`,
     * `window.electron.player.onPlayPause(cb)`). They return the same
     * unsubscribe function and provide typed payloads.
     */
    on<C extends Channels>(
      channel: C,
      func: (...args: unknown[]) => void,
    ): () => void {
      const subscription = (_event: IpcRendererEvent, ...args: unknown[]) =>
        func(...args);
      ipcRenderer.on(channel, subscription);

      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    },

    /**
     * @deprecated Prefer the typed namespaced subscription wrappers.
     */
    once<C extends Channels>(channel: C, func: (...args: unknown[]) => void) {
      ipcRenderer.once(channel, (_event, ...args) => func(...args));
    },

    /**
     * Invoke a function in the main process and wait for a response
     * @param channel - The IPC channel to invoke
     * @param args - Arguments to pass to the main process
     * @returns A promise that resolves with the response from the main process
     */
    invoke<C extends Channels>(
      channel: C,
      args?: IPCRequests[C] | undefined,
    ): Promise<IPCResponses[C]> {
      return ipcRenderer.invoke(channel, args);
    },
  },

  // Library management functions
  library: {
    /**
     * Scan a directory for music files and add them to the library
     * @param libraryPath - Path to the directory to scan
     */
    scan(libraryPath: string) {
      return ipcRenderer.invoke('library:scan', { libraryPath });
    },

    /**
     * Import specific files into the library
     * @param files - Array of file paths to import
     */
    import(files: string[]) {
      return ipcRenderer.invoke('library:import', { files });
    },

    /**
     * Backup the library database
     * @param backupPath - Path to save the backup to
     */
    backup(backupPath: string) {
      return ipcRenderer.invoke('library:backup', { backupPath });
    },

    /**
     * Restore the library database from a backup
     * @param restorePath - Path to the backup file
     */
    restore(restorePath: string) {
      return ipcRenderer.invoke('library:restore', { restorePath });
    },

    /**
     * Reset the database by deleting it and reinitializing
     */
    resetDatabase() {
      return ipcRenderer.invoke('library:resetDatabase');
    },

    /**
     * Reset only the tracks table, keeping playlists and settings intact
     */
    resetTracks() {
      return ipcRenderer.invoke('library:resetTracks');
    },

    /**
     * Subscribe to library scan progress events.
     * @returns Unsubscribe function. Call it on cleanup to remove the listener.
     */
    onScanProgress(
      callback: (data: {
        processed: number;
        total: number;
        current: string;
      }) => void,
    ): () => void {
      const subscription = (
        _event: IpcRendererEvent,
        data: { processed: number; total: number; current: string },
      ) => callback(data);
      ipcRenderer.on('library:scanProgress', subscription);
      return () => {
        ipcRenderer.removeListener('library:scanProgress', subscription);
      };
    },

    /**
     * Subscribe to library scan completion. Fires once per scan.
     * @returns Unsubscribe function.
     */
    onScanComplete(
      callback: (data: {
        tracksAdded: number;
        tracksRemoved: number;
        // `error` is included for backward-compat with the existing scanner
        // event payload (scanner emits `{ error: string }` on failure).
        error?: string;
      }) => void,
    ): () => void {
      const subscription = (
        _event: IpcRendererEvent,
        data: { tracksAdded: number; tracksRemoved: number; error?: string },
      ) => callback(data);
      ipcRenderer.on('library:scanComplete', subscription);
      return () => {
        ipcRenderer.removeListener('library:scanComplete', subscription);
      };
    },
  },

  // Library backup (kebab-case channels for legacy reasons)
  backup: {
    /**
     * Trigger a library backup. Fire-and-forget — progress and completion
     * arrive over the `onProgress`, `onSuccess`, and `onError` events.
     */
    start(backupPath: string) {
      ipcRenderer.send('menu-backup-library', backupPath);
    },

    /**
     * Subscribe to backup completion (success). @returns Unsubscribe.
     */
    onSuccess(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('backup-library-success', subscription);
      return () => {
        ipcRenderer.removeListener('backup-library-success', subscription);
      };
    },

    /**
     * Subscribe to backup errors. @returns Unsubscribe.
     */
    onError(callback: (message: string) => void): () => void {
      const subscription = (_event: IpcRendererEvent, message: string) =>
        callback(message);
      ipcRenderer.on('backup-library-error', subscription);
      return () => {
        ipcRenderer.removeListener('backup-library-error', subscription);
      };
    },

    /**
     * Subscribe to backup progress events. @returns Unsubscribe.
     */
    onProgress(
      callback: (data: {
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
      }) => void,
    ): () => void {
      const subscription = (
        _event: IpcRendererEvent,
        data: Parameters<typeof callback>[0],
      ) => callback(data);
      ipcRenderer.on('backup-library-progress', subscription);
      return () => {
        ipcRenderer.removeListener('backup-library-progress', subscription);
      };
    },
  },

  // Migration (v1 → v2) functions
  migration: {
    /**
     * Subscribe to migration start. @returns Unsubscribe.
     */
    onStart(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('migration:start', subscription);
      return () => {
        ipcRenderer.removeListener('migration:start', subscription);
      };
    },

    /**
     * Subscribe to migration progress. @returns Unsubscribe.
     */
    onProgress(
      callback: (data: {
        phase: 'starting' | 'reading' | 'converting' | 'importing' | 'complete';
        message: string;
      }) => void,
    ): () => void {
      const subscription = (
        _event: IpcRendererEvent,
        data: Parameters<typeof callback>[0],
      ) => callback(data);
      ipcRenderer.on('migration:progress', subscription);
      return () => {
        ipcRenderer.removeListener('migration:progress', subscription);
      };
    },

    /**
     * Subscribe to migration completion. @returns Unsubscribe.
     */
    onComplete(
      callback: (data: {
        tracksCount: number;
        playlistsCount: number;
      }) => void,
    ): () => void {
      const subscription = (
        _event: IpcRendererEvent,
        data: { tracksCount: number; playlistsCount: number },
      ) => callback(data);
      ipcRenderer.on('migration:complete', subscription);
      return () => {
        ipcRenderer.removeListener('migration:complete', subscription);
      };
    },
  },

  // File system operations
  fileSystem: {
    /**
     * Check if a file exists
     * @param filePath - Path to the file
     * @returns Promise that resolves to a boolean indicating if the file exists
     */
    fileExists(filePath: string) {
      return ipcRenderer.invoke('fileSystem:fileExists', { filePath });
    },

    /**
     * Show a file in Finder (macOS) or Explorer (Windows)
     * @param filePath - Path to the file
     * @returns Promise that resolves to an object with success status
     */
    showInFinder(filePath: string) {
      return ipcRenderer.invoke('fileSystem:showInFinder', { filePath });
    },

    /**
     * Download album art for a track to the user's Downloads folder
     * @param track - The track to download album art for
     * @returns Promise that resolves to an object with success status
     */
    downloadAlbumArt(track: Track) {
      return ipcRenderer.invoke('fileSystem:downloadAlbumArt', { track });
    },

    /**
     * Delete a file from the file system
     * @param filePath - Path to the file to delete
     * @returns Promise that resolves to an object with success status
     */
    deleteFile(filePath: string) {
      return ipcRenderer.invoke('fileSystem:deleteFile', { filePath });
    },
  },

  // Track management functions
  tracks: {
    /**
     * Get all tracks in the library
     */
    getAll() {
      return ipcRenderer.invoke('tracks:getAll', undefined);
    },

    /**
     * Get a specific track by ID
     * @param id - ID of the track to get
     */
    getById(id: string) {
      return ipcRenderer.invoke('tracks:getById', { id });
    },

    /**
     * Add a track to the library
     * @param track - Track to add
     */
    add(track: IPCRequests['tracks:add']) {
      return ipcRenderer.invoke('tracks:add', track);
    },

    /**
     * Update a track's metadata
     * @param track - Updated track object
     */
    update(track: IPCRequests['tracks:update']) {
      return ipcRenderer.invoke('tracks:update', track);
    },

    /**
     * Update a track's play count
     * @param id - ID of the track
     * @param date - ISO date string of when the track was played
     */
    updatePlayCount(id: string, date: string) {
      return ipcRenderer.invoke('tracks:updatePlayCount', { id, date });
    },

    /**
     * Update a track's metadata (DB + file tags)
     * @param id - ID of the track
     * @param metadata - New metadata values
     */
    updateMetadata(id: string, metadata: MetadataToWrite) {
      return ipcRenderer.invoke('tracks:updateMetadata', { id, metadata });
    },

    /**
     * Delete a track from the library
     * @param id - ID of the track to delete
     */
    delete(id: string) {
      return ipcRenderer.invoke('tracks:delete', { id });
    },
  },

  // Playlist management functions
  playlists: {
    /**
     * Get all playlists
     */
    getAll(): Promise<IPCResponses['playlists:getAll']> {
      return ipcRenderer.invoke('playlists:getAll', undefined);
    },

    /**
     * Get a specific playlist by ID
     * @param id - ID of the playlist to get
     */
    getById(id: string) {
      return ipcRenderer.invoke('playlists:getById', { id });
    },

    /**
     * Create a new playlist
     * @param playlist - Playlist object to create
     */
    create(playlist: IPCRequests['playlists:create']) {
      return ipcRenderer.invoke('playlists:create', playlist);
    },

    /**
     * Update a playlist
     * @param playlist - Updated playlist object
     */
    update(playlist: IPCRequests['playlists:update']) {
      return ipcRenderer.invoke('playlists:update', playlist);
    },

    /**
     * Delete a playlist
     * @param id - ID of the playlist to delete
     */
    delete(id: string) {
      return ipcRenderer.invoke('playlists:delete', { id });
    },

    /**
     * Get tracks for a smart playlist
     * @param ruleSet - Rule set for the smart playlist
     */
    getSmartTracks(
      ruleSet: IPCRequests['playlists:getSmartTracks']['ruleSet'],
    ) {
      return ipcRenderer.invoke('playlists:getSmartTracks', { ruleSet });
    },
  },

  // Settings management functions
  settings: {
    /**
     * Get the application settings
     */
    get() {
      return ipcRenderer.invoke('settings:get', undefined);
    },

    /**
     * Update the application settings
     * @param settings - Updated settings object
     */
    update(settings: IPCRequests['settings:update']['settings']) {
      return ipcRenderer.invoke('settings:update', { settings });
    },
  },

  // Dialog functions
  dialog: {
    /**
     * Show a directory selection dialog
     * @returns Promise that resolves to the selected directory
     */
    selectDirectory() {
      return ipcRenderer.invoke('dialog:select-directory');
    },

    /**
     * Show a file selection dialog for music files (supports both files and folders)
     * @returns Promise that resolves to the selected files
     */
    selectFiles() {
      return ipcRenderer.invoke('dialog:select-files');
    },
  },

  // App functions
  app: {
    /**
     * Restart the application
     */
    restart() {
      return ipcRenderer.invoke('app:restart');
    },

    /**
     * Open a URL in the default browser
     * @param link - URL to open
     */
    openInBrowser(link: string) {
      return ipcRenderer.invoke('app:open-in-browser', { link });
    },

    /**
     * Get the path to the log file (only available in production)
     * @returns Promise that resolves to an object with path and exists properties
     */
    getLogFilePath() {
      return ipcRenderer.invoke('app:getLogFilePath');
    },

    /**
     * Signal to the main process that the renderer has finished loading
     * settings. Used to defer the window's first paint until the theme is
     * applied (avoids a flash of the default theme).
     */
    signalSettingsLoaded() {
      ipcRenderer.send('app:settingsLoaded');
    },
  },

  // UI functions
  ui: {
    /**
     * Toggle the sidebar visibility
     */
    toggleSidebar() {
      return ipcRenderer.invoke('ui:toggleSidebar');
    },

    /**
     * Subscribe to "toggle sidebar" events from the menu / keyboard
     * shortcut. @returns Unsubscribe.
     */
    onToggleSidebar(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('ui:toggleSidebar', subscription);
      return () => {
        ipcRenderer.removeListener('ui:toggleSidebar', subscription);
      };
    },

    /**
     * Subscribe to "open settings" events from the menu / keyboard
     * shortcut. @returns Unsubscribe.
     */
    onOpenSettings(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('ui:openSettings', subscription);
      return () => {
        ipcRenderer.removeListener('ui:openSettings', subscription);
      };
    },
  },

  // Player command relay (main → renderer for menu/keyboard/miniPlayer
  // commands; renderer → main for state broadcast to the miniPlayer).
  player: {
    /**
     * Broadcast playback state to the main process so the miniPlayer can
     * stay in sync. Fire-and-forget.
     */
    sendStateUpdate(state: PlayerPlaybackState) {
      ipcRenderer.send('player:stateUpdate', state);
    },

    /**
     * Broadcast a track change. Fire-and-forget.
     */
    sendTrackUpdate(track: Track | null) {
      ipcRenderer.send('player:trackUpdate', track);
    },

    /**
     * Broadcast a position update (e.g. on seek or natural progression).
     * Fire-and-forget.
     */
    sendPositionUpdate(position: number) {
      ipcRenderer.send('player:positionUpdate', position);
    },

    /**
     * Subscribe to a play/pause command from menu, keyboard, or miniPlayer.
     */
    onPlayPause(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('player:playPause', subscription);
      return () => {
        ipcRenderer.removeListener('player:playPause', subscription);
      };
    },

    /** Subscribe to a "next track" command. */
    onNextTrack(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('player:nextTrack', subscription);
      return () => {
        ipcRenderer.removeListener('player:nextTrack', subscription);
      };
    },

    /** Subscribe to a "previous track" command. */
    onPreviousTrack(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('player:previousTrack', subscription);
      return () => {
        ipcRenderer.removeListener('player:previousTrack', subscription);
      };
    },

    /** Subscribe to a "seek to position" command. */
    onSeek(callback: (position: number) => void): () => void {
      const subscription = (_event: IpcRendererEvent, position: number) =>
        callback(position);
      ipcRenderer.on('player:seek', subscription);
      return () => {
        ipcRenderer.removeListener('player:seek', subscription);
      };
    },

    /** Subscribe to a "set volume" command. */
    onSetVolume(callback: (volume: number) => void): () => void {
      const subscription = (_event: IpcRendererEvent, volume: number) =>
        callback(volume);
      ipcRenderer.on('player:setVolume', subscription);
      return () => {
        ipcRenderer.removeListener('player:setVolume', subscription);
      };
    },

    /** Subscribe to a "toggle repeat" command. */
    onToggleRepeat(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('player:toggleRepeat', subscription);
      return () => {
        ipcRenderer.removeListener('player:toggleRepeat', subscription);
      };
    },

    /** Subscribe to a "toggle shuffle" command. */
    onToggleShuffle(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('player:toggleShuffle', subscription);
      return () => {
        ipcRenderer.removeListener('player:toggleShuffle', subscription);
      };
    },

    /** Subscribe to an explicit pause command. */
    onPausePlayback(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('player:pausePlayback', subscription);
      return () => {
        ipcRenderer.removeListener('player:pausePlayback', subscription);
      };
    },

    /** Subscribe to an explicit resume command. */
    onResumePlayback(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('player:resumePlayback', subscription);
      return () => {
        ipcRenderer.removeListener('player:resumePlayback', subscription);
      };
    },
  },

  // Menu / keyboard shortcuts for playback. Distinct from player.* (which
  // routes miniPlayer commands) because the menu builder uses a separate
  // channel namespace and includes volume up/down which player.* doesn't.
  playback: {
    onNext(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('playback:next', subscription);
      return () => ipcRenderer.removeListener('playback:next', subscription);
    },
    onPrevious(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('playback:previous', subscription);
      return () =>
        ipcRenderer.removeListener('playback:previous', subscription);
    },
    onVolumeUp(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('playback:volumeUp', subscription);
      return () =>
        ipcRenderer.removeListener('playback:volumeUp', subscription);
    },
    onVolumeDown(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('playback:volumeDown', subscription);
      return () =>
        ipcRenderer.removeListener('playback:volumeDown', subscription);
    },
    onToggleRepeat(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('playback:toggleRepeat', subscription);
      return () =>
        ipcRenderer.removeListener('playback:toggleRepeat', subscription);
    },
    onToggleShuffle(callback: () => void): () => void {
      const subscription = () => callback();
      ipcRenderer.on('playback:toggleShuffle', subscription);
      return () =>
        ipcRenderer.removeListener('playback:toggleShuffle', subscription);
    },
  },

  // MiniPlayer functions
  miniPlayer: {
    /**
     * Open the mini player window
     */
    open() {
      return ipcRenderer.invoke('miniPlayer:open', undefined);
    },

    /**
     * Close the mini player window
     */
    close() {
      return ipcRenderer.invoke('miniPlayer:close', undefined);
    },

    /**
     * Request the current state from the main process
     */
    requestState() {
      return ipcRenderer.invoke('miniPlayer:requestState', undefined);
    },

    /**
     * Toggle play/pause
     */
    playPause() {
      return ipcRenderer.invoke('miniPlayer:playPause', undefined);
    },

    /**
     * Play the next track
     */
    nextTrack() {
      return ipcRenderer.invoke('miniPlayer:nextTrack', undefined);
    },

    /**
     * Play the previous track
     */
    previousTrack() {
      return ipcRenderer.invoke('miniPlayer:previousTrack', undefined);
    },

    /**
     * Seek to a position in the current track
     * @param position - Position in microseconds
     */
    seek(position: number) {
      return ipcRenderer.invoke('miniPlayer:seek', position);
    },

    /**
     * Set the volume
     * @param volume - Volume level (0-1)
     */
    setVolume(volume: number) {
      return ipcRenderer.invoke('miniPlayer:setVolume', volume);
    },

    /**
     * Toggle repeat mode
     */
    toggleRepeat() {
      return ipcRenderer.invoke('miniPlayer:toggleRepeat', undefined);
    },

    /**
     * Toggle shuffle mode
     */
    toggleShuffle() {
      return ipcRenderer.invoke('miniPlayer:toggleShuffle', undefined);
    },

    /**
     * Register a listener for track changes
     * @param callback - Function to call when the track changes
     * @returns A function to remove the listener
     */
    onTrackChange(callback: (track: Track | null) => void) {
      const subscription = (_event: IpcRendererEvent, track: Track | null) =>
        callback(track);
      ipcRenderer.on('miniPlayer:trackChanged', subscription);
      return () => {
        ipcRenderer.removeListener('miniPlayer:trackChanged', subscription);
      };
    },

    /**
     * Register a listener for state changes
     * @param callback - Function to call when the state changes
     * @returns A function to remove the listener
     */
    onStateChange(callback: (state: PlayerPlaybackState) => void) {
      const subscription = (
        _event: IpcRendererEvent,
        state: PlayerPlaybackState,
      ) => callback(state);
      ipcRenderer.on('miniPlayer:stateChanged', subscription);
      return () => {
        ipcRenderer.removeListener('miniPlayer:stateChanged', subscription);
      };
    },

    /**
     * Register a listener for position changes
     * @param callback - Function to call when the position changes
     * @returns A function to remove the listener
     */
    onPositionChange(callback: (position: number) => void) {
      const subscription = (_event: IpcRendererEvent, position: number) =>
        callback(position);
      ipcRenderer.on('miniPlayer:positionChanged', subscription);
      return () => {
        ipcRenderer.removeListener('miniPlayer:positionChanged', subscription);
      };
    },

    /**
     * Register a listener for album art changes
     * @param callback - Function to call when the album art changes
     * @returns A function to remove the listener
     */
    onAlbumArtChange(callback: (artData: string | null) => void) {
      const subscription = (_event: IpcRendererEvent, artData: string | null) =>
        callback(artData);
      ipcRenderer.on('miniPlayer:albumArtChanged', subscription);
      return () => {
        ipcRenderer.removeListener('miniPlayer:albumArtChanged', subscription);
      };
    },
  },

  // Album Art functions
  albumArt: {
    /**
     * Get album art for a track
     * @param filePath - Path to the audio file
     * @returns Promise that resolves to the album art data as a base64 string, or null if no art is found
     */
    get(filePath: string) {
      return ipcRenderer.invoke('albumArt:get', filePath);
    },
  },

  // Window control functions
  window: {
    /**
     * Minimize the window
     */
    minimize() {
      return ipcRenderer.invoke('window:minimize', undefined);
    },

    /**
     * Maximize or restore the window
     */
    maximize() {
      return ipcRenderer.invoke('window:maximize', undefined);
    },

    /**
     * Close the window
     */
    close() {
      return ipcRenderer.invoke('window:close', undefined);
    },

    /**
     * Toggle fullscreen mode
     */
    toggleFullscreen() {
      return ipcRenderer.invoke('window:toggleFullscreen', undefined);
    },

    /**
     * Check if the window is maximized
     */
    isMaximized() {
      return ipcRenderer.invoke('window:isMaximized', undefined);
    },

    /**
     * Register a listener for window maximize/unmaximize events
     * @param callback - Function to call when the window is maximized or unmaximized
     * @returns A function to remove the listener
     */
    onMaximizedChange(callback: (isMaximized: boolean) => void) {
      const subscription = (_event: IpcRendererEvent, isMaximized: boolean) =>
        callback(isMaximized);
      ipcRenderer.on('window:maximized', subscription);
      return () => {
        ipcRenderer.removeListener('window:maximized', subscription);
      };
    },
  },
};

// Export the type for use in the renderer process
export type ElectronHandler = typeof electronHandler;

// Expose protected methods to the renderer process through contextBridge
contextBridge.exposeInMainWorld('electron', electronHandler);
