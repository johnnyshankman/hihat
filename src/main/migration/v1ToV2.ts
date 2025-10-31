/**
 * Migration Module: hihat v1 to hihat2
 *
 * This module handles the one-time migration from hihat v1's userConfig.json
 * to hihat2's SQLite database structure.
 *
 * Migration Process:
 * 1. Check if userConfig.json exists in ~/Library/Application Support/hihat
 * 2. Check if it has already been migrated (marked with .migrated extension)
 * 3. Check if user already has a library configured in hihat2 (safety check in main.ts)
 * 4. Read and parse the legacy JSON structure
 * 5. Convert tracks to new database format
 * 6. Convert playlists to new format
 * 7. Import settings (libraryPath, lastPlayedSong, etc.)
 * 8. Mark the file as migrated by renaming it
 *
 * Safety Features:
 * - Migration only runs if hihat2 library path is empty (prevents data mixing)
 * - Once migrated, file is renamed to .migrated to prevent re-running
 * - All errors are caught and logged, allowing app to continue startup
 * - Uses INSERT OR IGNORE to handle any potential duplicate entries
 */

import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import {
  LegacyStoreStructure,
  LegacyAudioMetadata,
  LegacyPlaylist,
} from '../../types/legacyTypes';
import { Track, Playlist } from '../../types/dbTypes';

/**
 * Get the path to the legacy hihat v1 userConfig.json file
 * In TEST_MODE, uses TEST_LEGACY_CONFIG_PATH if provided
 */
function getLegacyConfigPath(): string {
  // TEST_MODE: Use controlled test fixture path during E2E tests
  if (process.env.TEST_MODE === 'true' && process.env.TEST_LEGACY_CONFIG_PATH) {
    console.warn(
      'Using TEST legacy config path:',
      process.env.TEST_LEGACY_CONFIG_PATH,
    );
    return process.env.TEST_LEGACY_CONFIG_PATH;
  }
  const basePath = app.getPath('userData');
  const userDataPath =
    process.env.NODE_ENV === 'development'
      ? path.join(basePath, '..', `${app.getName()}-dev`)
      : basePath;

  // hihat stored data in ~/Library/Application Support/hihat/userConfig.json
  return path.join(userDataPath, 'userConfig.json');
}

/**
 * Get the path for the migrated marker file
 */
function getMigratedMarkerPath(): string {
  const legacyPath = getLegacyConfigPath();
  return `${legacyPath}.migrated`;
}

/**
 * Unmark the migration (for testing purposes)
 * This allows E2E tests to re-run migration tests
 */
export function unmarkMigration(): void {
  const migratedPath = getMigratedMarkerPath();
  const configPath = getLegacyConfigPath();

  try {
    // If the migrated marker exists, rename it back to the original config
    if (fs.existsSync(migratedPath)) {
      fs.renameSync(migratedPath, configPath);
      console.warn('Migration unmarked (for testing):', configPath);
    }
  } catch (error) {
    console.error('Error unmarking migration:', error);
  }
}

/**
 * Check if userConfig.json exists and needs migration
 */
export function needsMigration(): boolean {
  const configPath = getLegacyConfigPath();
  const migratedPath = getMigratedMarkerPath();

  // If the config file doesn't exist, no migration needed
  if (!fs.existsSync(configPath)) {
    return false;
  }

  // If already migrated, no migration needed
  if (fs.existsSync(migratedPath)) {
    return false;
  }

  return true;
}

/**
 * Read and parse the legacy userConfig.json file
 */
function readLegacyConfig(): LegacyStoreStructure | null {
  const configPath = getLegacyConfigPath();

  try {
    const data = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(data) as LegacyStoreStructure;

    // Validate that it has the expected structure
    if (!parsed.library || !parsed.libraryPath) {
      console.error('Invalid legacy config structure');
      return null;
    }

    return parsed;
  } catch (error) {
    console.error('Error reading legacy config:', error);
    return null;
  }
}

/**
 * Convert a legacy audio metadata object to a new Track
 */
