/**
 * Legacy Types for hihat v1 (userConfig.json)
 *
 * This file contains TypeScript interfaces for the old hihat v1 data structure
 * that was stored in userConfig.json. These types are used ONLY for migration
 * purposes to convert old user data to the new hihat2 database structure.
 *
 * DO NOT use these types for any new functionality!
 */

/**
 * Additional song metadata that was tracked separately from music-metadata
 */
export interface LegacyAdditionalSongInfo {
  playCount: number; // Number of times the song has been played
  lastPlayed: number; // Timestamp in milliseconds (0 if never played)
  dateAdded: number; // Timestamp in milliseconds when added to library
}

/**
 * Lightweight audio metadata structure from hihat v1
 * This was a simplified version of music-metadata's IAudioMetadata
 */
export interface LegacyAudioMetadata {
  common: {
    artist?: string;
    album?: string;
    title?: string;
    track?: {
      no: number | null;
      of: number | null;
    };
    disk?: {
      no: number | null;
      of: number | null;
    };
    albumartist?: string;
    picture: null; // Always null - album art was fetched separately
  };
  format: {
    duration?: number; // Duration in seconds
  };
  additionalInfo: LegacyAdditionalSongInfo;
}

/**
 * Playlist structure from hihat v1
 */
export interface LegacyPlaylist {
  name: string;
  songs: string[]; // Array of file paths
}

/**
 * The complete userConfig.json structure from hihat v1
 */
export interface LegacyStoreStructure {
  library: {
    [filePath: string]: LegacyAudioMetadata;
  };
  playlists: LegacyPlaylist[];
  lastPlayedSong: string; // File path to the last played song
  libraryPath: string;
  initialized: boolean;
}
