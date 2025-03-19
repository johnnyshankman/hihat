/**
 * IPC Handlers
 *
 * This module implements the IPC handlers for the main process.
 * It handles requests from the renderer process and returns responses.
 */

import { dialog, app, BrowserWindow } from 'electron';
import fs from 'fs';
import * as db from '../db';
import { IPCHandler } from '../../types/ipc';
import { scanLibrary, importFiles } from '../library/scanner';
import playbackHandlers from './playbackHandlers';

/**
 * UI-related IPC handlers
 */
export const uiHandlers = {
  'ui:toggleSidebar': (async () => {
    try {
      // Send an event to the renderer process to toggle the sidebar
      const mainWindow = BrowserWindow.getFocusedWindow();
      if (mainWindow) {
        mainWindow.webContents.send('ui:toggleSidebar');
      }
      return true;
    } catch (error) {
      console.error('Error toggling sidebar:', error);
      return false;
    }
  }) as IPCHandler<'ui:toggleSidebar'>,
};

/**
 * Track-related IPC handlers
 */
export const trackHandlers = {
  'tracks:getAll': (async () => {
    try {
      return db.getAllTracks();
    } catch (error) {
      console.error('Error getting all tracks:', error);
      return [];
    }
  }) as IPCHandler<'tracks:getAll'>,

  'tracks:getById': (async ({ id }) => {
    try {
      return db.getTrackById(id);
    } catch (error) {
      console.error(`Error getting track with ID ${id}:`, error);
      return null;
    }
  }) as IPCHandler<'tracks:getById'>,

  'tracks:add': (async (track) => {
    try {
      return db.addTrack(track);
    } catch (error: unknown) {
      console.error('Error adding track:', error);
      throw error;
    }
  }) as IPCHandler<'tracks:add'>,

  'tracks:update': (async (track) => {
    try {
      return db.updateTrack(track);
    } catch (error) {
      console.error(`Error updating track with ID ${track.id}:`, error);
      return false;
    }
  }) as IPCHandler<'tracks:update'>,

  'tracks:updatePlayCount': (async ({ id, date }) => {
    try {
      return db.updatePlayCount(id, date);
    } catch (error) {
      console.error(
        `Error updating play count for track with ID ${id}:`,
        error,
      );
      return false;
    }
  }) as IPCHandler<'tracks:updatePlayCount'>,

  'tracks:delete': (async ({ id }) => {
    try {
      return db.deleteTrack(id);
    } catch (error) {
      console.error(`Error deleting track with ID ${id}:`, error);
      return false;
    }
  }) as IPCHandler<'tracks:delete'>,
};

/**
 * Playlist-related IPC handlers
 */
export const playlistHandlers = {
  'playlists:getAll': (async () => {
    try {
      return db.getAllPlaylists();
    } catch (error) {
      console.error('Error getting all playlists:', error);
      return [];
    }
  }) as IPCHandler<'playlists:getAll'>,

  'playlists:getById': (async ({ id }) => {
    try {
      return db.getPlaylistById(id);
    } catch (error) {
      console.error(`Error getting playlist with ID ${id}:`, error);
      return null;
    }
  }) as IPCHandler<'playlists:getById'>,

  'playlists:create': (async (playlist) => {
    try {
      return db.createPlaylist(playlist);
    } catch (error: unknown) {
      console.error('Error creating playlist:', error);
      throw error;
    }
  }) as IPCHandler<'playlists:create'>,

  'playlists:update': (async (playlist) => {
    try {
      return db.updatePlaylist(playlist);
    } catch (error) {
      console.error(`Error updating playlist with ID ${playlist.id}:`, error);
      return false;
    }
  }) as IPCHandler<'playlists:update'>,

  'playlists:delete': (async ({ id }) => {
    try {
      return db.deletePlaylist(id);
    } catch (error) {
      console.error(`Error deleting playlist with ID ${id}:`, error);
      return false;
    }
  }) as IPCHandler<'playlists:delete'>,

  'playlists:getSmartTracks': (async ({ ruleSet }) => {
    try {
      if (!ruleSet) {
        return [];
      }
      return db.getSmartPlaylistTracks(ruleSet);
    } catch (error) {
      console.error(`Error getting tracks for smart playlist:`, error);
      return [];
    }
  }) as IPCHandler<'playlists:getSmartTracks'>,
};

/**
 * Settings-related IPC handlers
 */
