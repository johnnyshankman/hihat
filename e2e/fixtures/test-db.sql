-- Test database initialization for e2e tests
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

-- Insert test tracks
INSERT INTO tracks (id, filePath, title, artist, album, albumArtist, genre, duration, playCount, dateAdded, lastPlayed, lyrics, trackNumber) VALUES
('test-1', '/test-songs/03 - A. G. Cook - Undying.m4a', 'Undying', 'A. G. Cook', '7G', 'A. G. Cook', 'Electronic', 243.5, 5, '2024-01-01T00:00:00Z', '2024-01-15T00:00:00Z', NULL, 3),
('test-2', '/test-songs/03 - A. G. Cook - Windows.m4a', 'Windows', 'A. G. Cook', '7G', 'A. G. Cook', 'Electronic', 189.2, 3, '2024-01-01T00:00:00Z', NULL, NULL, 3),
('test-3', '/test-songs/03 - Bill Evans - Alice In Wonderland (Live At The Village Vanguard, 1961 - Take 1).m4a', 'Alice In Wonderland (Live)', 'Bill Evans', 'Sunday at the Village Vanguard', 'Bill Evans Trio', 'Jazz', 523.7, 12, '2024-01-02T00:00:00Z', '2024-01-16T00:00:00Z', NULL, 3),
('test-4', '/test-songs/03 - Bill Evans - All Of You (Live At The Village Vanguard, 1961 - Take 2).m4a', 'All Of You (Live)', 'Bill Evans', 'Sunday at the Village Vanguard', 'Bill Evans Trio', 'Jazz', 482.3, 8, '2024-01-02T00:00:00Z', '2024-01-14T00:00:00Z', NULL, 3),
('test-5', '/test-songs/03 - Bill Evans - Waltz For Debby (Live At The Village Vanguard, New York - 1961 - Take 2).m4a', 'Waltz For Debby (Live)', 'Bill Evans', 'Sunday at the Village Vanguard', 'Bill Evans Trio', 'Jazz', 412.1, 15, '2024-01-03T00:00:00Z', '2024-01-17T00:00:00Z', NULL, 3),
('test-6', '/test-songs/03 - Bladee - White Meadow.m4a', 'White Meadow', 'Bladee', 'Eversince', 'Bladee', 'Cloud Rap', 187.9, 7, '2024-01-03T00:00:00Z', NULL, NULL, 3),
('test-7', '/test-songs/03 - Kendrick Lamar - King Kunta(Explicit).m4a', 'King Kunta', 'Kendrick Lamar', 'To Pimp a Butterfly', 'Kendrick Lamar', 'Hip Hop', 234.5, 25, '2024-01-04T00:00:00Z', '2024-01-18T00:00:00Z', NULL, 3);

-- Insert test playlists
INSERT INTO playlists (id, name, isSmart, smartPlaylistId, ruleSet, trackIds) VALUES
('playlist-1', 'Test Playlist 1', 0, NULL, NULL, '["test-1","test-2","test-7"]'),
('playlist-2', 'Jazz Favorites', 0, NULL, NULL, '["test-3","test-4","test-5"]'),
('playlist-3', 'Recently Added', 1, 'recently-added', '{"type":"recentlyAdded","limit":50}', '[]'),
('playlist-4', 'Recently Played', 1, 'recently-played', '{"type":"recentlyPlayed","limit":50}', '[]'),
('playlist-5', 'Most Played', 1, 'most-played', '{"type":"mostPlayed","limit":50}', '[]');

-- Insert default settings
INSERT INTO settings (id, libraryPath, theme, columns, lastPlayedSongId, volume) VALUES 
('app-settings', '/test-songs', 'dark', '{"title":true,"artist":true,"album":true,"albumArtist":true,"genre":true,"duration":true,"playCount":true,"dateAdded":true,"lastPlayed":true}', 'test-7', 1.0);