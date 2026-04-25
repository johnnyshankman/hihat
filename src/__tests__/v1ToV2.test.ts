/**
 * @jest-environment node
 */

// Mock all external dependencies — these tests cover OUR logic:
// the legacy-to-Track transform, the file-path-to-trackId playlist mapping,
// orchestration order, and error handling. They do NOT cover whether fs
// reads/writes actually work or whether the OS allows path operations.
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/fake/userdata'),
    getName: jest.fn(() => 'hihat'),
  },
}));

jest.mock('fs');

/* eslint-disable import/first -- jest.mock calls are hoisted above imports
   at runtime; placing the imports below keeps the source readable. */
import fs from 'fs';
import {
  migrateV1ToV2,
  needsMigration,
  unmarkMigration,
} from '../main/migration/v1ToV2';
import { LegacyStoreStructure } from '../types/legacyTypes';
/* eslint-enable import/first */

const existsSyncMock = fs.existsSync as jest.MockedFunction<
  typeof fs.existsSync
>;
const readFileSyncMock = fs.readFileSync as jest.MockedFunction<
  typeof fs.readFileSync
>;
const renameSyncMock = fs.renameSync as jest.MockedFunction<
  typeof fs.renameSync
>;

const CONFIG_PATH = '/fake/userdata/userConfig.json';
const MIGRATED_PATH = '/fake/userdata/userConfig.json.migrated';

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
        // 2025-01-15T00:00:00Z
        lastPlayed: 1736899200000,
        // 2024-06-01T00:00:00Z
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

/**
 * Configure existsSync to report "config exists, marker does not" — the
 * needsMigration() shape that migrateV1ToV2 depends on for happy-path tests.
 */
const configExists = () => {
  existsSyncMock.mockImplementation((p) => p === CONFIG_PATH);
};

const stubReadFile = (config: unknown) => {
  readFileSyncMock.mockReturnValue(JSON.stringify(config));
};

let warnSpy: jest.SpyInstance;
let errSpy: jest.SpyInstance;

beforeEach(() => {
  existsSyncMock.mockReset();
  readFileSyncMock.mockReset();
  renameSyncMock.mockReset();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
  errSpy.mockRestore();
});

describe('needsMigration', () => {
  test('returns false when no legacy config file exists', () => {
    existsSyncMock.mockReturnValue(false);
    expect(needsMigration()).toBe(false);
    expect(existsSyncMock).toHaveBeenCalledWith(CONFIG_PATH);
  });

  test('returns true when legacy config exists and no marker is present', () => {
    existsSyncMock.mockImplementation((p) => p === CONFIG_PATH);
    expect(needsMigration()).toBe(true);
  });

  test('returns false when the .migrated marker exists', () => {
    existsSyncMock.mockReturnValue(true); // both paths exist
    expect(needsMigration()).toBe(false);
  });
});

describe('migrateV1ToV2 — short-circuits', () => {
  test('returns null when needsMigration() reports no work to do', async () => {
    existsSyncMock.mockReturnValue(false);

    const result = await migrateV1ToV2();

    expect(result).toBeNull();
    expect(readFileSyncMock).not.toHaveBeenCalled();
    expect(renameSyncMock).not.toHaveBeenCalled();
  });

  test('returns null when legacy JSON is missing required fields', async () => {
    configExists();
    stubReadFile({ initialized: true }); // no library / libraryPath

    expect(await migrateV1ToV2()).toBeNull();
    expect(renameSyncMock).not.toHaveBeenCalled();
  });

  test('returns null when legacy JSON cannot be parsed', async () => {
    configExists();
    readFileSyncMock.mockReturnValue('not valid json {');

    expect(await migrateV1ToV2()).toBeNull();
    expect(renameSyncMock).not.toHaveBeenCalled();
  });

  test('returns null when readFileSync itself throws', async () => {
    configExists();
    readFileSyncMock.mockImplementation(() => {
      throw new Error('EACCES');
    });

    expect(await migrateV1ToV2()).toBeNull();
    expect(renameSyncMock).not.toHaveBeenCalled();
  });
});

