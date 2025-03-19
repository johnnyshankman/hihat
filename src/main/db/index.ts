/**
 * Database Service
 *
 * This module provides a SQLite-based database service for the application.
 * It handles database initialization, migrations, and CRUD operations for
 * tracks, playlists, and settings.
 */

import path from 'path';
import fs from 'fs';
import { app, BrowserWindow } from 'electron';
import { v4 as uuidv4 } from 'uuid';
import {
  Track,
  Playlist,
  Settings,
  ColumnVisibility,
  PlaylistRule,
} from '../../types/dbTypes';

// Import BrowserWindow for sending events

// Database file path
const DB_PATH = path.join(app.getPath('userData'), 'library.db');

// Database instance
let db: any;
let useMockDb = false;

// Mock database for development when SQLite fails to load
const mockDb = {
  exec: () => {},
  prepare: () => ({
    get: () => ({ count: 0 }),
    all: () => [],
    run: () => ({ changes: 1 }),
  }),
  pragma: () => {},
  close: () => {},
};

/**
 * Send an event to the renderer process
 * This function is currently not used but kept for potential future use.
 * @param event - Event name
 * @param data - Event data
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function sendEventToRenderer(event: string, data: any): void {
  try {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(event, data);
    }
  } catch (error) {
    console.error(`Failed to send ${event} event:`, error);
    // Continue execution even if event sending fails
  }
}

/**
 * Create database tables if they don't exist
 */
