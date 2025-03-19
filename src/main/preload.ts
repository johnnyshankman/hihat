/**
 * Preload Script
 *
 * This script runs in the renderer process before the web page is loaded.
 * It exposes a safe subset of Node.js and Electron APIs to the renderer process
 * through the contextBridge.
 */

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import { Channels, IPCRequests, IPCResponses } from '../types/ipc';

/**
 * Exposes IPC functions to the renderer process
 */
const electronHandler = {
  // Generic IPC functions
  ipcRenderer: {
    /**
     * Send a message to the main process via IPC
     * @param channel - The IPC channel to send the message on
     * @param args - Arguments to pass to the main process
     */
    sendMessage<C extends Channels>(channel: C, ...args: unknown[]) {
      ipcRenderer.send(channel, ...args);
    },

    /**
     * Register a listener for messages from the main process
     * @param channel - The IPC channel to listen on
     * @param func - Callback function to handle the message
     * @returns A function to remove the listener
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
     * Register a one-time listener for messages from the main process
     * @param channel - The IPC channel to listen on
     * @param func - Callback function to handle the message
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
  },

  // File system operations
  fileSystem: {
    /**
     * Check if a file exists
     * @param filePath - Path to the file
     * @returns Promise that resolves to true if the file exists
     */
    fileExists(filePath: string) {
      return ipcRenderer.invoke('fileSystem:fileExists', { filePath });
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
     * Show a file selection dialog for music files
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
  },

  // UI functions
  ui: {
    /**
     * Toggle the sidebar visibility
     */
    toggleSidebar() {
      return ipcRenderer.invoke('ui:toggleSidebar');
    },
  },

  // Playback functions
  playback: {
    /**
     * Play a track
     * @param trackId - ID of the track to play
     */
    play(trackId?: string) {
      return ipcRenderer.invoke('playback:play', { trackId });
    },

    /**
     * Pause playback
     */
    pause() {
      return ipcRenderer.invoke('playback:pause', undefined);
    },

    /**
     * Resume playback
     */
    resume() {
      return ipcRenderer.invoke('playback:resume', undefined);
    },

    /**
     * Stop playback
     */
    stop() {
      return ipcRenderer.invoke('playback:stop', undefined);
    },

    /**
     * Play the next track
     */
    next() {
      return ipcRenderer.invoke('playback:next', undefined);
    },

    /**
     * Play the previous track
     */
    previous() {
      return ipcRenderer.invoke('playback:previous', undefined);
    },

    /**
     * Seek to a position in the current track
     * @param position - Position in microseconds
     */
    seek(position: number) {
      return ipcRenderer.invoke('playback:seek', { position });
    },

    /**
     * Set the volume
     * @param volume - Volume level (0-1)
     */
    setVolume(volume: number) {
      return ipcRenderer.invoke('playback:setVolume', { volume });
    },

    /**
     * Get the current playback status
     */
    getStatus() {
      return ipcRenderer.invoke('playback:getStatus', undefined);
    },

    /**
     * Toggle repeat mode
     */
    toggleRepeat() {
      return ipcRenderer.invoke('player:toggleRepeat', undefined);
    },

    /**
     * Toggle shuffle mode
     */
    toggleShuffle() {
      return ipcRenderer.invoke('player:toggleShuffle', undefined);
    },

    /**
     * Set the current queue of tracks
     * @param trackIds - Array of track IDs to set as the queue
     * @param startIndex - Index to start playback from
     */
    setQueue(trackIds: string[], startIndex = 0) {
      return ipcRenderer.invoke('playback:setQueue', { trackIds, startIndex });
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
    onTrackChange(callback: (track: any) => void) {
      const subscription = (_event: IpcRendererEvent, track: any) =>
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
    onStateChange(callback: (state: any) => void) {
      const subscription = (_event: IpcRendererEvent, state: any) =>
        callback(state);
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