describe('migrateV1ToV2 — track conversion', () => {
  beforeEach(() => {
    configExists();
    stubReadFile(baseLegacyConfig());
  });

  test('produces tracks with new UUIDs (not file paths)', async () => {
    const result = await migrateV1ToV2();
    const songA = result!.tracks.find((t) => t.filePath === '/songs/a.mp3');

    expect(songA!.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  test('every track gets a unique id', async () => {
    const result = await migrateV1ToV2();
    const ids = result!.tracks.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('converts ms timestamps to ISO strings', async () => {
    const result = await migrateV1ToV2();
    const songA = result!.tracks.find((t) => t.filePath === '/songs/a.mp3');

    expect(songA!.dateAdded).toBe(new Date(1717200000000).toISOString());
    expect(songA!.lastPlayed).toBe(new Date(1736899200000).toISOString());
  });

  test('lastPlayed of 0 maps to null (never played)', async () => {
    const result = await migrateV1ToV2();
    const songB = result!.tracks.find((t) => t.filePath === '/songs/b.mp3');
    expect(songB!.lastPlayed).toBeNull();
  });

  test('falls back to filename when title is missing', async () => {
    const result = await migrateV1ToV2();
    const songB = result!.tracks.find((t) => t.filePath === '/songs/b.mp3');
    expect(songB!.title).toBe('b.mp3');
  });

  test('falls back to "Unknown Artist"/"Unknown Album" when missing', async () => {
    const config = baseLegacyConfig();
    delete config.library['/songs/b.mp3'].common.artist;
    delete config.library['/songs/b.mp3'].common.album;
    stubReadFile(config);

    const result = await migrateV1ToV2();
    const songB = result!.tracks.find((t) => t.filePath === '/songs/b.mp3');

    expect(songB!.artist).toBe('Unknown Artist');
    expect(songB!.album).toBe('Unknown Album');
    expect(songB!.albumArtist).toBe('Unknown Artist');
  });

  test('albumArtist falls back to artist when albumartist is missing', async () => {
    const result = await migrateV1ToV2();
    const songB = result!.tracks.find((t) => t.filePath === '/songs/b.mp3');
    expect(songB!.albumArtist).toBe('Artist B');
  });

  test('preserves track and disc numbers verbatim', async () => {
    const result = await migrateV1ToV2();
    const songA = result!.tracks.find((t) => t.filePath === '/songs/a.mp3');

    expect(songA!.trackNumber).toBe(1);
    expect(songA!.totalTracks).toBe(10);
    expect(songA!.discNumber).toBe(1);
    expect(songA!.totalDiscs).toBe(2);
  });

  test('zeroes out v1-untracked fields (genre/year/bpm/composer/comment/lyrics)', async () => {
    const result = await migrateV1ToV2();
    const songA = result!.tracks.find((t) => t.filePath === '/songs/a.mp3');

    expect(songA!.genre).toBe('');
    expect(songA!.lyrics).toBeNull();
    expect(songA!.year).toBeNull();
    expect(songA!.bpm).toBeNull();
    expect(songA!.composer).toBeNull();
    expect(songA!.comment).toBeNull();
  });
});

describe('migrateV1ToV2 — playlist conversion', () => {
  beforeEach(() => {
    configExists();
  });

  test('maps playlist file paths to the new track IDs', async () => {
    stubReadFile(baseLegacyConfig());
    const result = await migrateV1ToV2();

    const trackByPath = new Map(result!.tracks.map((t) => [t.filePath, t.id]));
    const mix = result!.playlists[0];

    expect(mix.trackIds).toEqual([
      trackByPath.get('/songs/b.mp3'),
      trackByPath.get('/songs/a.mp3'),
    ]);
  });

  test('drops playlist entries whose file paths are not in the library', async () => {
    stubReadFile(baseLegacyConfig());
    const result = await migrateV1ToV2();

    expect(result!.playlists[0].trackIds).toHaveLength(2);
  });

  test('marks the playlist as a regular (non-smart) playlist', async () => {
    stubReadFile(baseLegacyConfig());
    const result = await migrateV1ToV2();
    const mix = result!.playlists[0];

    expect(mix.isSmart).toBe(false);
    expect(mix.smartPlaylistId).toBeNull();
    expect(mix.ruleSet).toBeNull();
  });

  test('preserves the playlist name verbatim', async () => {
    stubReadFile(baseLegacyConfig());
    const result = await migrateV1ToV2();
    expect(result!.playlists[0].name).toBe('Mix Tape');
  });
});

describe('migrateV1ToV2 — top-level fields & side effects', () => {
  beforeEach(() => {
    configExists();
  });

  test('resolves lastPlayedSongId from the legacy file path', async () => {
    stubReadFile(baseLegacyConfig());
    const result = await migrateV1ToV2();

    const songA = result!.tracks.find((t) => t.filePath === '/songs/a.mp3');
    expect(result!.lastPlayedSongId).toBe(songA!.id);
  });

  test('returns null lastPlayedSongId when the legacy path is unknown', async () => {
    const config = baseLegacyConfig();
    config.lastPlayedSong = '/songs/nope.mp3';
    stubReadFile(config);

    const result = await migrateV1ToV2();
    expect(result!.lastPlayedSongId).toBeNull();
  });

  test('passes the legacy libraryPath through unchanged', async () => {
    stubReadFile(baseLegacyConfig());
    const result = await migrateV1ToV2();
    expect(result!.libraryPath).toBe('/Users/me/Music');
  });

  test('marks the legacy file as migrated by renaming it', async () => {
    stubReadFile(baseLegacyConfig());
    await migrateV1ToV2();

    expect(renameSyncMock).toHaveBeenCalledTimes(1);
    expect(renameSyncMock).toHaveBeenCalledWith(CONFIG_PATH, MIGRATED_PATH);
  });

  test('reports progress through the callback in the documented order', async () => {
    stubReadFile(baseLegacyConfig());
    const phases: string[] = [];

    await migrateV1ToV2((p) => phases.push(p.phase));

    expect(phases).toEqual(['starting', 'reading', 'converting', 'importing']);
  });

  test('runs without a progress callback', async () => {
    stubReadFile(baseLegacyConfig());
    await expect(migrateV1ToV2()).resolves.not.toBeNull();
  });
});

describe('unmarkMigration', () => {
  test('renames the .migrated marker back to userConfig.json when it exists', () => {
    existsSyncMock.mockImplementation((p) => p === MIGRATED_PATH);

    unmarkMigration();

    expect(renameSyncMock).toHaveBeenCalledWith(MIGRATED_PATH, CONFIG_PATH);
  });

  test('does nothing when no .migrated marker exists', () => {
    existsSyncMock.mockReturnValue(false);

    unmarkMigration();

    expect(renameSyncMock).not.toHaveBeenCalled();
  });

  test('swallows rename failures (logs but does not throw)', () => {
    existsSyncMock.mockImplementation((p) => p === MIGRATED_PATH);
    renameSyncMock.mockImplementation(() => {
      throw new Error('EBUSY');
    });

    expect(() => unmarkMigration()).not.toThrow();
  });
});