function createTables(): void {
  // Create tracks table
  db.exec(`
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
    )
  `);

  // Create playlists table
  db.exec(`
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      isSmart INTEGER NOT NULL,
      ruleSet TEXT,
      trackIds TEXT
    )
  `);

  // Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id TEXT PRIMARY KEY,
      libraryPath TEXT,
      theme TEXT NOT NULL,
      columns TEXT NOT NULL
    )
  `);
}

/**
 * Initialize default settings if they don't exist
 */
function initDefaultSettings(): void {
  try {
    // Check if the settings table exists
    try {
      const settingsCount = db
        .prepare('SELECT COUNT(*) as count FROM settings')
        .get() as { count: number };

      if (settingsCount && settingsCount.count === 0) {
        // Default column visibility
        const defaultColumns: ColumnVisibility = {
          title: true,
          artist: true,
          album: true,
          albumArtist: true,
          genre: true,
          duration: true,
          playCount: true,
          dateAdded: true,
          lastPlayed: true,
        };

        // Default settings
        const defaultSettings: Settings = {
          id: 'app-settings',
          libraryPath: '',
          theme: 'dark',
          columns: defaultColumns,
        };

        // Insert default settings
        db.prepare(
          `
          INSERT INTO settings (id, libraryPath, theme, columns)
          VALUES (?, ?, ?, ?)
        `,
        ).run(
          defaultSettings.id,
          defaultSettings.libraryPath,
          defaultSettings.theme,
          JSON.stringify(defaultSettings.columns),
        );
      }
    } catch (error) {
      console.error(
        'Error checking settings count, table may not exist yet:',
        error,
      );
      // Ensure the table exists
      createTables();

      // Try again with the table created
      const defaultColumns: ColumnVisibility = {
        title: true,
        artist: true,
        album: true,
        albumArtist: true,
        genre: true,
        duration: true,
        playCount: true,
        dateAdded: true,
        lastPlayed: true,
      };

      // Default settings
      const defaultSettings: Settings = {
        id: 'app-settings',
        libraryPath: '',
        theme: 'dark',
        columns: defaultColumns,
      };

      // Insert default settings
      db.prepare(
        `
        INSERT INTO settings (id, libraryPath, theme, columns)
        VALUES (?, ?, ?, ?)
      `,
      ).run(
        defaultSettings.id,
        defaultSettings.libraryPath,
        defaultSettings.theme,
        JSON.stringify(defaultSettings.columns),
      );
    }
  } catch (outerError) {
    console.error('Failed to initialize default settings:', outerError);
  }
}

/**
 * Initialize default playlists if they don't exist
 */
function initDefaultPlaylists(): void {
  try {
    // Check if the playlists table exists
    try {
      const playlistCount = db
        .prepare('SELECT COUNT(*) as count FROM playlists')
        .get() as { count: number };

      if (playlistCount && playlistCount.count === 0) {
        // Default smart playlists
        const smartPlaylists: Omit<Playlist, 'id'>[] = [
          {
            name: '50 Recently Played Songs',
            isSmart: true,
            ruleSet: {
              type: 'recentlyPlayed',
              limit: 50,
            },
            trackIds: [], // Smart playlists should always have empty trackIds
          },
          {
            name: '50 Most Played Songs',
            isSmart: true,
            ruleSet: {
              type: 'mostPlayed',
              limit: 50,
            },
            trackIds: [], // Smart playlists should always have empty trackIds
          },
          {
            name: '50 Recently Added Songs',
            isSmart: true,
            ruleSet: {
              type: 'recentlyAdded',
              limit: 50,
            },
            trackIds: [], // Smart playlists should always have empty trackIds
          },
        ];

        // Insert default playlists
        const insertPlaylist = db.prepare(`
          INSERT INTO playlists (id, name, isSmart, ruleSet, trackIds)
          VALUES (?, ?, ?, ?, ?)
        `);

        smartPlaylists.forEach((playlist) => {
          insertPlaylist.run(
            uuidv4(),
            playlist.name,
            playlist.isSmart ? 1 : 0,
            playlist.ruleSet ? JSON.stringify(playlist.ruleSet) : null,
            JSON.stringify([]), // Explicitly use empty array for smart playlists
          );
        });
      }
    } catch (error) {
      console.error(
        'Error checking playlist count, table may not exist yet:',
        error,
      );
      // Ensure the table exists
      createTables();

      // Try again with the table created
      // Default smart playlists
      const smartPlaylists: Omit<Playlist, 'id'>[] = [
        {
          name: '50 Recently Played Songs',
          isSmart: true,
          ruleSet: {
            type: 'recentlyPlayed',
            limit: 50,
          },
          trackIds: [], // Smart playlists should always have empty trackIds
        },
        {
          name: '50 Most Played Songs',
          isSmart: true,
          ruleSet: {
            type: 'mostPlayed',
            limit: 50,
          },
          trackIds: [], // Smart playlists should always have empty trackIds
        },
        {
          name: '50 Recently Added Songs',
          isSmart: true,
          ruleSet: {
            type: 'recentlyAdded',
            limit: 50,
          },
          trackIds: [], // Smart playlists should always have empty trackIds
        },
      ];

      // Insert default playlists
      const insertPlaylist = db.prepare(`
        INSERT INTO playlists (id, name, isSmart, ruleSet, trackIds)
        VALUES (?, ?, ?, ?, ?)
      `);

      smartPlaylists.forEach((playlist) => {
        insertPlaylist.run(
          uuidv4(),
          playlist.name,
          playlist.isSmart ? 1 : 0,
          playlist.ruleSet ? JSON.stringify(playlist.ruleSet) : null,
          JSON.stringify([]), // Explicitly use empty array for smart playlists
        );
      });
    }
  } catch (outerError) {
    console.error('Failed to initialize default playlists:', outerError);
  }
}

/**
 * Initialize the database
 */
export function initDatabase(): void {
  console.log('Initializing database...');
  console.log('Database path:', DB_PATH);

  try {
    // Create the database directory if it doesn't exist
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('Created database directory:', dbDir);
    } else {
      console.log('Database directory exists:', dbDir);
    }

    // Check if database file exists
    if (fs.existsSync(DB_PATH)) {
      console.log('Database file exists:', DB_PATH);
      console.log('Database file size:', fs.statSync(DB_PATH).size, 'bytes');
    } else {
      console.log('Database file does not exist, will be created');
    }

    // Use sql.js
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
      const initSqlJs = require('sql.js');
      console.log('Successfully required sql.js');

      // Initialize sql.js
      initSqlJs()
        .then((SQL: any) => {
          console.log('Successfully initialized sql.js');
          // Check if database file exists
          let dbBuffer;
          if (fs.existsSync(DB_PATH)) {
            console.log('Loading existing database with sql.js');
            // Load existing database
            dbBuffer = fs.readFileSync(DB_PATH);
            db = new SQL.Database(dbBuffer);
            console.log('Successfully loaded existing database with sql.js');
          } else {
            console.log('Creating new database with sql.js');
            // Create new database
            db = new SQL.Database();
            console.log('Successfully created new database with sql.js');
          }

          // Create tables
          createTables();
          console.log('Tables created or verified');

          // Initialize default settings
          initDefaultSettings();
          console.log('Default settings initialized');

          // Initialize default playlists
          initDefaultPlaylists();
          console.log('Default playlists initialized');

          // Save the database to disk
          const sqlJsData = db.export();
          const sqlJsBuffer = Buffer.from(sqlJsData);
          fs.writeFileSync(DB_PATH, sqlJsBuffer);
          console.log('Database saved to disk');

          console.log('SQLite database loaded successfully using sql.js');

          // Create a custom implementation for sql.js
          const originalDb = db;
          console.log('Creating wrapper for sql.js');

          // Create a wrapper object with compatible methods
          db = {
            exec: (sql: string) => {
              try {
                const result = originalDb.exec(sql);
                // Save changes to disk
                const data = originalDb.export();
                const buffer = Buffer.from(data);
                fs.writeFileSync(DB_PATH, buffer);
                return result;
              } catch (error) {
                console.error('Error executing SQL:', error, 'SQL:', sql);
                throw error;
              }
            },

            prepare: (sql: string) => {
              return {
                get: (...params: any[]) => {
                  try {
                    // For get, we execute the query and return the first row
                    const stmt = originalDb.prepare(sql);

                    // Bind parameters
                    if (params.length > 0) {
                      stmt.bind(params);
                    }

                    // Step once to get the first row
                    if (stmt.step()) {
                      const result = stmt.getAsObject();
                      stmt.free();
                      return result;
                    }

                    stmt.free();
                    return undefined;
                  } catch (error) {
                    console.error(
                      'Error in get() method:',
                      error,
                      'SQL:',
                      sql,
                      'Params:',
                      params,
                    );
                    return undefined;
                  }
                },

                all: (...params: any[]) => {
                  try {
                    console.log(
                      'sql.js wrapper all() method called with SQL:',
                      sql,
                    );
                    // For all, we execute the query and return all rows
                    const stmt = originalDb.prepare(sql);

                    // Bind parameters
                    if (params.length > 0) {
                      stmt.bind(params);
                    }

                    const results = [];

                    // Step through all rows
                    while (stmt.step()) {
                      results.push(stmt.getAsObject());
                    }

                    stmt.free();
                    console.log(
                      `sql.js wrapper all() method returning ${results.length} results`,
                    );
                    return results;
                  } catch (error) {
                    console.error(
                      'Error in all() method:',
                      error,
                      'SQL:',
                      sql,
                      'Params:',
                      params,
                    );
                    return [];
                  }
                },

                run: (...params: any[]) => {
                  try {
                    // For run, we execute the query and return the number of changes
                    const stmt = originalDb.prepare(sql);

                    // Bind parameters
                    if (params.length > 0) {
                      stmt.bind(params);
                    }

                    // Execute the statement
                    stmt.step();
                    stmt.free();

                    // Save changes to disk
                    const data = originalDb.export();
                    const buffer = Buffer.from(data);
                    fs.writeFileSync(DB_PATH, buffer);

                    return { changes: 1 };
                  } catch (error) {
                    console.error(
                      'Error in run() method:',
                      error,
                      'SQL:',
                      sql,
                      'Params:',
                      params,
                    );
                    throw error;
                  }
                },
              };
            },

            pragma: (pragmaStatement: string) => {
              try {
                return originalDb.exec(`PRAGMA ${pragmaStatement}`);
              } catch (error) {
                console.error(
                  'Error executing PRAGMA:',
                  error,
                  'Statement:',
                  pragmaStatement,
                );
                return null;
              }
            },

            close: () => {
              try {
                originalDb.close();
              } catch (error) {
                console.error('Error closing database:', error);
              }
            },
          };

          useMockDb = false;
          console.log('Using sql.js implementation: useMockDb =', useMockDb);
          return true; // Return a value to satisfy the linter
        })
        .catch((sqlJsError: any) => {
          console.error(
            'Failed to load sql.js, using mock database:',
            sqlJsError,
          );
          db = mockDb;
          useMockDb = true;
          console.log('Using mock database: useMockDb =', useMockDb);
          return false; // Return a value to satisfy the linter
        });
    } catch (sqlJsError) {
      console.error('Failed to load sql.js, using mock database:', sqlJsError);
      db = mockDb;
      useMockDb = true;
      console.log('Using mock database (catch block): useMockDb =', useMockDb);
    }
  } catch (error) {
    console.error('Failed to initialize database:', error);
    // Use mock database as fallback
    db = mockDb;
    useMockDb = true;
    console.log(
      'Using mock database (outer catch block): useMockDb =',
      useMockDb,
    );
  }
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db && !useMockDb) {
    db.close();
  }
}

/**
 * Get all tracks from the database
 * @returns Array of tracks
 */
export function getAllTracks(): Track[] {
  try {
    console.log('Getting all tracks from database...');
    if (useMockDb) {
      console.log('Using mock database, returning empty array');
      return [];
    }
    const tracks = db.prepare('SELECT * FROM tracks').all() as Track[];
    console.log(`Retrieved ${tracks.length} tracks from database`);
    if (tracks.length > 0) {
      console.log(
        'First track:',
        JSON.stringify({
          id: tracks[0].id,
          filePath: tracks[0].filePath,
          title: tracks[0].title,
        }),
      );
    }
    return tracks.map((track) => ({
      ...track,
      playCount: Number(track.playCount),
      duration: Number(track.duration),
    }));
  } catch (error) {
    console.error('Failed to get tracks:', error);
    return [];
  }
}

/**
 * Get a track by ID
 * @param id - Track ID
 * @returns Track or null if not found
 */
export function getTrackById(id: string): Track | null {
  try {
    if (useMockDb) {
      return null;
    }
    const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id) as
      | Track
      | undefined;

    if (!track) {
      return null;
    }

    return {
      ...track,
      playCount: Number(track.playCount),
      duration: Number(track.duration),
    };
  } catch (error) {
    console.error(`Failed to get track with ID ${id}:`, error);
    return null;
  }
}

/**
 * Add a track to the database
 * @param track - Track to add
 * @returns Added track
 */
export function addTrack(track: Omit<Track, 'id'>): Track {
  try {
    console.log('Adding track to database:', JSON.stringify(track));

    // Validate required fields
    if (!track.filePath) {
      console.error('Track filePath is missing or empty:', track);
      throw new Error('Track filePath is required');
    }

    if (!track.title) {
      track.title = path.basename(track.filePath, path.extname(track.filePath));
    }

    if (!track.artist) {
      track.artist = 'Unknown Artist';
    }

    if (!track.album) {
      track.album = 'Unknown Album';
    }

    if (!track.albumArtist) {
      track.albumArtist = track.artist || 'Unknown Artist';
    }

    if (!track.genre) {
      track.genre = 'Unknown Genre';
    }

    if (track.duration === undefined || track.duration === null) {
      track.duration = 0;
    }

    if (track.playCount === undefined || track.playCount === null) {
      track.playCount = 0;
    }

    if (!track.dateAdded) {
      track.dateAdded = new Date().toISOString();
    }

    const id = uuidv4();
    const newTrack: Track = {
      id,
      ...track,
    };

    console.log(
      'Prepared track for insertion:',
      JSON.stringify({
        id: newTrack.id,
        filePath: newTrack.filePath,
        title: newTrack.title,
        // Log other fields as needed
      }),
    );

    const stmt = db.prepare(
      `
      INSERT INTO tracks (
        id, filePath, title, artist, album, albumArtist,
        genre, duration, playCount, dateAdded, lastPlayed, lyrics, trackNumber
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    );

    console.log('Executing SQL statement with parameters:', [
      newTrack.id,
      newTrack.filePath,
      newTrack.title,
      newTrack.artist,
      newTrack.album,
      newTrack.albumArtist,
      newTrack.genre,
      newTrack.duration,
      newTrack.playCount,
      newTrack.dateAdded,
      newTrack.lastPlayed,
      newTrack.lyrics,
      newTrack.trackNumber,
    ]);

    stmt.run(
      newTrack.id,
      newTrack.filePath,
      newTrack.title,
      newTrack.artist,
      newTrack.album,
      newTrack.albumArtist,
      newTrack.genre,
      newTrack.duration,
      newTrack.playCount,
      newTrack.dateAdded,
      newTrack.lastPlayed,
      newTrack.lyrics,
      newTrack.trackNumber,
    );

    console.log('Track added successfully:', newTrack.id);

    return newTrack;
  } catch (error) {
    console.error('Failed to add track:', error);
    throw error;
  }
}

