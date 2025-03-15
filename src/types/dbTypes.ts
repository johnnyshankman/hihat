/**
 * Database Types
 *
 * This file defines TypeScript interfaces for the database schema.
 * These types are used throughout the application to ensure type safety
 * when interacting with the database.
 */

/**
 * Represents a music track in the library
 */
export interface libraryStoreTrack {
  id: string; // Unique identifier for the track
  filePath: string; // Absolute path to the audio file
  title: string; // Track title
  artist: string; // Artist name
  album: string; // Album name
  albumArtist: string; // Album artist (may differ from track artist)
  genre: string; // Genre
  duration: number; // Duration in seconds
  playCount: number; // Number of times the track has been played
  dateAdded: string; // ISO date string when the track was added to the library
  lastPlayed: string | null; // ISO date string when the track was last played
  lyrics: string | null; // Track lyrics
  trackNumber: number | null; // Track number within album
}

export type Track = libraryStoreTrack;

/**
 * Represents a rule for smart playlists
 */
export interface PlaylistRule {
  type: 'recentlyPlayed' | 'mostPlayed' | 'recentlyAdded'; // Type of smart playlist
  limit: number; // Number of tracks to include
}

/**
 * Represents a playlist in the library
 */
export interface Playlist {
  id: string; // Unique identifier for the playlist
  name: string; // Playlist name
  isSmart: boolean; // Whether this is a smart playlist
  ruleSet: PlaylistRule | null; // Rules for smart playlists
  trackIds: string[]; // Array of track IDs for regular playlists
}

/**
 * Represents column visibility settings for the library table
 */
export interface ColumnVisibility {
  title: boolean;
  artist: boolean;
  album: boolean;
  albumArtist: boolean;
  genre: boolean;
  duration: boolean;
  playCount: boolean;
  dateAdded: boolean;
  lastPlayed: boolean;
}

/**
 * Represents user settings
 */
export interface Settings {
  id: string; // Identifier for settings (usually a single record)
  libraryPath: string; // Path to the music library folder
  theme: 'dark' | 'light'; // UI theme preference
  columns: ColumnVisibility; // Visible columns in the library view
}

/**
 * Represents the application's database schema
 */
export interface AppDatabase {
  tracks: Track[];
  playlists: Playlist[];
  settings: Settings;
}
