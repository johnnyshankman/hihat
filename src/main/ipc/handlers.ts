/**
 * IPC Handlers
 *
 * Request/response (invoke-shaped) IPC handlers for the main process.
 * Each entry registers via `ipcMain.handle` and is typed as
 * `IPCHandler<C>` so the renderer's `window.electron.<domain>.<method>(...)`
 * call resolves to a single typed response (or rejects with an Error).
 *
 * Streaming / fire-and-forget event handlers (e.g. rsync progress
 * during library backup) live in a sibling file because they use
 * `ipcMain.on` + `event.reply()` and don't fit the typed invoke shape.
 * See `backupHandlers.ts`.
 */

import {
  dialog,
  app,
  BrowserWindow,
  shell,
  IpcMainInvokeEvent,
} from 'electron';
import fs from 'fs';
import path from 'path';
import * as mm from 'music-metadata';
import log from 'electron-log';
import * as db from '../db';
import { IPCHandler } from '../../types/ipc';
import { scanLibrary, importFiles } from '../library/scanner';
import { writeMetadataToFile } from '../library/tagWriter';
import { assertHttpUrl, assertTrustedSender } from './validateSender';

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
      db.updateTrack(track);
      return track;
    } catch (error) {
      console.error(`Error updating track with ID ${track.id}:`, error);
      throw error;
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
      throw error;
    }
  }) as IPCHandler<'tracks:updatePlayCount'>,

  'tracks:delete': (async ({ id }) => {
    try {
      return db.deleteTrack(id);
    } catch (error) {
      console.error(`Error deleting track with ID ${id}:`, error);
      throw error;
    }
  }) as IPCHandler<'tracks:delete'>,

  'tracks:updateMetadata': (async ({ id, metadata }) => {
    try {
      const existingTrack = db.getTrackById(id);
      if (!existingTrack) {
        return {
          success: false,
          fileWriteSuccess: false,
          message: 'Track not found',
        };
      }

      const updatedTrack = {
        ...existingTrack,
        title: metadata.title,
        artist: metadata.artist,
        album: metadata.album,
        albumArtist: metadata.albumArtist,
        genre: metadata.genre,
        trackNumber: metadata.trackNumber,
        totalTracks: metadata.totalTracks,
        discNumber: metadata.discNumber,
        totalDiscs: metadata.totalDiscs,
        year: metadata.year,
        bpm: metadata.bpm,
        composer: metadata.composer,
        comment: metadata.comment,
      };

      const dbResult = db.updateTrack(updatedTrack);

      if (!dbResult) {
        return {
          success: false,
          fileWriteSuccess: false,
          message: 'Failed to update database',
        };
      }

      const fileResult = await writeMetadataToFile(
        existingTrack.filePath,
        metadata,
      );

      return {
        success: true,
        fileWriteSuccess: fileResult.success,
        message: fileResult.success
          ? undefined
          : `Database updated but file tags could not be written: ${fileResult.message}`,
      };
    } catch (error) {
      console.error(`Error updating metadata for track ${id}:`, error);
      return {
        success: false,
        fileWriteSuccess: false,
        message: (error as Error).message || 'Unknown error',
      };
    }
  }) as IPCHandler<'tracks:updateMetadata'>,
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
      db.updatePlaylist(playlist);
    } catch (error) {
      console.error(`Error updating playlist with ID ${playlist.id}:`, error);
      throw error;
    }
  }) as IPCHandler<'playlists:update'>,

  'playlists:delete': (async ({ id }) => {
    try {
      db.deletePlaylist(id);
    } catch (error) {
      console.error(`Error deleting playlist with ID ${id}:`, error);
      throw error;
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
      // Partial-merge: read current row, layer the patch on top, persist.
      // Renderer call sites send only the fields they're changing, so two
      // concurrent partial writes can no longer overwrite each other's
      // untouched fields.
      const current = db.getSettings();
      const merged = { ...current, ...settings };
      return db.updateSettings(merged);
    } catch (error) {
      console.error('Error updating settings:', error);
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
        tracksRemoved: result.tracksRemoved,
      };
    } catch (error: unknown) {
      console.error(`Error scanning library at ${libraryPath}:`, error);
      return {
        success: false,
        message: `Failed to scan library: ${(error as Error).message || 'Unknown error'}`,
        tracksAdded: 0,
        tracksRemoved: 0,
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
    } catch (error: unknown) {
      console.error(`Error backing up database to ${backupPath}:`, error);
      throw error;
    }
  }) as IPCHandler<'library:backup'>,

  'library:restore': (async ({ restorePath }) => {
    try {
      db.restoreDatabase(restorePath);
    } catch (error: unknown) {
      console.error(`Error restoring database from ${restorePath}:`, error);
      throw error;
    }
  }) as IPCHandler<'library:restore'>,

  'library:resetDatabase': (async (_req: void, event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
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

  'library:resetTracks': (async (_req: void, event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    try {
      const success = await db.resetTracks();
      return {
        success,
        message: success
          ? 'Tracks reset successfully'
          : 'Failed to reset tracks',
      };
    } catch (error: unknown) {
      console.error('Error resetting tracks:', error);
      return {
        success: false,
        message: `Failed to reset tracks: ${(error as Error).message || 'Unknown error'}`,
      };
    }
  }) as IPCHandler<'library:resetTracks'>,
};

/**
 * Dialog-related IPC handlers
 */
export const dialogHandlers = {
  'dialog:select-directory': (async (_args) => {
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
        properties: ['openFile', 'openDirectory', 'multiSelections'],
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
      console.error('Restarting application...');
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

  'app:open-in-browser': (async ({ link }, event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    try {
      // Reject non-http(s) URLs before handing them to shell.openExternal.
      // Without this, a buggy or compromised renderer could pass file://,
      // javascript:, or a custom-protocol URI and trigger arbitrary
      // local-side behavior.
      assertHttpUrl(link);
      await shell.openExternal(link);
      return { success: true };
    } catch (error: unknown) {
      return {
        success: false,
        message: (error as Error).message || 'Unknown error',
      };
    }
  }) as IPCHandler<'app:open-in-browser'>,

  'app:getLogFilePath': (async () => {
    try {
      // Only provide log file path in production mode
      if (process.env.NODE_ENV !== 'production') {
        return { path: null, exists: false };
      }

      // Get the log file path
      const logFilePath = log.transports.file.getFile().path;

      // Check if the log file exists
      const exists = fs.existsSync(logFilePath);

      return {
        path: logFilePath,
        exists,
      };
    } catch (error) {
      console.error('Error getting log file path:', error);
      return { path: null, exists: false };
    }
  }) as IPCHandler<'app:getLogFilePath'>,
};

/**
 * File system related IPC handlers
 */
export const fileSystemHandlers = {
  'fileSystem:fileExists': (async ({ filePath }) => {
    try {
      return fs.existsSync(filePath);
    } catch (error) {
      console.error(`Error checking if file ${filePath} exists:`, error);
      return false;
    }
  }) as IPCHandler<'fileSystem:fileExists'>,

  'fileSystem:showInFinder': (async ({ filePath }) => {
    try {
      const result = shell.showItemInFolder(filePath);
      return {
        success: result,
        message: 'File opened in finder/explorer',
      };
    } catch (error) {
      console.error(
        `Error showing file ${filePath} in finder/explorer:`,
        error,
      );
      return {
        success: false,
        message: `Error: ${(error as Error).message || 'Unknown error'}`,
      };
    }
  }) as IPCHandler<'fileSystem:showInFinder'>,

  'fileSystem:downloadAlbumArt': (async ({ track }) => {
    try {
      if (!track || !track.filePath || !fs.existsSync(track.filePath)) {
        return {
          success: false,
          message: 'Track or file path does not exist',
        };
      }

      // Get the metadata from the file
      const metadata = await mm.parseFile(track.filePath, {
        skipCovers: false, // Explicitly load album art
      });

      // Check if there's any picture data
      if (!metadata.common.picture || metadata.common.picture.length === 0) {
        return {
          success: false,
          message: 'No album art found in the file',
        };
      }

      // Get the first picture
      const picture = metadata.common.picture[0];

      // Determine the file extension based on format
      let extension = 'jpg'; // Default extension
      if (picture.format) {
        const format = picture.format.toLowerCase();
        if (format.includes('png')) extension = 'png';
        else if (format.includes('gif')) extension = 'gif';
        else if (format.includes('jpeg') || format.includes('jpg'))
          extension = 'jpg';
      }

      // Create a sanitized filename from track info
      const artist = track.albumArtist || track.artist || 'Unknown';
      const album = track.album || 'Unknown';
      const sanitizedArtist = artist.replace(/[\\/:*?"<>|]/g, '_');
      const sanitizedAlbum = album.replace(/[\\/:*?"<>|]/g, '_');
      const fileName = `${sanitizedArtist} - ${sanitizedAlbum}.${extension}`;

      // Get the downloads directory
      const downloadsDir = app.getPath('downloads');
      const outputPath = path.join(downloadsDir, fileName);

      // Write the image data to a file
      fs.writeFileSync(outputPath, picture.data);

      // Show the file in the finder/explorer
      shell.showItemInFolder(outputPath);

      return {
        success: true,
        message: `Album art saved to ${outputPath}`,
        filePath: outputPath,
      };
    } catch (error) {
      console.error(`Error downloading album art:`, error);
      return {
        success: false,
        message: (error as Error).message || 'Unknown error',
      };
    }
  }) as IPCHandler<'fileSystem:downloadAlbumArt'>,

  'fileSystem:deleteFile': (async ({ filePath }, event: IpcMainInvokeEvent) => {
    assertTrustedSender(event);
    try {
      if (!fs.existsSync(filePath)) {
        return {
          success: false,
          message: 'File does not exist',
        };
      }

      // Move file to Trash instead of permanently deleting it
      await shell.trashItem(filePath);

      return {
        success: true,
        message: 'File moved to Trash successfully',
      };
    } catch (error) {
      console.error(`Error moving file to Trash ${filePath}:`, error);
      return {
        success: false,
        message: `Error: ${(error as Error).message || 'Unknown error'}`,
      };
    }
  }) as IPCHandler<'fileSystem:deleteFile'>,
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
  ...fileSystemHandlers,
};