/**
 * Update a track in the database
 * @param track - Track to update
 * @returns True if successful
 */
export function updateTrack(track: Track): boolean {
  try {
    const result = db
      .prepare(
        `
      UPDATE tracks
      SET
        title = ?,
        artist = ?,
        album = ?,
        albumArtist = ?,
        genre = ?,
        lyrics = ?,
        trackNumber = ?
      WHERE id = ?
    `,
      )
      .run(
        track.title,
        track.artist,
        track.album,
        track.albumArtist,
        track.genre,
        track.lyrics,
        track.trackNumber,
        track.id,
      );

    return result.changes > 0;
  } catch (error) {
    console.error(`Failed to update track with ID ${track.id}:`, error);
    throw error;
  }
}

/**
 * Update a track's play count
 * @param id - Track ID
 * @param date - Date played
 * @returns True if successful
 */
export function updatePlayCount(id: string, date: string): boolean {
  try {
    const result = db
      .prepare(
        `
      UPDATE tracks
      SET
        playCount = playCount + 1,
        lastPlayed = ?
      WHERE id = ?
    `,
      )
      .run(date, id);

    return result.changes > 0;
  } catch (error) {
    console.error(
      `Failed to update play count for track with ID ${id}:`,
      error,
    );
    throw error;
  }
}

