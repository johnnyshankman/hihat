-- Migration test database initialization
-- This creates an EMPTY database with NO libraryPath set
-- This allows the migration system to detect and import v1 userConfig.json

CREATE TABLE IF NOT EXISTS tracks (
  id TEXT PRIMARY KEY,
  filePath TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  artist TEXT NOT NULL,
  album TEXT NOT NULL,
  albumArtist TEXT NOT NULL,
  genre TEXT NOT NULL,
  duration REAL NOT NULL,
  playCount INTEGER NOT NULL DEFAULT 0,
  dateAdded TEXT NOT NULL,
  lastPlayed TEXT,
  lyrics TEXT,
  trackNumber INTEGER
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  isSmart INTEGER NOT NULL,
  smartPlaylistId TEXT,
  ruleSet TEXT,
  trackIds TEXT,
  sortPreference TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  libraryPath TEXT,
  theme TEXT NOT NULL,
  columns TEXT NOT NULL,
  lastPlayedSongId TEXT,
  volume REAL,
  columnWidths TEXT,
  librarySorting TEXT
);

-- No tracks inserted - empty library awaiting migration

-- Insert only the default smart playlists
INSERT INTO playlists (id, name, isSmart, smartPlaylistId, ruleSet, trackIds, sortPreference) VALUES
('playlist-smart-1', 'Recently Added', 1, 'recently-added', '{"type":"recentlyAdded","limit":50}', '[]', NULL),
('playlist-smart-2', 'Recently Played', 1, 'recently-played', '{"type":"recentlyPlayed","limit":50}', '[]', NULL),
('playlist-smart-3', 'Most Played', 1, 'most-played', '{"type":"mostPlayed","limit":50}', '[]', NULL);

-- Insert default settings with EMPTY libraryPath to trigger migration
-- This is the key difference from new-user-db.sql
INSERT INTO settings (id, libraryPath, theme, columns, lastPlayedSongId, volume, columnWidths, librarySorting) VALUES
('app-settings', '', 'dark', '{"title":true,"artist":true,"album":true,"albumArtist":true,"genre":true,"duration":true,"playCount":true,"dateAdded":true,"lastPlayed":true}', NULL, 1.0, NULL, NULL);
