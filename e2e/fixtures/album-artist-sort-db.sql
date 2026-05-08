-- Album-artist sort e2e fixture.
-- Seeds a small set of tracks where artist != albumArtist so the Artist column
-- comparator divergence is observable: under album-artist sort, all
-- 'Kendrick Lamar' albumArtist rows stay grouped (including featured-artist
-- variants); under raw-artist sort, the featured rows scatter.
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
  trackNumber INTEGER,
  totalTracks INTEGER,
  discNumber INTEGER,
  totalDiscs INTEGER,
  year INTEGER,
  bpm INTEGER,
  composer TEXT,
  comment TEXT
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
  librarySorting TEXT,
  columnOrder TEXT,
  sortArtistByAlbumArtist INTEGER NOT NULL DEFAULT 1
);

-- Six test tracks that reuse existing test-songs-large mp3 paths for filePath
-- uniqueness, with custom artist/albumArtist/album metadata for sort-order
-- assertions. Two album artists: Frank Ocean (2 tracks) and Kendrick Lamar
-- (4 tracks, 2 of which are featured-artist variants).
INSERT INTO tracks (id, filePath, title, artist, album, albumArtist, genre, duration, playCount, dateAdded, lastPlayed, lyrics, trackNumber, totalTracks, discNumber, totalDiscs, year, bpm, composer, comment) VALUES
('sas-001', '{{TEST_SONGS_PATH}}/001 - Aurora Synth - Dream of Love.mp3', 'Nikes', 'Frank Ocean', 'Blonde', 'Frank Ocean', 'R&B', 10.0, 0, '2024-01-01T05:00:00.000Z', NULL, NULL, 1, NULL, NULL, NULL, 2016, NULL, NULL, NULL),
('sas-002', '{{TEST_SONGS_PATH}}/002 - The Jazz Collective - A Dream of Love.mp3', 'Pyramids', 'Frank Ocean', 'Channel Orange', 'Frank Ocean', 'R&B', 10.0, 0, '2024-01-02T05:00:00.000Z', NULL, NULL, 2, NULL, NULL, NULL, 2012, NULL, NULL, NULL),
('sas-003', '{{TEST_SONGS_PATH}}/003 - Indie Folk Band - My Dream of Love.mp3', 'DNA', 'Kendrick Lamar', 'DAMN', 'Kendrick Lamar', 'Hip Hop', 10.0, 0, '2024-01-03T05:00:00.000Z', NULL, NULL, 1, NULL, NULL, NULL, 2017, NULL, NULL, NULL),
('sas-004', '{{TEST_SONGS_PATH}}/004 - Electronic Pulse - Your Dream of Love.mp3', 'LOYALTY.', 'Kendrick Lamar feat. Rihanna', 'DAMN', 'Kendrick Lamar', 'Hip Hop', 10.0, 0, '2024-01-04T05:00:00.000Z', NULL, NULL, 2, NULL, NULL, NULL, 2017, NULL, NULL, NULL),
('sas-005', '{{TEST_SONGS_PATH}}/005 - Classical Masters - Our Dream of Love.mp3', 'Poetic Justice', 'Kendrick Lamar feat. Drake', 'good kid m.A.A.d city', 'Kendrick Lamar', 'Hip Hop', 10.0, 0, '2024-01-05T05:00:00.000Z', NULL, NULL, 3, NULL, NULL, NULL, 2012, NULL, NULL, NULL),
('sas-006', '{{TEST_SONGS_PATH}}/006 - Rock Titans - Lost Dream.mp3', 'Doves in the Wind', 'Kendrick Lamar feat. SZA', 'good kid m.A.A.d city', 'Kendrick Lamar', 'Hip Hop', 10.0, 0, '2024-01-06T05:00:00.000Z', NULL, NULL, 4, NULL, NULL, NULL, 2012, NULL, NULL, NULL);

-- Default smart playlists so the app boots cleanly without recreating them.
INSERT INTO playlists (id, name, isSmart, smartPlaylistId, ruleSet, trackIds, sortPreference) VALUES
('playlist-smart-1', 'Recently Added', 1, 'recently-added', '{"type":"recentlyAdded","limit":50}', '[]', NULL),
('playlist-smart-2', 'Recently Played', 1, 'recently-played', '{"type":"recentlyPlayed","limit":50}', '[]', NULL),
('playlist-smart-3', 'Most Played', 1, 'most-played', '{"type":"mostPlayed","limit":50}', '[]', NULL);

-- Settings row with sortArtistByAlbumArtist explicitly seeded ON.
INSERT INTO settings (id, libraryPath, theme, columns, lastPlayedSongId, volume, columnWidths, librarySorting, columnOrder, sortArtistByAlbumArtist) VALUES
('app-settings', '{{TEST_SONGS_PATH}}', 'dark', '{"title":true,"artist":true,"album":true,"albumArtist":true,"genre":true,"duration":true,"playCount":true,"dateAdded":true,"lastPlayed":true}', NULL, 1.0, NULL, NULL, NULL, 1);