/**
 * Delete a track from the database
 * @param id - Track ID
 * @returns True if successful
 */
export function deleteTrack(id: string): boolean {
  try {
    const result = db.prepare('DELETE FROM tracks WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    console.error(`Failed to delete track with ID ${id}:`, error);
    throw error;
  }
}

/**
 * Get all playlists from the database
 * @returns Array of playlists
 */
export function getAllPlaylists(): Playlist[] {
  try {
    if (useMockDb) {
      return [];
    }
    const playlists = db.prepare('SELECT * FROM playlists').all();

    return playlists.map((playlist: any) => {
      const parsedPlaylist = {
        ...playlist,
        isSmart: Boolean(playlist.isSmart),
        ruleSet: playlist.ruleSet
          ? JSON.parse(playlist.ruleSet as string)
          : null,
        trackIds: playlist.trackIds
          ? JSON.parse(playlist.trackIds as string)
          : [],
      };

      // For smart playlists, dynamically populate the trackIds
      if (parsedPlaylist.isSmart && parsedPlaylist.ruleSet) {
        try {
          // Get the tracks for this smart playlist based on its rule
          const smartTracks = getSmartPlaylistTracks(parsedPlaylist.ruleSet);
          // Update the trackIds with the IDs from the smart tracks
          parsedPlaylist.trackIds = smartTracks.map((track) => track.id);
        } catch (smartError) {
          console.error(
            `Failed to get smart playlist tracks for ${parsedPlaylist.name}:`,
            smartError,
          );
          // Keep the empty trackIds array in case of error
        }
      }

      return parsedPlaylist;
    });
  } catch (error) {
    console.error('Failed to get playlists:', error);
    return [];
  }
}

/**
 * Get a playlist by ID
 * @param id - Playlist ID
 * @returns Playlist or null if not found
 */
export function getPlaylistById(id: string): Playlist | null {
  try {
    const playlist = db
      .prepare('SELECT * FROM playlists WHERE id = ?')
      .get(id) as any | undefined;

    if (!playlist) {
      return null;
    }

    const parsedPlaylist = {
      id: playlist.id,
      name: playlist.name,
      isSmart: Boolean(playlist.isSmart),
      ruleSet: playlist.ruleSet
        ? (JSON.parse(playlist.ruleSet as string) as PlaylistRule)
        : null,
      trackIds: playlist.trackIds
        ? (JSON.parse(playlist.trackIds as string) as string[])
        : [],
    };

    // For smart playlists, dynamically populate the trackIds
    if (parsedPlaylist.isSmart && parsedPlaylist.ruleSet) {
      try {
        // Get the tracks for this smart playlist based on its rule
        const smartTracks = getSmartPlaylistTracks(parsedPlaylist.ruleSet);
        // Update the trackIds with the IDs from the smart tracks
        parsedPlaylist.trackIds = smartTracks.map((track) => track.id);
      } catch (smartError) {
        console.error(
          `Failed to get smart playlist tracks for ${parsedPlaylist.name}:`,
          smartError,
        );
        // Keep the empty trackIds array in case of error
      }
    }

    return parsedPlaylist;
  } catch (error) {
    console.error(`Failed to get playlist with ID ${id}:`, error);
    throw error;
  }
}

/**
 * Create a new playlist
 * @param playlist - Playlist to create
 * @returns Created playlist
 */
export function createPlaylist(playlist: Omit<Playlist, 'id'>): Playlist {
  try {
    const id = uuidv4();
    const newPlaylist: Playlist = {
      id,
      ...playlist,
    };

    // For smart playlists, we shouldn't store track IDs as they're dynamically generated
    const trackIdsToStore = newPlaylist.isSmart ? [] : newPlaylist.trackIds;

    db.prepare(
      `
      INSERT INTO playlists (id, name, isSmart, ruleSet, trackIds)
      VALUES (?, ?, ?, ?, ?)
    `,
    ).run(
      newPlaylist.id,
      newPlaylist.name,
      newPlaylist.isSmart ? 1 : 0,
      newPlaylist.ruleSet ? JSON.stringify(newPlaylist.ruleSet) : null,
      JSON.stringify(trackIdsToStore),
    );

    return newPlaylist;
  } catch (error) {
    console.error('Failed to create playlist:', error);
    throw error;
  }
}

/**
 * Update a playlist
 * @param playlist - Playlist to update
 * @returns True if successful
 */
export function updatePlaylist(playlist: Playlist): boolean {
  try {
    // For smart playlists, we shouldn't store track IDs as they're dynamically generated
    const trackIdsToStore = playlist.isSmart ? [] : playlist.trackIds;

    const result = db
      .prepare(
        `
      UPDATE playlists
      SET
        name = ?,
        isSmart = ?,
        ruleSet = ?,
        trackIds = ?
      WHERE id = ?
    `,
      )
      .run(
        playlist.name,
        playlist.isSmart ? 1 : 0,
        playlist.ruleSet ? JSON.stringify(playlist.ruleSet) : null,
        JSON.stringify(trackIdsToStore),
        playlist.id,
      );

    return result.changes > 0;
  } catch (error) {
    console.error(`Failed to update playlist with ID ${playlist.id}:`, error);
    throw error;
  }
}

/**
 * Delete a playlist
 * @param id - Playlist ID
 * @returns True if successful
 */
export function deletePlaylist(id: string): boolean {
  try {
    const result = db.prepare('DELETE FROM playlists WHERE id = ?').run(id);
    return result.changes > 0;
  } catch (error) {
    console.error(`Failed to delete playlist with ID ${id}:`, error);
    throw error;
  }
}

/**
 * Get the application settings
 * @returns Settings object
 */
export function getSettings(): Settings {
  try {
    if (useMockDb) {
      // Return default settings
      return {
        id: 'app-settings',
        libraryPath: '',
        theme: 'dark',
        columns: {
          title: true,
          artist: true,
          album: true,
          albumArtist: true,
          genre: true,
          duration: true,
          playCount: true,
          dateAdded: true,
          lastPlayed: true,
        },
      };
    }

    const settings = db
      .prepare('SELECT * FROM settings WHERE id = ?')
      .get('app-settings') as Settings | undefined;

    if (!settings) {
      console.log('Settings not found, initializing default settings');
      // Initialize default settings
      initDefaultSettings();

      // Try to get settings again
      const newSettings = db
        .prepare('SELECT * FROM settings WHERE id = ?')
        .get('app-settings') as Settings | undefined;

      if (!newSettings) {
        throw new Error('Failed to initialize settings');
      }

      return {
        ...newSettings,
        columns:
          typeof newSettings.columns === 'string'
            ? JSON.parse(newSettings.columns)
            : newSettings.columns,
      };
    }

    return {
      ...settings,
      columns:
        typeof settings.columns === 'string'
          ? JSON.parse(settings.columns)
          : settings.columns,
    };
  } catch (error) {
    console.error('Failed to get settings:', error);

    // Return default settings on error
    return {
      id: 'app-settings',
      libraryPath: '',
      theme: 'dark',
      columns: {
        title: true,
        artist: true,
        album: true,
        albumArtist: true,
        genre: true,
        duration: true,
        playCount: true,
        dateAdded: true,
        lastPlayed: true,
      },
    };
  }
}

/**
 * Update the application settings
 * @param settings - Settings to update
 * @returns True if successful
 */
export function updateSettings(settings: Settings): boolean {
  try {
    const result = db
      .prepare(
        `
      UPDATE settings
      SET
        libraryPath = ?,
        theme = ?,
        columns = ?
      WHERE id = ?
    `,
      )
      .run(
        settings.libraryPath,
        settings.theme,
        JSON.stringify(settings.columns),
        settings.id,
      );

    return result.changes > 0;
  } catch (error) {
    console.error('Failed to update settings:', error);
    throw error;
  }
}

/**
 * Backup the database to a file
 * @param backupPath - Path to save the backup to
 * @returns Promise that resolves to true if successful
 */
export async function backupDatabase(backupPath: string): Promise<boolean> {
  try {
    // Ensure the backup directory exists
    const backupDir = path.dirname(backupPath);
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    // Create a backup
    await db.backup(backupPath);
    console.log(`Database backed up to ${backupPath}`);
    return true;
  } catch (error) {
    console.error(`Failed to backup database to ${backupPath}:`, error);
    throw error;
  }
}

/**
 * Restore the database from a backup file
 * @param restorePath - Path to the backup file
 * @returns True if successful
 */
export function restoreDatabase(restorePath: string): boolean {
  try {
    // Close the current database connection
    closeDatabase();

    // Copy the backup file to the database file
    fs.copyFileSync(restorePath, DB_PATH);

    // Reopen the database
    initDatabase();

    return true;
  } catch (error) {
    console.error(`Failed to restore database from ${restorePath}:`, error);
    throw error;
  }
}

/**
 * Get tracks for a smart playlist
 * @param rule - Playlist rule
 * @returns Array of tracks
 */
export function getSmartPlaylistTracks(rule: PlaylistRule): Track[] {
  try {
    // Return empty array for mock database
    if (useMockDb) {
      return [];
    }

    let query = '';

    switch (rule.type) {
      case 'recentlyPlayed':
        query = `
          SELECT * FROM tracks
          WHERE lastPlayed IS NOT NULL
          ORDER BY lastPlayed DESC
          LIMIT ?
        `;
        break;
      case 'mostPlayed':
        query = `
          SELECT * FROM tracks
          WHERE playCount > 0
          ORDER BY playCount DESC
          LIMIT ?
        `;
        break;
      case 'recentlyAdded':
        query = `
          SELECT * FROM tracks
          ORDER BY dateAdded DESC
          LIMIT ?
        `;
        break;
      default:
        throw new Error(`Unknown smart playlist type: ${rule.type}`);
    }

    const tracks = db.prepare(query).all(rule.limit) as Track[];

    return tracks.map((track) => ({
      ...track,
      playCount: Number(track.playCount),
      duration: Number(track.duration),
    }));
  } catch (error) {
    console.error(
      `Failed to get tracks for smart playlist with rule ${JSON.stringify(rule)}:`,
      error,
    );
    throw error;
  }
}

/**
 * Reset the database by deleting it and reinitializing
 * @returns Promise<boolean> indicating success
 */
export function resetDatabase(): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      console.log('Resetting database...');

      // Close the database connection
      closeDatabase();

      // Delete the database file
      if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
        console.log('Database file deleted');
      }

      // Start database initialization
      initDatabase();

      // Set a flag to initialize settings and playlists after database is ready
      let attempts = 0;
      const maxAttempts = 50; // 5 seconds max wait time

      const checkDbReady = setInterval(() => {
        attempts++;

        // Check if db is defined and not the mock db
        if (db && !useMockDb) {
          try {
            // Try a simple query to verify the database is working
            const testQuery = db.prepare('SELECT 1 as test').get();

            if (testQuery && testQuery.test === 1) {
              clearInterval(checkDbReady);

              try {
                // Create tables explicitly to ensure they exist
                createTables();

                // Initialize default settings
                initDefaultSettings();

                // Initialize default playlists
                initDefaultPlaylists();

                console.log('Database reset complete');
                resolve(true);
                return;
              } catch (initError) {
                console.error(
                  'Error during database initialization:',
                  initError,
                );
                resolve(false);
                return;
              }
            }
          } catch (queryError) {
            console.log('Database not ready yet, waiting...');
          }
        }

        // Check if we've exceeded the maximum number of attempts
        if (attempts >= maxAttempts) {
          clearInterval(checkDbReady);
          console.error(
            'Database initialization timed out after multiple attempts',
          );
          resolve(false);
        }
      }, 100);
    } catch (error) {
      console.error('Error resetting database:', error);
      resolve(false);
    }
  });
}
