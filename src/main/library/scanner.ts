/**
 * Library Scanner
 *
 * This module provides functionality for scanning music files in a directory
 * and importing them into the database.
 */

import fs from 'fs';
import path from 'path';
import { BrowserWindow } from 'electron';
import * as mm from 'music-metadata';
import * as db from '../db';
import { Track } from '../../types/dbTypes';

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.aac'];

// Main window reference for sending progress events
let mainWindow: BrowserWindow | null = null;

/**
 * Set the main window reference for sending progress events
 * @param window - Main window reference
 */
export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Send a progress event to the renderer process
 * @param event - Event name
 * @param data - Event data
 */
function sendProgressEvent(event: string, data: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(event, data);
  }
}

/**
 * Check if a file is a supported music file
 * @param filePath - Path to the file
 * @returns True if the file is supported
 */
function isSupportedFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath - Path to the directory
 */
function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Copy a file to the library path, preserving the directory structure
 * @param sourcePath - Source file path
 * @param libraryPath - Target library path
 * @returns New file path in the library
 */
async function copyFileToLibrary(
  sourcePath: string,
  libraryPath: string,
): Promise<string> {
  try {
    // Ensure the library path exists
    ensureDirectoryExists(libraryPath);

    // Get file name and extension
    const fileName = path.basename(sourcePath);

    // Create a relative path structure based on artist/album
    let metadata;
    try {
      metadata = await mm.parseFile(sourcePath, {
        duration: true,
        skipCovers: true,
      });
    } catch (error) {
      console.error(`Error parsing metadata for ${sourcePath}:`, error);
      // If metadata parsing fails, use a fallback structure
      metadata = {
        common: { artist: 'Unknown Artist', album: 'Unknown Album' },
      };
    }

    const artist = metadata.common.artist || 'Unknown Artist';
    const album = metadata.common.album || 'Unknown Album';

    // Create sanitized folder names (remove characters that might cause issues in file paths)
    const sanitizedArtist = artist.replace(/[\\/:*?"<>|]/g, '_');
    const sanitizedAlbum = album.replace(/[\\/:*?"<>|]/g, '_');

    // Create the target directory structure
    const targetDir = path.join(libraryPath, sanitizedArtist, sanitizedAlbum);
    ensureDirectoryExists(targetDir);

    // Create the target file path
    const targetPath = path.join(targetDir, fileName);

    // Check if the source file is already in the library path
    if (sourcePath.startsWith(libraryPath)) {
      // If the file is already in the library path and at the exact target path,
      // we don't need to copy it
      if (sourcePath === targetPath) {
        console.log(
          `File is already at the correct location in library: ${targetPath}`,
        );
        return targetPath;
      }
    }

    // Check if the file already exists at the target location
    if (fs.existsSync(targetPath)) {
      // If the file exists and has the same size, assume it's the same file
      const sourceStats = fs.statSync(sourcePath);
      const targetStats = fs.statSync(targetPath);

      if (sourceStats.size === targetStats.size) {
        console.log(
          `File already exists at ${targetPath} with the same size, skipping copy`,
        );
        return targetPath;
      }

      // If sizes differ, create a unique filename by adding a timestamp
      const fileNameWithoutExt = path.basename(
        fileName,
        path.extname(fileName),
      );
      const fileExt = path.extname(fileName);
      const timestamp = Date.now();
      const newFileName = `${fileNameWithoutExt}_${timestamp}${fileExt}`;
      const newTargetPath = path.join(targetDir, newFileName);

      // Copy the file to the new target path
      fs.copyFileSync(sourcePath, newTargetPath);
      console.log(`Copied file to ${newTargetPath}`);
      return newTargetPath;
    }

    // Copy the file to the target path
    fs.copyFileSync(sourcePath, targetPath);
    console.log(`Copied file to ${targetPath}`);
    return targetPath;
  } catch (error) {
    console.error(`Error copying file ${sourcePath} to library:`, error);
    throw error;
  }
}

/**
 * Get all music files in a directory recursively
 * @param dirPath - Path to the directory
 * @returns Array of file paths
 */
function getMusicFiles(dirPath: string): string[] {
  const files: string[] = [];
  const dirsToScan: string[] = [dirPath];

  while (dirsToScan.length > 0) {
    const currentPath = dirsToScan.shift() as string;
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });

    entries.forEach((entry) => {
      const entryPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        dirsToScan.push(entryPath);
      } else if (entry.isFile() && isSupportedFile(entryPath)) {
        files.push(entryPath);
      }
    });
  }

  return files;
}

/**
 * Parse metadata from a music file
 * @param filePath - Path to the music file
 * @returns Track object with metadata
 */
async function parseFileMetadata(filePath: string): Promise<Omit<Track, 'id'>> {
  try {
    const metadata = await mm.parseFile(filePath, {
      duration: true,
      skipCovers: true,
    });
    const { common, format } = metadata;

    // Extract track number if available
    let trackNumber: number | null = null;
    if (common.track && common.track.no) {
      console.log(
        `Track number found for ${filePath}: ${common.track.no} (${typeof common.track.no})`,
      );
      trackNumber =
        typeof common.track.no === 'number'
          ? common.track.no
          : parseInt(common.track.no, 10);

      // If parsing failed or resulted in NaN, set to null
      if (Number.isNaN(trackNumber)) {
        trackNumber = null;
      }
      console.log(`Parsed track number: ${trackNumber}`);
    } else {
      console.log(`No track number found for ${filePath}`);
    }

    return {
      filePath,
      title: common.title || path.basename(filePath, path.extname(filePath)),
      artist: common.artist || 'Unknown Artist',
      album: common.album || 'Unknown Album',
      albumArtist: common.albumartist || common.artist || 'Unknown Artist',
      genre: common.genre?.[0] || 'Unknown Genre',
      duration: format.duration || 0,
      playCount: 0,
      dateAdded: new Date().toISOString(),
      lastPlayed: null,
      lyrics:
        common.lyrics && common.lyrics.length > 0
          ? String(common.lyrics[0])
          : null,
      trackNumber,
    };
  } catch (error) {
    console.error(`Error parsing metadata for ${filePath}:`, error);

    // Return basic metadata if parsing fails
    return {
      filePath,
      title: path.basename(filePath, path.extname(filePath)),
      artist: 'Unknown Artist',
      album: 'Unknown Album',
      albumArtist: 'Unknown Artist',
      genre: 'Unknown Genre',
      duration: 0,
      playCount: 0,
      dateAdded: new Date().toISOString(),
      lastPlayed: null,
      lyrics: null,
      trackNumber: null,
    };
  }
}

/**
 * Process a single file for the library
 * @param filePath - Path to the file
 * @param existingFilePaths - Set of existing file paths
 * @param totalFiles - Total number of files to process in the scan
 * @param currentProcessed - Number of files processed so far in the scan
 * @param libraryPath - Path to the library directory
 * @returns Object with processed and added status
 */
async function processFile(
  filePath: string,
  existingFilePaths: Set<string>,
  totalFiles: number,
  currentProcessed: number,
  libraryPath: string,
): Promise<{ processed: boolean; added: boolean }> {
  // Send progress event
  sendProgressEvent('library:scanProgress', {
    total: totalFiles,
    processed: currentProcessed,
    current: filePath,
  });

  // Skip if the file is already in the database
  if (existingFilePaths.has(filePath)) {
    return { processed: true, added: false };
  }

  try {
    // Always copy the file to the library path to ensure consistency
    // This ensures all files in the database are within the library path
    console.log(`Copying file ${filePath} to library path...`);
    const targetFilePath = await copyFileToLibrary(filePath, libraryPath);

    // Parse metadata using the original file path (more reliable for metadata extraction)
    let trackData = await parseFileMetadata(filePath);

    // Update the file path to the target path in the library
    trackData = {
      ...trackData,
      filePath: targetFilePath,
    };

    // Debug log
    console.log(
      'Track data before adding to database:',
      JSON.stringify({
        filePath: trackData.filePath,
        title: trackData.title,
        artist: trackData.artist,
        album: trackData.album,
        // Log other fields as needed
      }),
    );

    // Add track to database
    db.addTrack(trackData);

    return { processed: true, added: true };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return { processed: true, added: false };
  }
}

/**
 * Scan a directory for music files and import them into the database
 * @param dirPath - Path to the directory
 * @returns Object with the number of tracks added
 */
export async function scanLibrary(
  dirPath: string,
): Promise<{ tracksAdded: number }> {
  try {
    // Get all music files in the directory
    const files = getMusicFiles(dirPath);
    const totalFiles = files.length;

    // Get existing tracks to avoid duplicates
    const existingTracks = db.getAllTracks();
    const existingFilePaths = new Set(
      existingTracks.map((track) => track.filePath),
    );

    // Get the library path from settings
    const settings = db.getSettings();
    const { libraryPath } = settings;

    // If library path is not set, we can't proceed
    if (!libraryPath) {
      throw new Error('Library path is not set in settings');
    }

    // Ensure the library path exists
    ensureDirectoryExists(libraryPath);

    // Process files sequentially to avoid overwhelming the system
    let processedCount = 0;
    let tracksAdded = 0;

    // Process files one by one
    await files.reduce(async (previousPromise, filePath) => {
      await previousPromise;
      processedCount += 1;

      const result = await processFile(
        filePath,
        existingFilePaths,
        totalFiles,
        processedCount,
        libraryPath,
      );

      if (result.added) {
        tracksAdded += 1;
      }

      return Promise.resolve();
    }, Promise.resolve());

    // Send completion event
    sendProgressEvent('library:scanComplete', {
      tracksAdded,
    });

    // We no longer update the settings with the library path here
    // This was causing the bug where the library path would change when scanning

    return { tracksAdded };
  } catch (error) {
    console.error(`Error scanning library at ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Import specific music files into the database
 * @param filePaths - Array of file paths
 * @returns Object with the number of tracks added
 */
export async function importFiles(
  filePaths: string[],
): Promise<{ tracksAdded: number }> {
  try {
    const totalFiles = filePaths.length;

    // Get existing tracks to avoid duplicates
    const existingTracks = db.getAllTracks();
    const existingFilePaths = new Set(
      existingTracks.map((track) => track.filePath),
    );

    // Get the library path from settings
    const settings = db.getSettings();
    const { libraryPath } = settings;

    if (!libraryPath) {
      throw new Error('Library path is not set in settings');
    }

    // Ensure the library path exists
    ensureDirectoryExists(libraryPath);

    // Filter out unsupported files
    const supportedFiles = filePaths.filter((filePath) =>
      isSupportedFile(filePath),
    );

    // Process files sequentially
    let processedCount = 0;
    let tracksAdded = 0;

    // Process files one by one
    await supportedFiles.reduce(async (previousPromise, filePath) => {
      await previousPromise;
      processedCount += 1;

      const result = await processFile(
        filePath,
        existingFilePaths,
        totalFiles,
        processedCount,
        libraryPath,
      );

      if (result.added) {
        tracksAdded += 1;
      }

      return Promise.resolve();
    }, Promise.resolve());

    // Send completion event
    sendProgressEvent('library:scanComplete', {
      tracksAdded,
    });

    return { tracksAdded };
  } catch (error) {
    console.error(`Error importing files:`, error);
    throw error;
  }
}
