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
import { cpus } from 'os';
import { promisify } from 'util';
import * as db from '../db';
import { Track } from '../../types/dbTypes';

function debugLog(message: string, data?: any): void {
  const timestamp = new Date().toISOString();
  const formattedMessage = `[DEBUG ${timestamp}] ${message}`;

  if (data) {
    // eslint-disable-next-line no-console
    console.log(formattedMessage, data);
  } else {
    // eslint-disable-next-line no-console
    console.log(formattedMessage);
  }
}

// Use promisified versions of filesystem functions for better async handling
const copyFile = promisify(fs.copyFile);
const exists = promisify(fs.exists);
const stat = promisify(fs.stat);
const mkdir = promisify(fs.mkdir);
const unlink = promisify(fs.unlink);

// Supported file extensions
const SUPPORTED_EXTENSIONS = ['.mp3', '.m4a', '.flac', '.wav', '.ogg', '.aac'];

// Number of parallel processes to use (75% of available CPUs)
const PARALLEL_PROCESSES = Math.max(1, Math.floor(cpus().length * 0.75));

// Batch size for database operations
const DB_BATCH_SIZE = 100;

// Cache for directory existence checks to avoid repeated fs.existsSync calls
const directoryExistsCache = new Map<string, boolean>();

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
 * @param channel - Channel to send the event on
 * @param data - Data to send
 */
