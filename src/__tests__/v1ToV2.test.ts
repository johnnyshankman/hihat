/**
 * @jest-environment node
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { LegacyStoreStructure } from '../types/legacyTypes';

// Each test gets its own tmp userData dir, set via this mutable holder so the
// electron mock below can read it after jest.mock has hoisted.
const fakeAppState = { userDataDir: '' };

jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((key: string) => {
      if (key === 'userData') return fakeAppState.userDataDir;
      throw new Error(`unexpected getPath key: ${key}`);
    }),
    getName: jest.fn(() => 'hihat'),
  },
}));

// eslint-disable-next-line import/first
import {
  migrateV1ToV2,
  needsMigration,
  unmarkMigration,
} from '../main/migration/v1ToV2';

const writeLegacyConfig = (config: LegacyStoreStructure): string => {
  const configPath = path.join(fakeAppState.userDataDir, 'userConfig.json');
  fs.writeFileSync(configPath, JSON.stringify(config));
  return configPath;
};

const baseLegacyConfig = (): LegacyStoreStructure => ({
  library: {
    '/songs/a.mp3': {
      common: {
        title: 'Song A',
        artist: 'Artist A',
        album: 'Album A',
        albumartist: 'Album Artist A',
        track: { no: 1, of: 10 },
        disk: { no: 1, of: 2 },
        picture: null,
      },
      format: { duration: 180.5 },
      additionalInfo: {
        playCount: 5,
        // 2025-01-15T00:00:00Z in milliseconds
        lastPlayed: 1736899200000,
        // 2024-06-01T00:00:00Z in milliseconds
        dateAdded: 1717200000000,
      },
    },
    '/songs/b.mp3': {
      common: {
        // No title — should fall back to filename
        artist: 'Artist B',
        // No album
        // No albumartist — should fall back to artist
        picture: null,
      },
      format: {},
      additionalInfo: {
        playCount: 0,
        lastPlayed: 0,
        dateAdded: 0,
      },
    },
  },
  playlists: [
    {
      name: 'Mix Tape',
      songs: ['/songs/b.mp3', '/songs/a.mp3', '/songs/missing.mp3'],
    },
  ],
  lastPlayedSong: '/songs/a.mp3',
  libraryPath: '/Users/me/Music',
  initialized: true,
});

describe('v1ToV2 migration', () => {
  let prevNodeEnv: string | undefined;
  let warnSpy: jest.SpyInstance;
  let errSpy: jest.SpyInstance;

  beforeEach(() => {
    prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    fakeAppState.userDataDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'v1tov2-test-'),
    );
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env.NODE_ENV = prevNodeEnv;
    fs.rmSync(fakeAppState.userDataDir, { recursive: true, force: true });
    warnSpy.mockRestore();
    errSpy.mockRestore();
  });

  describe('needsMigration', () => {
    test('returns false when no legacy config file exists', () => {
      expect(needsMigration()).toBe(false);
    });

    test('returns true when legacy config exists and has not been migrated', () => {
      writeLegacyConfig(baseLegacyConfig());
      expect(needsMigration()).toBe(true);
    });

    test('returns false when a .migrated marker exists', () => {
      writeLegacyConfig(baseLegacyConfig());
      // Drop a marker file alongside
      fs.writeFileSync(
        path.join(fakeAppState.userDataDir, 'userConfig.json.migrated'),
        '',
      );
      expect(needsMigration()).toBe(false);
    });
  });

  describe('migrateV1ToV2', () => {
    test('returns null and skips work when no migration is needed', async () => {
      expect(await migrateV1ToV2()).toBeNull();
    });

    test('produces tracks with new UUIDs and ISO date strings', async () => {
      writeLegacyConfig(baseLegacyConfig());

      const result = await migrateV1ToV2();
      expect(result).not.toBeNull();

      const songA = result!.tracks.find((t) => t.filePath === '/songs/a.mp3');
      expect(songA).toBeDefined();

      // ID is a freshly-generated UUID, not the file path
      expect(songA!.id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );

      // Timestamps converted from epoch ms to ISO
      expect(songA!.dateAdded).toBe(new Date(1717200000000).toISOString());
      expect(songA!.lastPlayed).toBe(new Date(1736899200000).toISOString());
    });

    test('lastPlayed of 0 maps to null (never played)', async () => {
      writeLegacyConfig(baseLegacyConfig());
      const result = await migrateV1ToV2();
      const songB = result!.tracks.find((t) => t.filePath === '/songs/b.mp3');
      expect(songB!.lastPlayed).toBeNull();
    });

    test('falls back to filename when title is missing', async () => {
      writeLegacyConfig(baseLegacyConfig());
      const result = await migrateV1ToV2();
      const songB = result!.tracks.find((t) => t.filePath === '/songs/b.mp3');
      expect(songB!.title).toBe('b.mp3');
    });

    test('falls back to "Unknown Artist"/"Unknown Album" when missing', async () => {
      const config = baseLegacyConfig();
      // Strip artist/album for song b
      delete config.library['/songs/b.mp3'].common.artist;
      delete config.library['/songs/b.mp3'].common.album;
      writeLegacyConfig(config);

      const result = await migrateV1ToV2();
      const songB = result!.tracks.find((t) => t.filePath === '/songs/b.mp3');
      expect(songB!.artist).toBe('Unknown Artist');
      expect(songB!.album).toBe('Unknown Album');
      expect(songB!.albumArtist).toBe('Unknown Artist');
    });

    test('albumArtist falls back to artist when albumartist is missing', async () => {
      writeLegacyConfig(baseLegacyConfig());
      const result = await migrateV1ToV2();
      const songB = result!.tracks.find((t) => t.filePath === '/songs/b.mp3');
      expect(songB!.albumArtist).toBe('Artist B');
    });

    test('preserves track/disk numbers', async () => {
      writeLegacyConfig(baseLegacyConfig());
      const result = await migrateV1ToV2();
      const songA = result!.tracks.find((t) => t.filePath === '/songs/a.mp3');
      expect(songA!.trackNumber).toBe(1);
      expect(songA!.totalTracks).toBe(10);
      expect(songA!.discNumber).toBe(1);
      expect(songA!.totalDiscs).toBe(2);
    });

    test('sets v1-untracked fields to null/empty', async () => {
      writeLegacyConfig(baseLegacyConfig());
      const result = await migrateV1ToV2();
      const songA = result!.tracks.find((t) => t.filePath === '/songs/a.mp3');
      expect(songA!.genre).toBe('');
      expect(songA!.lyrics).toBeNull();
      expect(songA!.year).toBeNull();
      expect(songA!.bpm).toBeNull();
      expect(songA!.composer).toBeNull();
      expect(songA!.comment).toBeNull();
    });

    test('maps playlist songs to track IDs and drops unknown paths', async () => {
      writeLegacyConfig(baseLegacyConfig());
      const result = await migrateV1ToV2();

      expect(result!.playlists).toHaveLength(1);
      const mix = result!.playlists[0];
      expect(mix.name).toBe('Mix Tape');
      expect(mix.isSmart).toBe(false);
      expect(mix.smartPlaylistId).toBeNull();
      expect(mix.ruleSet).toBeNull();

      // 3 source paths -> 2 mapped IDs (the missing one is filtered out)
      expect(mix.trackIds).toHaveLength(2);

      const trackById = new Map(result!.tracks.map((t) => [t.id, t]));
      expect(trackById.get(mix.trackIds[0])?.filePath).toBe('/songs/b.mp3');
      expect(trackById.get(mix.trackIds[1])?.filePath).toBe('/songs/a.mp3');
    });

    test('resolves lastPlayedSongId from a file path', async () => {
      writeLegacyConfig(baseLegacyConfig());
      const result = await migrateV1ToV2();

      const songA = result!.tracks.find((t) => t.filePath === '/songs/a.mp3');
      expect(result!.lastPlayedSongId).toBe(songA!.id);
    });

    test('returns null lastPlayedSongId when the path is unknown', async () => {
      const config = baseLegacyConfig();
      config.lastPlayedSong = '/songs/nope.mp3';
      writeLegacyConfig(config);

      const result = await migrateV1ToV2();
      expect(result!.lastPlayedSongId).toBeNull();
    });

    test('preserves the libraryPath verbatim', async () => {
      writeLegacyConfig(baseLegacyConfig());
      const result = await migrateV1ToV2();
      expect(result!.libraryPath).toBe('/Users/me/Music');
    });

    test('marks the legacy config as migrated by renaming the file', async () => {
      const configPath = writeLegacyConfig(baseLegacyConfig());
      await migrateV1ToV2();

      expect(fs.existsSync(configPath)).toBe(false);
      expect(fs.existsSync(`${configPath}.migrated`)).toBe(true);
      expect(needsMigration()).toBe(false);
    });

    test('reports progress via the optional callback', async () => {
      writeLegacyConfig(baseLegacyConfig());
      const phases: string[] = [];

      await migrateV1ToV2((p) => phases.push(p.phase));

      expect(phases).toEqual([
        'starting',
        'reading',
        'converting',
        'importing',
      ]);
    });

    test('returns null when the legacy file is missing required fields', async () => {
      const configPath = path.join(fakeAppState.userDataDir, 'userConfig.json');
      fs.writeFileSync(configPath, JSON.stringify({ initialized: true })); // no library/libraryPath

      const result = await migrateV1ToV2();
      expect(result).toBeNull();
    });

    test('returns null when the legacy file is unparseable', async () => {
      const configPath = path.join(fakeAppState.userDataDir, 'userConfig.json');
      fs.writeFileSync(configPath, 'not json {');

      const result = await migrateV1ToV2();
      expect(result).toBeNull();
    });

    test('generates unique IDs for every migrated track', async () => {
      writeLegacyConfig(baseLegacyConfig());
      const result = await migrateV1ToV2();
      const ids = result!.tracks.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('unmarkMigration', () => {
    test('renames the .migrated marker back to userConfig.json', async () => {
      const configPath = writeLegacyConfig(baseLegacyConfig());
      await migrateV1ToV2();
      expect(fs.existsSync(`${configPath}.migrated`)).toBe(true);

      unmarkMigration();

      expect(fs.existsSync(configPath)).toBe(true);
      expect(fs.existsSync(`${configPath}.migrated`)).toBe(false);
      expect(needsMigration()).toBe(true);
    });

    test('is a no-op when no .migrated marker exists', () => {
      // Should not throw or create any files
      expect(() => unmarkMigration()).not.toThrow();
      expect(
        fs.existsSync(path.join(fakeAppState.userDataDir, 'userConfig.json')),
      ).toBe(false);
    });
  });
});