export const settingsHandlers = {
  'settings:get': (async () => {
    try {
      return db.getSettings();
    } catch (error: unknown) {
      console.error('Error getting settings:', error);
      throw error;
    }
  }) as IPCHandler<'settings:get'>,

  'settings:update': (async ({ settings }) => {
    try {
      const result = db.updateSettings(settings);
      return result;
    } catch (error) {
      console.error('Error updating settings:', error);
      // Don't return true on error, let the client know there was a problem
      throw error;
    }
  }) as IPCHandler<'settings:update'>,
};

/**
 * Library-related IPC handlers
 */
export const libraryHandlers = {
  'library:scan': (async ({ libraryPath }) => {
    try {
      const result = await scanLibrary(libraryPath);
      return {
        success: true,
        message: `Successfully scanned library at ${libraryPath}`,
        tracksAdded: result.tracksAdded,
      };
    } catch (error: unknown) {
      console.error(`Error scanning library at ${libraryPath}:`, error);
      return {
        success: false,
        message: `Failed to scan library: ${(error as Error).message || 'Unknown error'}`,
        tracksAdded: 0,
      };
    }
  }) as IPCHandler<'library:scan'>,

  'library:import': (async ({ files }) => {
    try {
      const result = await importFiles(files);
      return {
        success: true,
        message: `Successfully imported ${result.tracksAdded} files`,
        tracksAdded: result.tracksAdded,
      };
    } catch (error: unknown) {
      console.error('Error importing files:', error);
      return {
        success: false,
        message: `Failed to import files: ${(error as Error).message || 'Unknown error'}`,
        tracksAdded: 0,
      };
    }
  }) as IPCHandler<'library:import'>,

  'library:backup': (async ({ backupPath }) => {
    try {
      await db.backupDatabase(backupPath);
      return { success: true };
    } catch (error: unknown) {
      console.error(`Error backing up database to ${backupPath}:`, error);
      return { error: (error as Error).message || 'Unknown error' };
    }
  }) as IPCHandler<'library:backup'>,

  'library:restore': (async ({ restorePath }) => {
    try {
      db.restoreDatabase(restorePath);
      return { success: true };
    } catch (error: unknown) {
      console.error(`Error restoring database from ${restorePath}:`, error);
      return { error: (error as Error).message || 'Unknown error' };
    }
  }) as IPCHandler<'library:restore'>,

  'library:resetDatabase': (async () => {
    try {
      const success = await db.resetDatabase();
      return {
        success,
        message: success
          ? 'Database reset successfully'
          : 'Failed to reset database',
      };
    } catch (error: unknown) {
      console.error('Error resetting database:', error);
      return {
        success: false,
        message: `Failed to reset database: ${(error as Error).message || 'Unknown error'}`,
      };
    }
  }) as IPCHandler<'library:resetDatabase'>,
};

/**
 * Dialog-related IPC handlers
 */
export const dialogHandlers = {
  'dialog:select-directory':
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (async (_args) => {
      try {
        const result = await dialog.showOpenDialog({
          properties: ['openDirectory'],
        });
        return result;
      } catch (error: unknown) {
        console.error('Error showing directory selection dialog:', error);
        return { error: (error as Error).message || 'Unknown error' };
      }
    }) as IPCHandler<'dialog:select-directory'>,

  'dialog:select-files': (async () => {
    try {
      const result = await dialog.showOpenDialog({
        properties: ['openFile', 'multiSelections'],
      });
      return result;
    } catch (error: unknown) {
      console.error('Error showing file selection dialog:', error);
      return { error: (error as Error).message || 'Unknown error' };
    }
  }) as IPCHandler<'dialog:select-files'>,
};

/**
 * App-related IPC handlers
 */
export const appHandlers = {
  'app:restart': (async () => {
    try {
      console.log('Restarting application...');
      // Schedule app restart after a short delay to allow the response to be sent
      setTimeout(() => {
        app.relaunch();
        app.exit(0);
      }, 500);
      return true;
    } catch (error: unknown) {
      console.error('Error restarting application:', error);
      return false;
    }
  }) as IPCHandler<'app:restart'>,
};

/**
 * File system related IPC handlers
 */
export const fileSystemHandlers = {
  'fileSystem:fileExists': (async ({ filePath }) => {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      console.error(`Error checking if file exists: ${filePath}`, error);
      return false;
    }
  }) as IPCHandler<'fileSystem:fileExists'>,
};

/**
 * All IPC handlers
 */
export const ipcHandlers = {
  ...trackHandlers,
  ...playlistHandlers,
  ...settingsHandlers,
  ...libraryHandlers,
  ...dialogHandlers,
  ...appHandlers,
  ...uiHandlers,
  ...playbackHandlers,
  ...fileSystemHandlers,
};
