-- New user database initialization for e2e tests
-- This simulates a brand new user with an empty library

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
  trackIds TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  libraryPath TEXT,
  theme TEXT NOT NULL,
  columns TEXT NOT NULL,
  lastPlayedSongId TEXT,
  volume REAL
);

-- No tracks inserted - empty library for new user

-- Insert only the default smart playlists
-- These are created automatically by the app's self-healing mechanism
INSERT INTO playlists (id, name, isSmart, smartPlaylistId, ruleSet, trackIds) VALUES
('playlist-smart-1', 'Recently Added', 1, 'recently-added', '{"type":"recentlyAdded","limit":50}', '[]'),
('playlist-smart-2', 'Recently Played', 1, 'recently-played', '{"type":"recentlyPlayed","limit":50}', '[]'),
('playlist-smart-3', 'Most Played', 1, 'most-played', '{"type":"mostPlayed","limit":50}', '[]');

-- Insert default settings for new user
-- Note: libraryPath will be replaced with actual TEST_SONGS_PATH by test initialization code
-- No lastPlayedSongId since the user hasn't played anything yet
INSERT INTO settings (id, libraryPath, theme, columns, lastPlayedSongId, volume) VALUES
('app-settings', '{{TEST_SONGS_PATH}}', 'dark', '{"title":true,"artist":true,"album":true,"albumArtist":true,"genre":true,"duration":true,"playCount":true,"dateAdded":true,"lastPlayed":true}', NULL, 1.0);
