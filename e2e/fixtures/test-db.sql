-- Test database initialization for e2e tests
CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  artist TEXT,
  album TEXT,
  albumArtist TEXT,
  genre TEXT,
  year INTEGER,
  duration REAL,
  filePath TEXT UNIQUE,
  fileSize INTEGER,
  bitrate INTEGER,
  sampleRate INTEGER,
  codec TEXT,
  container TEXT,
  dateAdded TEXT,
  dateModified TEXT,
  playCount INTEGER DEFAULT 0,
  rating INTEGER,
  bpm INTEGER,
  comment TEXT,
  albumArt TEXT,
  liked INTEGER DEFAULT 0,
  lastPlayed TEXT,
  trackNumber INTEGER,
  discNumber INTEGER
);

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  dateCreated TEXT,
  dateModified TEXT
);

CREATE TABLE IF NOT EXISTS playlist_songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlistId INTEGER,
  songId INTEGER,
  position INTEGER,
  FOREIGN KEY (playlistId) REFERENCES playlists (id) ON DELETE CASCADE,
  FOREIGN KEY (songId) REFERENCES songs (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_songs_artist ON songs(artist);
CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album);
CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist ON playlist_songs(playlistId);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song ON playlist_songs(songId);