function sendProgressEvent(channel: string, data: any): void {
  if (mainWindow) {
    mainWindow.webContents.send(channel, data);
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
 * Uses a cache to avoid repeated filesystem checks
 * @param dirPath - Path to the directory
 */
async function ensureDirectoryExists(dirPath: string): Promise<void> {
  // Check cache first
  if (directoryExistsCache.has(dirPath)) {
    if (directoryExistsCache.get(dirPath)) {
      return;
    }
  }

  // Check if directory exists
  const dirExists = await exists(dirPath);
  if (!dirExists) {
    await mkdir(dirPath, { recursive: true });
  }

  // Update cache
  directoryExistsCache.set(dirPath, true);
}

/**
 * Calculate audio quality score based on format, bitrate, and sample rate
 * Higher score indicates better quality
 * @param format - Music metadata format info
 * @param extension - File extension
 * @returns Quality score (higher is better)
 */
function calculateAudioQuality(format: mm.IFormat, extension: string): number {
  // Base score based on file format (lossless formats get higher scores)
  let score = 0;

  const losslessFormats = ['.flac', '.wav', '.alac'];
  const highQualityLossyFormats = ['.m4a', '.aac', '.ogg', '.opus'];
  const standardLossyFormats = ['.mp3'];

  if (losslessFormats.includes(extension)) {
    score += 1000; // Lossless formats are preferred
  } else if (highQualityLossyFormats.includes(extension)) {
    score += 500;
  } else if (standardLossyFormats.includes(extension)) {
    score += 250;
  }

  // Add points for bitrate (if available)
  if (format.bitrate) {
    // Normalize to kbps
    const kbps = format.bitrate / 1000;

    // Higher bitrate means better quality
    if (kbps >= 320) {
      score += 300;
    } else if (kbps >= 256) {
      score += 250;
    } else if (kbps >= 192) {
      score += 200;
    } else if (kbps >= 128) {
      score += 150;
    } else {
      score += 100;
    }
  }

  // Add points for sample rate (if available)
  if (format.sampleRate) {
    if (format.sampleRate >= 96000) {
      score += 300;
    } else if (format.sampleRate >= 48000) {
      score += 200;
    } else if (format.sampleRate >= 44100) {
      score += 150;
    } else {
      score += 100;
    }
  }

  // Add points for bit depth (if available)
  if (format.bitsPerSample) {
    if (format.bitsPerSample >= 24) {
      score += 300;
    } else if (format.bitsPerSample >= 16) {
      score += 200;
    } else {
      score += 100;
    }
  }

  // Add points for number of channels
  if (format.numberOfChannels) {
    if (format.numberOfChannels > 2) {
      score += 200; // Surround
    } else if (format.numberOfChannels === 2) {
      score += 150; // Stereo
    } else {
      score += 100; // Mono
    }
  }

  return score;
}

/**
 * Generate a composite key for track deduplication
 * @param track - Track or partial track with metadata fields
 * @returns Lowercase composite key string
 */
function getTrackKey(
  track: Pick<Track, 'title' | 'artist' | 'albumArtist' | 'album'>,
): string {
  return `${track.title.toLowerCase()}|${track.artist.toLowerCase()}|${track.albumArtist.toLowerCase()}|${track.album.toLowerCase()}`;
}

/**
 * Find duplicate tracks based on metadata
 * This is optimized to use a Map for O(1) lookups instead of O(n) search
 * @param trackData - New track metadata
 * @param trackMap - Map of existing tracks for efficient lookup
 * @returns Duplicate track if found, null otherwise
 */
function findDuplicateTrack(
  trackData: Omit<Track, 'id'>,
  trackMap: Map<string, Track>,
): Track | null {
  try {
    // Direct lookup in the map
    return trackMap.get(getTrackKey(trackData)) || null;
  } catch (error) {
    console.error('Error finding duplicate track:', error);
    return null;
  }
}

/**
 * Copy a file to the library path, preserving the directory structure
 * Optimized with caching and async file operations
 * @param sourcePath - Source file path
 * @param libraryPath - Target library path
 * @param metadata - Already parsed metadata to avoid re-parsing
 * @param folderRoot - Optional root folder path to preserve relative structure
 * @param isImport - Whether this is an import operation (true) or scan operation (false)
 * @returns New file path in the library
 */
async function copyFileToLibrary(
  sourcePath: string,
  libraryPath: string,
  metadata: mm.IAudioMetadata,
  folderRoot?: string,
  isImport: boolean = false,
): Promise<string> {
  try {
    // CRITICAL FIX: If this is a scan operation (not import) and the file
    // is already within the library path, don't copy or move it - just return
    // the original path to avoid creating duplicates
    if (!isImport && sourcePath.startsWith(libraryPath)) {
      debugLog(
        `Scan operation: File already in library, using original path: ${sourcePath}`,
      );
      return sourcePath;
    }

    await ensureDirectoryExists(libraryPath);

    // Get file name and extension
    const fileName = path.basename(sourcePath);

    // If folderRoot is provided, preserve the relative path structure
    if (folderRoot && sourcePath.startsWith(folderRoot)) {
      // Get the relative path from the parent of the folder root
      // This includes the folder root name itself in the structure
      const folderRootName = path.basename(folderRoot);
      const relativePath = path.relative(folderRoot, path.dirname(sourcePath));

      // Create the target directory preserving the relative structure
      // Include the folder root name to maintain the complete structure
      const targetDir = path.join(libraryPath, folderRootName, relativePath);
      await ensureDirectoryExists(targetDir);

      // Create the target file path
      const targetPath = path.join(targetDir, fileName);

      // Check if the source file is already in the library path
      if (sourcePath.startsWith(libraryPath)) {
        // If the file is already in the library path and at the exact target path,
        // we don't need to copy it
        if (sourcePath === targetPath) {
          return targetPath;
        }
      }

      // Check if the file already exists at the target location
      const targetExists = await exists(targetPath);
      if (targetExists) {
        // If the file exists and has the same size, assume it's the same file
        const [sourceStats, targetStats] = await Promise.all([
          stat(sourcePath),
          stat(targetPath),
        ]);

        if (sourceStats.size === targetStats.size) {
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

        await copyFile(sourcePath, newTargetPath);
        return newTargetPath;
      }

      await copyFile(sourcePath, targetPath);
      return targetPath;
    }

    // Default behavior: use metadata to create artist/album folder structure
    const { common } = metadata;
    const artist = common.artist || 'Unknown Artist';
    const album = common.album || 'Unknown Album';

    // Create sanitized folder names
    const sanitizedArtist = artist.replace(/[\\/:*?"<>|]/g, '_');
    const sanitizedAlbum = album.replace(/[\\/:*?"<>|]/g, '_');
    // Create the target directory structure
    const targetDir = path.join(libraryPath, sanitizedArtist, sanitizedAlbum);

    await ensureDirectoryExists(targetDir);

    // Create the target file path
    const targetPath = path.join(targetDir, fileName);

    // Check if the source file is already in the library path
    if (sourcePath.startsWith(libraryPath)) {
      // If the file is already in the library path and at the exact target path,
      // we don't need to copy it
      if (sourcePath === targetPath) {
        return targetPath;
      }
    }

    // Check if the file already exists at the target location
    const targetExists = await exists(targetPath);
    if (targetExists) {
      // If the file exists and has the same size, assume it's the same file
      const [sourceStats, targetStats] = await Promise.all([
        stat(sourcePath),
        stat(targetPath),
      ]);

      if (sourceStats.size === targetStats.size) {
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

      await copyFile(sourcePath, newTargetPath);
      return newTargetPath;
    }

    await copyFile(sourcePath, targetPath);
    return targetPath;
  } catch (error) {
    console.error(`Error copying file ${sourcePath} to library:`, error);

    throw error;
  }
}

/**
 * Get all music files in a directory recursively
 * Optimized for performance with iterative approach
 * @param dirPath - Path to the directory
 * @returns Array of file paths
 */
function getMusicFiles(dirPath: string): string[] {
  const files: string[] = [];
  const dirsToScan: string[] = [dirPath];

  debugLog(`Starting to scan directory: ${dirPath}`);

  while (dirsToScan.length > 0) {
    const currentPath = dirsToScan.shift() as string;

    try {
      const entries = fs.readdirSync(currentPath, { withFileTypes: true });

      entries.forEach((entry) => {
        const entryPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          dirsToScan.push(entryPath);
        } else if (entry.isFile() && isSupportedFile(entryPath)) {
          files.push(entryPath);
        }
      });
    } catch (error) {
      debugLog(`Error reading directory ${currentPath}:`, error);
    }
  }

  // Log summary of files found
  debugLog(`Total music files found: ${files.length}`);

  return files;
}

/**
 * Parse metadata from a music file
 * Simplified for performance
 * @param filePath - Path to the music file
 * @param metadata - Already parsed metadata to avoid re-parsing
 * @returns Track object with metadata
 */
function parseFileMetadata(
  filePath: string,
  metadata: mm.IAudioMetadata,
): Omit<Track, 'id'> {
  try {
    const { common, format } = metadata;

    // Extract track number if available
    let trackNumber: number | null = null;
    if (common.track && common.track.no) {
      trackNumber =
        typeof common.track.no === 'number'
          ? common.track.no
          : parseInt(common.track.no, 10);

      // If parsing failed or resulted in NaN, set to null
      if (Number.isNaN(trackNumber)) {
        trackNumber = null;
      }
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
 * @param trackMap - Map of existing tracks for efficient lookup
 * @param libraryPath - Path to the library directory
 * @param folderRoot - Optional root folder path to preserve relative structure
 * @param isImport - Whether this is an import operation (true) or scan operation (false)
 * @returns Track data if added, null if skipped
 */
async function processFile(
  filePath: string,
  existingFilePaths: Set<string>,
  trackMap: Map<string, Track>,
  libraryPath: string,
  folderRoot?: string,
  isImport: boolean = false,
): Promise<(Omit<Track, 'id'> & { qualityScore?: number }) | null> {
  // Skip if the file is already in the database
  if (existingFilePaths.has(filePath)) {
    return null;
  }

  try {
    // Parse metadata only once and reuse
    const metadata = await mm.parseFile(filePath, {
      duration: true,
      skipCovers: true,
    });

    // Create track data
    let trackData = parseFileMetadata(filePath, metadata);

    // Check for duplicate track
    const duplicate = findDuplicateTrack(trackData, trackMap);

    if (duplicate) {
      // Compare quality of the files to determine which one to keep
      const newFileExt = path.extname(filePath).toLowerCase();
      const existingFileExt = path.extname(duplicate.filePath).toLowerCase();

      // Get metadata for the existing file
      let existingMetadata;
      try {
        const existingFileExists = await exists(duplicate.filePath);
        if (!existingFileExists) {
          // If the existing file doesn't exist, prefer the new one
          existingMetadata = { format: {} } as mm.IAudioMetadata;
        } else {
          existingMetadata = await mm.parseFile(duplicate.filePath);
        }
      } catch (error) {
        // If we can't read the existing file, prefer the new one
        existingMetadata = { format: {} } as mm.IAudioMetadata;
      }

      // Calculate quality scores
      const newQuality = calculateAudioQuality(metadata.format, newFileExt);
      const existingQuality = calculateAudioQuality(
        existingMetadata.format,
        existingFileExt,
      );

      // If the existing file has equal or higher quality, skip the new one
      if (existingQuality >= newQuality) {
        return null;
      }

      // If the new file has higher quality, mark the existing one for deletion

      return {
        ...trackData,
        replaceId: duplicate.id,
        oldPath: duplicate.filePath,
        qualityScore: newQuality,
      } as Omit<Track, 'id'> & {
        replaceId: string;
        oldPath: string;
        qualityScore: number;
      };
    }

    // Copy the file to the library path (only if importing, not scanning)
    const targetFilePath = await copyFileToLibrary(
      filePath,
      libraryPath,
      metadata,
      folderRoot,
      isImport,
    );

    // Update the file path to the target path in the library
    const ext = path.extname(targetFilePath).toLowerCase();
    trackData = {
      ...trackData,
      filePath: targetFilePath,
    };

    return {
      ...trackData,
      qualityScore: calculateAudioQuality(metadata.format, ext),
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);

    return null;
  }
}

/**
 * Process a batch of files in parallel
 * @param fileBatch - Array of file paths to process
 * @param existingFilePaths - Set of existing file paths
 * @param trackMap - Map of existing tracks for efficient lookup
 * @param libraryPath - Path to the library directory
 * @param folderRoot - Optional root folder path to preserve relative structure
 * @param isImport - Whether this is an import operation (true) or scan operation (false)
 * @returns Array of processed track data
 */
async function processBatch(
  fileBatch: string[],
  existingFilePaths: Set<string>,
  trackMap: Map<string, Track>,
  libraryPath: string,
  folderRoot?: string,
  isImport: boolean = false,
): Promise<
  (Omit<Track, 'id'> & {
    replaceId?: string;
    oldPath?: string;
    qualityScore?: number;
  })[]
> {
  // Process files in parallel
  const results = await Promise.all(
    fileBatch.map((filePath) =>
      processFile(
        filePath,
        existingFilePaths,
        trackMap,
        libraryPath,
        folderRoot,
        isImport,
      ),
    ),
  );

  // Filter out null results (skipped files)
  return results.filter((result) => result !== null) as (Omit<Track, 'id'> & {
    replaceId?: string;
    oldPath?: string;
    qualityScore?: number;
  })[];
}

/**
 * Deduplicate tracks within a single batch result.
 * Groups by metadata key and keeps the highest quality version.
 * Strips qualityScore from all results before returning.
 * @param tracks - Batch results that may contain intra-batch duplicates
 * @returns Deduplicated tracks without qualityScore
 */
function deduplicateBatchResults(
  tracks: (Omit<Track, 'id'> & {
    replaceId?: string;
    oldPath?: string;
    qualityScore?: number;
  })[],
): (Omit<Track, 'id'> & { replaceId?: string; oldPath?: string })[] {
  const groups = new Map<
    string,
    Omit<Track, 'id'> & {
      replaceId?: string;
      oldPath?: string;
      qualityScore?: number;
    }
  >();

  tracks.forEach((track) => {
    const key = getTrackKey(
      track as Pick<Track, 'title' | 'artist' | 'albumArtist' | 'album'>,
    );
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, track);
    } else {
      // Keep the one with the higher quality score
      const existingScore = existing.qualityScore ?? 0;
      const newScore = track.qualityScore ?? 0;
      if (newScore > existingScore) {
        groups.set(key, track);
      }
    }
  });

  // Strip qualityScore from results
  return Array.from(groups.values()).map((track) => {
    const result = { ...track };
    delete (result as any).qualityScore;
    return result;
  });
}

/**
 * Create a Map of existing tracks for efficient duplicate lookup
 * @param existingTracks - Array of existing tracks
 * @returns Map of tracks with composite keys
 */
function createTrackMap(existingTracks: Track[]): Map<string, Track> {
  const trackMap = new Map<string, Track>();

  existingTracks.forEach((track) => {
    trackMap.set(getTrackKey(track), track);
  });

  // Log summary of existing tracks
  debugLog(`Total existing tracks: ${existingTracks.length}`);

  return trackMap;
}

/**
 * Scan a directory for music files and import them into the database
 * Optimized with parallel processing and batch operations
 * @param dirPath - Path to the directory
 * @returns Object with the number of tracks added
 */
export async function scanLibrary(
  dirPath: string,
): Promise<{ tracksAdded: number }> {
  debugLog(`Beginning library scan of directory: ${dirPath}`);

  try {
    // Get all music files in the directory
    const files = getMusicFiles(dirPath);
    const totalFiles = files.length;

    debugLog(`Found ${totalFiles} total music files to process`);

    // Get existing tracks to avoid duplicates
    const existingTracks = db.getAllTracks();
    const existingFilePaths = new Set(
      existingTracks.map((track) => track.filePath),
    );

    debugLog(
      `Retrieved ${existingTracks.length} existing tracks from database`,
    );

    // Create an efficient lookup map for duplicate detection
    const trackMap = createTrackMap(existingTracks);

    // Get the library path from settings
    const settings = db.getSettings();
    const { libraryPath } = settings;

    // If library path is not set, we can't proceed
    if (!libraryPath) {
      debugLog('Library path not set in settings, cannot proceed');
      throw new Error('Library path is not set in settings');
    }

    debugLog(`Using library path: ${libraryPath}`);

    // Ensure the library path exists
    await ensureDirectoryExists(libraryPath);

    // Divide files into batches for parallel processing
    const batchSize = Math.ceil(files.length / PARALLEL_PROCESSES);
    const batches: string[][] = [];

    for (let i = 0; i < files.length; i += batchSize) {
      batches.push(files.slice(i, i + batchSize));
    }

    debugLog(
      `Created ${batches.length} batches with size ~${batchSize} for processing`,
    );

    // Progress tracking
    let processedCount = 0;
    let tracksAdded = 0;

    // Files to delete after processing (higher-quality replacements)
    const filesToDelete: string[] = [];
    const tracksToDelete: string[] = [];

    // Process batches in sequence to avoid overwhelming resources
    const processBatches = async (): Promise<void> => {
      db.beginBatchMode();
      try {
        for (let i = 0; i < batches.length; i += 1) {
          const batch = batches[i];

          // Send progress event for the batch
          sendProgressEvent('library:scanProgress', {
            total: totalFiles,
            processed: processedCount,
            current: `Processing batch ${i + 1} of ${batches.length}`,
          });

          // Process the batch (this is a scan, not an import)
          // eslint-disable-next-line no-await-in-loop
          const rawTracks = await processBatch(
            batch,
            existingFilePaths,
            trackMap,
            libraryPath,
            undefined, // folderRoot
            false, // isImport=false for scan operations
          );

          // Deduplicate within the batch (parallel processing can produce dupes)
          const processedTracks = deduplicateBatchResults(rawTracks);

          // Collect files and tracks to delete
          processedTracks.forEach((track) => {
            if (track.replaceId && track.oldPath) {
              tracksToDelete.push(track.replaceId);
              filesToDelete.push(track.oldPath);
              existingFilePaths.delete(track.oldPath);

              // Remove these properties before adding to database
              delete track.replaceId;
              delete track.oldPath;
            }
          });

          // Add tracks to database in batches
          if (processedTracks.length > 0) {
            // Add tracks in smaller batches to avoid overwhelming the database
            for (let j = 0; j < processedTracks.length; j += DB_BATCH_SIZE) {
              const trackBatch = processedTracks.slice(j, j + DB_BATCH_SIZE);

              // Use addTrack for each track and update tracking structures
              trackBatch.forEach((track) => {
                try {
                  const addedTrack = db.addTrack(track);
                  existingFilePaths.add(addedTrack.filePath);
                  trackMap.set(getTrackKey(addedTrack), addedTrack);
                } catch (error) {
                  console.error(
                    `Error adding track to database: ${track.title}`,
                    error,
                  );
                }
              });

              // Persist once per sub-batch instead of once per track
              db.persistNow();
            }

            tracksAdded += processedTracks.length;
          }

          processedCount += batch.length;

          // Send progress event
          sendProgressEvent('library:scanProgress', {
            total: totalFiles,
            processed: processedCount,
            current: `Processed ${processedCount} of ${totalFiles} files`,
          });
        }
      } finally {
        db.endBatchMode();
      }
    };

    // Process batches
    await processBatches();

    // Delete replaced tracks from database
    if (tracksToDelete.length > 0) {
      db.beginBatchMode();
      try {
        tracksToDelete.forEach((id) => {
          db.deleteTrack(id);
        });
      } finally {
        db.endBatchMode();
      }
    }

    // Delete replaced files - process file deletions in parallel
    const fileDeletionPromises = filesToDelete.map(async (filePath) => {
      try {
        const fileExists = await exists(filePath);
        if (fileExists) {
          await unlink(filePath);
        }
      } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
      }
    });

    await Promise.all(fileDeletionPromises);

    // Count tracks in final database
    const finalTracks = db.getAllTracks();

    debugLog(`Final database contains ${finalTracks.length} total tracks`);

    // Send completion event
    sendProgressEvent('library:scanComplete', {
      tracksAdded,
    });

    return { tracksAdded };
  } catch (error) {
    debugLog(`ERROR: Library scan failed:`, error);
    console.error(`Error scanning library at ${dirPath}:`, error);
    throw error;
  }
}

/**
 * Import specific music files into the database
 * @param filePaths - Array of file paths (can include folders)
 * @returns Object with the number of tracks added
 */
export async function importFiles(
  filePaths: string[],
): Promise<{ tracksAdded: number }> {
  debugLog(`Beginning import of ${filePaths.length} paths`);

  try {
    // Get existing tracks to avoid duplicates
    const existingTracks = db.getAllTracks();
    const existingFilePaths = new Set(
      existingTracks.map((track) => track.filePath),
    );

    // Create an efficient lookup map for duplicate detection
    const trackMap = createTrackMap(existingTracks);

    // Get the library path from settings
    const settings = db.getSettings();
    const { libraryPath } = settings;

    if (!libraryPath) {
      debugLog('Library path not set in settings, cannot proceed');
      throw new Error('Library path is not set in settings');
    }

    debugLog(`Using library path: ${libraryPath}`);

    // Ensure the library path exists
    await ensureDirectoryExists(libraryPath);

    // Separate files and folders
    const filesToProcess: string[] = [];
    const foldersToProcess: { folderPath: string; folderRoot: string }[] = [];

    // Check each path to determine if it's a file or folder
    const pathCheckPromises = filePaths.map(async (itemPath) => {
      try {
        const itemStat = await stat(itemPath);
        if (itemStat.isDirectory()) {
          // It's a folder - we'll scan it recursively and preserve structure
          return {
            type: 'folder' as const,
            folderPath: itemPath,
            folderRoot: itemPath,
          };
        }
        if (itemStat.isFile() && isSupportedFile(itemPath)) {
          // It's a supported file
          return { type: 'file' as const, filePath: itemPath };
        }
      } catch (error) {
        debugLog(`Error checking path ${itemPath}:`, error);
      }
      return null;
    });

    const pathCheckResults = await Promise.all(pathCheckPromises);

    // Organize into files and folders
    pathCheckResults.forEach((result) => {
      if (result?.type === 'folder') {
        foldersToProcess.push({
          folderPath: result.folderPath,
          folderRoot: result.folderRoot,
        });
      } else if (result?.type === 'file') {
        filesToProcess.push(result.filePath);
      }
    });

    debugLog(
      `Found ${filesToProcess.length} individual files and ${foldersToProcess.length} folders to process`,
    );

    // Collect all files from folders
    // eslint-disable-next-line no-restricted-syntax
    for (const { folderPath } of foldersToProcess) {
      const folderFiles = getMusicFiles(folderPath);
      // Tag these files with their folder root for relative path preservation
      folderFiles.forEach((file) => {
        filesToProcess.push(file);
      });
      debugLog(
        `Found ${folderFiles.length} music files in folder ${folderPath}`,
      );
    }

    // Filter out unsupported files (in case getMusicFiles returned any)
    const supportedFiles = filesToProcess.filter((filePath) =>
      isSupportedFile(filePath),
    );

    const totalFiles = supportedFiles.length;
    debugLog(`Total files to import: ${totalFiles}`);

    // Create a map to track which files belong to which folder root
    const fileToFolderRoot = new Map<string, string>();
    // eslint-disable-next-line no-restricted-syntax
    for (const { folderPath, folderRoot } of foldersToProcess) {
      const folderFiles = getMusicFiles(folderPath);
      folderFiles.forEach((file) => {
        fileToFolderRoot.set(file, folderRoot);
      });
    }

    // Divide files into batches for parallel processing
    const batchSize = Math.ceil(supportedFiles.length / PARALLEL_PROCESSES);
    const batches: { files: string[]; folderRoot?: string }[] = [];

    // Create batches
    Array.from({
      length: Math.ceil(supportedFiles.length / batchSize),
    }).forEach((_, i) => {
      const batchFiles = supportedFiles.slice(
        i * batchSize,
        (i + 1) * batchSize,
      );
      // Determine if all files in this batch share the same folder root
      const folderRoots = new Set(
        batchFiles.map((f) => fileToFolderRoot.get(f)).filter(Boolean),
      );
      const folderRoot =
        folderRoots.size === 1 ? Array.from(folderRoots)[0] : undefined;
      batches.push({ files: batchFiles, folderRoot });
    });

    debugLog(
      `Created ${batches.length} batches with size ~${batchSize} for processing`,
    );

    // Progress tracking
    let processedCount = 0;
    let tracksAdded = 0;

    // Files to delete after processing (higher-quality replacements)
    const filesToDelete: string[] = [];
    const tracksToDelete: string[] = [];

    // Process batches in sequence to avoid overwhelming resources
    const processBatches = async (): Promise<void> => {
      db.beginBatchMode();
      try {
        for (let i = 0; i < batches.length; i += 1) {
          const { files: batch } = batches[i];

          // Determine folder root for this batch
          // If batch has mixed sources, process each file individually with its own root
          const batchFolderRoots = batch.map((f) => fileToFolderRoot.get(f));
          const allSameRoot = batchFolderRoots.every(
            (root) => root === batchFolderRoots[0],
          );

          // Process the batch (this is an import operation)
          // eslint-disable-next-line no-await-in-loop
          const rawTracks = await processBatch(
            batch,
            existingFilePaths,
            trackMap,
            libraryPath,
            allSameRoot ? batchFolderRoots[0] : undefined,
            true, // isImport=true for import operations
          );

          // Deduplicate within the batch (parallel processing can produce dupes)
          const processedTracks = deduplicateBatchResults(rawTracks);

          // Collect files and tracks to delete
          processedTracks.forEach((track) => {
            if (track.replaceId && track.oldPath) {
              tracksToDelete.push(track.replaceId);
              filesToDelete.push(track.oldPath);
              existingFilePaths.delete(track.oldPath);

              // Remove these properties before adding to database
              delete track.replaceId;
              delete track.oldPath;
            }
          });

          // Add tracks to database in batches
          if (processedTracks.length > 0) {
            // Add tracks in smaller batches to avoid overwhelming the database
            for (let j = 0; j < processedTracks.length; j += DB_BATCH_SIZE) {
              const trackBatch = processedTracks.slice(j, j + DB_BATCH_SIZE);

              // Use addTrack for each track and update tracking structures
              trackBatch.forEach((track) => {
                try {
                  const addedTrack = db.addTrack(track);
                  existingFilePaths.add(addedTrack.filePath);
                  trackMap.set(getTrackKey(addedTrack), addedTrack);
                } catch (error) {
                  console.error(
                    `Error adding track to database: ${track.title}`,
                    error,
                  );
                }
              });

              // Persist once per sub-batch instead of once per track
              db.persistNow();
            }

            tracksAdded += processedTracks.length;
          }

          processedCount += batch.length;

          // Send progress event
          sendProgressEvent('library:scanProgress', {
            total: totalFiles,
            processed: processedCount,
            current: `Processed ${processedCount} of ${totalFiles} files`,
          });
        }
      } finally {
        db.endBatchMode();
      }
    };

    // Process batches
    await processBatches();

    // Delete replaced tracks from database
    if (tracksToDelete.length > 0) {
      db.beginBatchMode();
      try {
        tracksToDelete.forEach((id) => {
          db.deleteTrack(id);
        });
      } finally {
        db.endBatchMode();
      }
    }

    // Delete replaced files - process file deletions in parallel
    const fileDeletionPromises = filesToDelete.map(async (filePath) => {
      try {
        const fileExists = await exists(filePath);
        if (fileExists) {
          await unlink(filePath);
        }
      } catch (error) {
        console.error(`Error deleting file ${filePath}:`, error);
      }
    });

    await Promise.all(fileDeletionPromises);

    // Count tracks in final database
    const finalTracks = db.getAllTracks();

    debugLog(`Final database contains ${finalTracks.length} total tracks`);

    // Send completion event
    sendProgressEvent('library:scanComplete', {
      tracksAdded,
    });

    return { tracksAdded };
  } catch (error) {
    debugLog(`ERROR: File import failed:`, error);
    console.error(`Error importing files:`, error);
    throw error;
  }
}