function convertLegacyTrackToTrack(
  filePath: string,
  legacyMetadata: LegacyAudioMetadata,
): Track {
  const { common, format, additionalInfo } = legacyMetadata;

  // Generate a unique ID for the track
  const trackId = uuidv4();

  // Convert timestamps from milliseconds to ISO strings
  const dateAdded = additionalInfo.dateAdded
    ? new Date(additionalInfo.dateAdded).toISOString()
    : new Date().toISOString();

  const lastPlayed =
    additionalInfo.lastPlayed && additionalInfo.lastPlayed > 0
      ? new Date(additionalInfo.lastPlayed).toISOString()
      : null;

  return {
    id: trackId,
    filePath,
    title: common.title || path.basename(filePath),
    artist: common.artist || 'Unknown Artist',
    album: common.album || 'Unknown Album',
    albumArtist: common.albumartist || common.artist || 'Unknown Artist',
    genre: '', // v1 didn't track genre
    duration: format.duration || 0,
    playCount: additionalInfo.playCount || 0,
    dateAdded,
    lastPlayed,
    lyrics: null, // v1 didn't track lyrics
    trackNumber: common.track?.no || null,
  };
}

/**
 * Convert a legacy playlist to a new Playlist
 * Note: This creates user playlists, not smart playlists
 */
function convertLegacyPlaylistToPlaylist(
  legacyPlaylist: LegacyPlaylist,
  filePathToTrackIdMap: Map<string, string>,
): Playlist {
  // Map file paths to track IDs
  const trackIds = legacyPlaylist.songs
    .map((filePath) => filePathToTrackIdMap.get(filePath))
    .filter((id): id is string => id !== undefined);

  return {
    id: uuidv4(),
    name: legacyPlaylist.name,
    isSmart: false,
    smartPlaylistId: null,
    ruleSet: null,
    trackIds,
  };
}

/**
 * Mark the userConfig.json as migrated by renaming it
 */
function markAsMigrated(): void {
  const configPath = getLegacyConfigPath();
  const migratedPath = getMigratedMarkerPath();

  try {
    // Rename the file to indicate it has been migrated
    fs.renameSync(configPath, migratedPath);
    console.warn('Legacy config marked as migrated:', migratedPath);
  } catch (error) {
    console.error('Error marking config as migrated:', error);
  }
}

/**
 * Progress callback for migration
 */
export type MigrationProgressCallback = (progress: {
  phase: 'starting' | 'reading' | 'converting' | 'importing' | 'complete';
  message: string;
}) => void;

/**
 * Main migration function
 * Returns the migrated data that should be inserted into the database
 * @param onProgress - Optional callback to report migration progress
 */
export async function migrateV1ToV2(
  onProgress?: MigrationProgressCallback,
): Promise<{
  tracks: Track[];
  playlists: Playlist[];
  libraryPath: string;
  lastPlayedSongId: string | null;
} | null> {
  console.warn('Starting migration from hihat v1 to hihat2...');

  // Report starting phase
  onProgress?.({
    phase: 'starting',
    message: 'Initializing migration...',
  });

  // Check if migration is needed
  if (!needsMigration()) {
    console.warn('No migration needed');
    return null;
  }

  // Report reading phase
  onProgress?.({
    phase: 'reading',
    message: 'Reading hihat v1 library data...',
  });

  // Read the legacy config
  const legacyConfig = readLegacyConfig();
  if (!legacyConfig) {
    console.error('Failed to read legacy config');
    return null;
  }

  const trackCount = Object.keys(legacyConfig.library).length;
  const playlistCount = legacyConfig.playlists.length;

  console.warn(`Found ${trackCount} tracks in legacy library`);
  console.warn(`Found ${playlistCount} playlists`);

  // Report converting phase
  onProgress?.({
    phase: 'converting',
    message: `Converting ${trackCount} tracks and ${playlistCount} playlists...`,
  });

  // Convert tracks
  const tracks: Track[] = [];
  const filePathToTrackIdMap = new Map<string, string>();

  Object.entries(legacyConfig.library).forEach(([filePath, metadata]) => {
    const track = convertLegacyTrackToTrack(filePath, metadata);
    tracks.push(track);
    filePathToTrackIdMap.set(filePath, track.id);
  });

  // Convert playlists
  const playlists: Playlist[] = legacyConfig.playlists.map((legacyPlaylist) =>
    convertLegacyPlaylistToPlaylist(legacyPlaylist, filePathToTrackIdMap),
  );

  // Get the last played song ID
  let lastPlayedSongId: string | null = null;
  if (legacyConfig.lastPlayedSong) {
    lastPlayedSongId =
      filePathToTrackIdMap.get(legacyConfig.lastPlayedSong) || null;
  }

  // Report importing phase
  onProgress?.({
    phase: 'importing',
    message: 'Importing data into hihat v2 database...',
  });

  // Mark the migration as complete
  markAsMigrated();

  console.warn(
    `Migration complete: ${tracks.length} tracks, ${playlists.length} playlists`,
  );

  return {
    tracks,
    playlists,
    libraryPath: legacyConfig.libraryPath,
    lastPlayedSongId,
  };
}
