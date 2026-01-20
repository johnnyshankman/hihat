#!/usr/bin/env node
/* eslint-disable no-console, no-plusplus */
/**
 * Generate test MP3 files with 10 seconds of silence and unique metadata
 * Usage: node e2e/scripts/generate-test-songs.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const NUM_SONGS = 200;
const DURATION_SECONDS = 10;
const OUTPUT_DIR = path.join(__dirname, '../fixtures/test-songs-large');

// Realistic test data
const ARTISTS = [
  {
    name: 'Aurora Synth',
    albums: ['Digital Dreams', 'Neon Horizons', 'Electric Sunset'],
  },
  {
    name: 'The Jazz Collective',
    albums: ['Blue Notes', 'Midnight Sessions', 'Swing Time'],
  },
  {
    name: 'Indie Folk Band',
    albums: ['Autumn Leaves', 'Mountain Songs', 'Fireside Tales'],
  },
  {
    name: 'Electronic Pulse',
    albums: ['Bass Drop', 'Future Waves', 'Cybernetic'],
  },
  {
    name: 'Classical Masters',
    albums: ['Symphony No. 1', 'Piano Concertos', 'String Quartets'],
  },
  {
    name: 'Rock Titans',
    albums: ['Thunder Road', 'Electric Storm', 'Heavy Metal Heart'],
  },
  {
    name: 'Hip Hop Legends',
    albums: ['Street Poetry', 'Urban Chronicles', 'Beats & Rhymes'],
  },
  {
    name: 'Soul Sisters',
    albums: ['Heartfelt', 'Gospel Light', 'Rhythm & Blues'],
  },
  {
    name: 'World Music Ensemble',
    albums: ['Global Sounds', 'Cultural Fusion', 'Earth Rhythms'],
  },
  {
    name: 'Ambient Collective',
    albums: ['Peaceful Spaces', 'Dreamscapes', 'Meditation'],
  },
  { name: 'Punk Rockers', albums: ['Anarchy Now', 'Rebellion', 'No Rules'] },
  {
    name: 'Country Roads',
    albums: ['Nashville Nights', 'Southern Comfort', 'Dusty Trails'],
  },
  { name: 'R&B Smooth', albums: ['Late Night Vibes', 'Slow Jams', 'Soulful'] },
  {
    name: 'Metal Core',
    albums: ['Destruction', 'Chaos Theory', 'Dark Matter'],
  },
  { name: 'Reggae Vibes', albums: ['Island Time', 'One Love', 'Roots'] },
  {
    name: 'Pop Stars',
    albums: ['Chart Toppers', 'Radio Hits', 'Summer Anthems'],
  },
  {
    name: 'Blues Brothers',
    albums: ['Delta Blues', 'Chicago Nights', 'Twelve Bar'],
  },
  {
    name: 'Techno Masters',
    albums: ['Warehouse', 'Underground', 'Rave Culture'],
  },
  {
    name: 'Acoustic Sessions',
    albums: ['Unplugged', 'Stripped Down', 'Live & Raw'],
  },
  {
    name: 'Orchestra Prime',
    albums: ['Grand Overture', 'Romantic Era', 'Modern Classics'],
  },
];

const GENRES = [
  'Electronic',
  'Jazz',
  'Indie Folk',
  'EDM',
  'Classical',
  'Rock',
  'Hip Hop',
  'Soul',
  'World',
  'Ambient',
  'Punk',
  'Country',
  'R&B',
  'Metal',
  'Reggae',
  'Pop',
  'Blues',
  'Techno',
  'Acoustic',
  'Orchestral',
];

const SONG_PREFIXES = [
  'The',
  'A',
  'My',
  'Your',
  'Our',
  'Lost',
  'Found',
  'Broken',
  'Beautiful',
  'Dark',
  'Light',
  'Silent',
  'Loud',
  'Soft',
  'Hard',
  'Deep',
  'High',
  'Low',
  'Fast',
  'Slow',
];

const SONG_NOUNS = [
  'Dream',
  'Night',
  'Day',
  'Love',
  'Heart',
  'Soul',
  'Mind',
  'World',
  'Sky',
  'Ocean',
  'Mountain',
  'River',
  'Fire',
  'Ice',
  'Wind',
  'Rain',
  'Sun',
  'Moon',
  'Star',
  'Light',
  'Shadow',
  'Echo',
  'Memory',
  'Journey',
  'Path',
  'Road',
  'Home',
  'Away',
  'Time',
  'Space',
  'Feeling',
  'Moment',
  'Story',
  'Song',
  'Dance',
  'Rhythm',
  'Beat',
  'Melody',
  'Harmony',
  'Note',
];

const SONG_SUFFIXES = [
  'of Love',
  'in the Night',
  'at Dawn',
  'Forever',
  'Again',
  'Tonight',
  'Tomorrow',
  'Yesterday',
  'Always',
  'Never',
  '(Remix)',
  '(Live)',
  '(Acoustic)',
  '(Extended)',
  'Pt. 1',
  'Pt. 2',
  'Interlude',
  'Outro',
  'Intro',
  '',
];

function generateSongTitle(index) {
  const prefix = SONG_PREFIXES[index % SONG_PREFIXES.length];
  const noun =
    SONG_NOUNS[Math.floor(index / SONG_PREFIXES.length) % SONG_NOUNS.length];
  const suffix =
    SONG_SUFFIXES[
      Math.floor(index / (SONG_PREFIXES.length * SONG_NOUNS.length)) %
        SONG_SUFFIXES.length
    ];

  // Add some variation
  if (index % 7 === 0) {
    return `${noun} ${suffix}`.trim();
  }
  if (index % 5 === 0) {
    return `${prefix} ${noun}`;
  }
  return `${prefix} ${noun} ${suffix}`.trim();
}

function generateTrackData(index) {
  const artistIndex = index % ARTISTS.length;
  const artist = ARTISTS[artistIndex];
  const albumIndex = Math.floor(index / ARTISTS.length) % artist.albums.length;
  const album = artist.albums[albumIndex];
  const genre = GENRES[artistIndex];
  const trackNumber = (index % 12) + 1; // 1-12 tracks per album
  const title = generateSongTitle(index);

  // Generate a date added that spreads across the year
  const dayOffset = index % 365;
  const dateAdded = new Date(2024, 0, 1 + dayOffset);

  return {
    index,
    title,
    artist: artist.name,
    album,
    genre,
    trackNumber,
    year: 2024,
    dateAdded: dateAdded.toISOString(),
  };
}

function sanitizeFilename(str) {
  return str
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateMp3(trackData) {
  const { index, title, artist, album, genre, trackNumber, year } = trackData;

  // Create a filename that sorts properly: padded index + artist + title
  const paddedIndex = String(index + 1).padStart(3, '0');
  const filename = sanitizeFilename(
    `${paddedIndex} - ${artist} - ${title}.mp3`,
  );
  const outputPath = path.join(OUTPUT_DIR, filename);

  // Skip if file already exists
  if (fs.existsSync(outputPath)) {
    console.log(`Skipping (exists): ${filename}`);
    return { ...trackData, filename, outputPath };
  }

  // Use ffmpeg to create a silent MP3 with metadata
  // -f lavfi -i anullsrc creates silent audio
  // -t sets duration
  // -metadata sets ID3 tags
  const cmd = [
    'ffmpeg',
    '-f lavfi',
    '-i anullsrc=r=44100:cl=stereo',
    `-t ${DURATION_SECONDS}`,
    '-c:a libmp3lame',
    '-b:a 128k',
    `-metadata title="${title}"`,
    `-metadata artist="${artist}"`,
    `-metadata album="${album}"`,
    `-metadata genre="${genre}"`,
    `-metadata track="${trackNumber}"`,
    `-metadata date="${year}"`,
    '-y', // Overwrite without asking
    `"${outputPath}"`,
  ].join(' ');

  try {
    execSync(cmd, { stdio: 'pipe' });
    console.log(`Created: ${filename}`);
    return { ...trackData, filename, outputPath };
  } catch (error) {
    console.error(`Failed to create ${filename}: ${error.message}`);
    return null;
  }
}

function generateSqlFixture(tracks) {
  const validTracks = tracks.filter((t) => t !== null);

  let sql = `-- Large test database initialization for e2e tests (${validTracks.length} tracks)
-- Auto-generated by generate-test-songs.js
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
`;

  // Generate INSERT statements in batches to avoid SQL length issues
  const batchSize = 50;
  for (let i = 0; i < validTracks.length; i += batchSize) {
    const batch = validTracks.slice(
      i,
      Math.min(i + batchSize, validTracks.length),
    );

    sql += `INSERT INTO tracks (id, filePath, title, artist, album, albumArtist, genre, duration, playCount, dateAdded, lastPlayed, lyrics, trackNumber) VALUES\n`;

    const values = batch.map((track, batchIndex) => {
      const globalIndex = i + batchIndex;
      const id = `test-large-${String(globalIndex + 1).padStart(3, '0')}`;
      const filePath = `{{TEST_SONGS_LARGE_PATH}}/${track.filename}`;
      const playCount = Math.floor(Math.random() * 50);
      const lastPlayed =
        playCount > 0
          ? `'2024-${String((globalIndex % 12) + 1).padStart(2, '0')}-${String((globalIndex % 28) + 1).padStart(2, '0')}T00:00:00Z'`
          : 'NULL';

      // Escape single quotes in strings
      const escapedTitle = track.title.replace(/'/g, "''");
      const escapedArtist = track.artist.replace(/'/g, "''");
      const escapedAlbum = track.album.replace(/'/g, "''");

      return `('${id}', '${filePath}', '${escapedTitle}', '${escapedArtist}', '${escapedAlbum}', '${escapedArtist}', '${track.genre}', ${DURATION_SECONDS}.0, ${playCount}, '${track.dateAdded}', ${lastPlayed}, NULL, ${track.trackNumber})`;
    });

    sql += `${values.join(',\n')};\n\n`;
  }

  // Add playlists
  sql += `-- Insert test playlists
INSERT INTO playlists (id, name, isSmart, smartPlaylistId, ruleSet, trackIds) VALUES
('playlist-large-1', 'Large Test Playlist', 0, NULL, NULL, '["test-large-001","test-large-002","test-large-003"]'),
('playlist-large-2', 'Recently Added', 1, 'recently-added', '{"type":"recentlyAdded","limit":50}', '[]'),
('playlist-large-3', 'Recently Played', 1, 'recently-played', '{"type":"recentlyPlayed","limit":50}', '[]'),
('playlist-large-4', 'Most Played', 1, 'most-played', '{"type":"mostPlayed","limit":50}', '[]');

-- Insert default settings
INSERT INTO settings (id, libraryPath, theme, columns, lastPlayedSongId, volume) VALUES
('app-settings', '{{TEST_SONGS_LARGE_PATH}}', 'dark', '{"title":true,"artist":true,"album":true,"albumArtist":true,"genre":true,"duration":true,"playCount":true,"dateAdded":true,"lastPlayed":true}', NULL, 1.0);
`;

  return sql;
}

async function main() {
  console.log(`Generating ${NUM_SONGS} test MP3 files...`);
  console.log(`Output directory: ${OUTPUT_DIR}`);

  // Create output directory if it doesn't exist
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log('Created output directory');
  }

  // Generate all tracks
  const tracks = [];
  for (let i = 0; i < NUM_SONGS; i++) {
    const trackData = generateTrackData(i);
    const result = generateMp3(trackData);
    tracks.push(result);

    // Progress indicator
    if ((i + 1) % 20 === 0) {
      console.log(`Progress: ${i + 1}/${NUM_SONGS}`);
    }
  }

  // Generate SQL fixture file
  const sqlContent = generateSqlFixture(tracks);
  const sqlPath = path.join(__dirname, '../fixtures/test-db-large.sql');
  fs.writeFileSync(sqlPath, sqlContent);
  console.log(`\nGenerated SQL fixture: ${sqlPath}`);

  // Summary
  const successCount = tracks.filter((t) => t !== null).length;
  console.log(`\nComplete! Generated ${successCount}/${NUM_SONGS} MP3 files`);
  console.log(`Files location: ${OUTPUT_DIR}`);
}

main().catch(console.error);
