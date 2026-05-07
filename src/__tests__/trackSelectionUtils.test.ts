/**
 * @jest-environment jsdom
 */

import {
  computeCanGoNext,
  findNextSong,
  findPreviousSong,
  getFilePathFromTrackUrl,
  getFilteredAndSortedTrackIds,
  getTrackUrl,
  type CanGoInputs,
} from '../renderer/utils/trackSelectionUtils';
import useLibraryStore from '../renderer/stores/libraryStore';
import { queryClient } from '../renderer/queries/client';
import { queryKeys } from '../renderer/queries/keys';
import { buildIndexes } from '../renderer/utils/trackIndexes';
import { Track, Playlist } from '../types/dbTypes';

// Tracks and playlists are TanStack Query server state — seed via
// queryClient.setQueryData. View-state slices (sorting, filtering,
// selectedPlaylistId) live in libraryStore; snapshot the initial
// store state and restore it after each test so per-test setState
// calls don't leak across tests.
const initialLibraryState = useLibraryStore.getState();

afterEach(() => {
  useLibraryStore.setState(initialLibraryState, true);
  queryClient.removeQueries({ queryKey: queryKeys.tracks });
  queryClient.removeQueries({ queryKey: queryKeys.playlists });
});

const makeTrack = (overrides: Partial<Track>): Track => ({
  id: overrides.id ?? 'x',
  filePath: overrides.filePath ?? `/songs/${overrides.id ?? 'x'}.mp3`,
  title: overrides.title ?? overrides.id ?? 'x',
  artist: overrides.artist ?? '',
  album: overrides.album ?? '',
  albumArtist: overrides.albumArtist ?? '',
  genre: overrides.genre ?? '',
  duration: overrides.duration ?? 0,
  playCount: overrides.playCount ?? 0,
  dateAdded: overrides.dateAdded ?? '2025-01-01T00:00:00.000Z',
  lastPlayed: overrides.lastPlayed ?? null,
  lyrics: null,
  trackNumber: overrides.trackNumber ?? null,
  totalTracks: null,
  discNumber: null,
  totalDiscs: null,
  year: null,
  bpm: null,
  composer: null,
  comment: null,
});

/**
 * Seeds the library store with test data using `setState` (the Zustand-
 * recommended way to drive a real store from tests). The afterEach hook
 * above restores the snapshot, so per-test seeds don't need to touch every
 * slice — only the ones the test actually depends on.
 *
 * Title-sort default matches the test data shape (tracks identified by
 * letter titles); override `libraryViewState` / `playlistViewState` for
 * tests that exercise filtering or playlist selection.
 */
const seedLibrary = (overrides: {
  tracks?: Track[];
  playlists?: Playlist[];
  libraryViewState?: { sorting: any; filtering: string };
  playlistViewState?: {
    sorting: any;
    filtering: string;
    playlistId: string | null;
  };
}) => {
  // Tracks and playlists are TanStack Query server state, so seed the
  // cache directly — that's what trackSelectionUtils reads via
  // getTracksSnapshot / getPlaylistsSnapshot at call time.
  const tracks = overrides.tracks ?? [];
  queryClient.setQueryData(queryKeys.tracks, {
    tracks,
    indexes: buildIndexes(tracks),
  });
  queryClient.setQueryData(queryKeys.playlists, overrides.playlists ?? []);

  // View-state (filter / sort / selected playlist) lives in Zustand.
  useLibraryStore.setState({
    libraryViewState: overrides.libraryViewState ?? {
      sorting: [{ id: 'title', desc: false }],
      filtering: '',
    },
    playlistViewState: overrides.playlistViewState ?? {
      sorting: [{ id: 'title', desc: false }],
      filtering: '',
      playlistId: null,
    },
  });
};

describe('getTrackUrl / getFilePathFromTrackUrl', () => {
  test('round-trips a simple path', () => {
    const path = '/Users/me/song.mp3';
    expect(getFilePathFromTrackUrl(getTrackUrl(path))).toBe(path);
  });

  test('round-trips paths with spaces, ampersands, and unicode', () => {
    const path = '/Music/AC&DC/Björk – song (live).flac';
    const url = getTrackUrl(path);
    expect(url).toContain('hihat-audio://getfile/');
    expect(getFilePathFromTrackUrl(url)).toBe(path);
  });

  test('encodes the path component', () => {
    const url = getTrackUrl('/a b/c.mp3');
    expect(url).toBe(
      `hihat-audio://getfile/${encodeURIComponent('/a b/c.mp3')}`,
    );
  });
});

describe('getFilteredAndSortedTrackIds — library source', () => {
  test('returns all track IDs in sorted order', () => {
    seedLibrary({
      tracks: [
        makeTrack({ id: '2', title: 'Banana' }),
        makeTrack({ id: '1', title: 'Apple' }),
        makeTrack({ id: '3', title: 'Cherry' }),
      ],
    });
    expect(getFilteredAndSortedTrackIds('library')).toEqual(['1', '2', '3']);
  });

  test('applies the artistFilter argument before sorting', () => {
    seedLibrary({
      tracks: [
        makeTrack({ id: '1', title: 'A', albumArtist: 'X' }),
        makeTrack({ id: '2', title: 'B', albumArtist: 'Y' }),
        makeTrack({ id: '3', title: 'C', albumArtist: 'X' }),
      ],
    });
    expect(getFilteredAndSortedTrackIds('library', 'X')).toEqual(['1', '3']);
  });

  test('artist filter falls back to artist field when albumArtist is missing', () => {
    seedLibrary({
      tracks: [
        makeTrack({ id: '1', artist: 'A', albumArtist: '' }),
        makeTrack({ id: '2', artist: 'B', albumArtist: '' }),
      ],
    });
    expect(getFilteredAndSortedTrackIds('library', 'A')).toEqual(['1']);
  });

  test('applies the albumFilter argument', () => {
    seedLibrary({
      tracks: [
        makeTrack({ id: '1', album: 'Alpha' }),
        makeTrack({ id: '2', album: 'Beta' }),
      ],
    });
    expect(getFilteredAndSortedTrackIds('library', null, 'Alpha')).toEqual([
      '1',
    ]);
  });

  test('applies the global filtering string from libraryViewState', () => {
    seedLibrary({
      tracks: [
        makeTrack({ id: '1', title: 'apple pie' }),
        makeTrack({ id: '2', title: 'banana bread', artist: 'apple band' }),
        makeTrack({ id: '3', title: 'cherry tart' }),
      ],
      libraryViewState: {
        sorting: [{ id: 'title', desc: false }],
        filtering: 'apple',
      },
    });
    // Both ids 1 (title match) and 2 (artist match) should be included
    expect(getFilteredAndSortedTrackIds('library')).toEqual(['1', '2']);
  });
});

describe('getFilteredAndSortedTrackIds — playlist source', () => {
  test('returns playlist tracks in declared order, sorted by view state', () => {
    const playlist: Playlist = {
      id: 'pl1',
      name: 'My List',
      isSmart: false,
      smartPlaylistId: null,
      ruleSet: null,
      trackIds: ['3', '1', '2'],
      sortPreference: null,
    };
    seedLibrary({
      tracks: [
        makeTrack({ id: '1', title: 'Apple' }),
        makeTrack({ id: '2', title: 'Banana' }),
        makeTrack({ id: '3', title: 'Cherry' }),
      ],
      playlists: [playlist],
      playlistViewState: {
        sorting: [{ id: 'title', desc: false }],
        filtering: '',
        playlistId: 'pl1',
      },
    });
    expect(getFilteredAndSortedTrackIds('playlist')).toEqual(['1', '2', '3']);
  });

  test('throws when the selected playlist is missing', () => {
    seedLibrary({
      playlists: [],
      playlistViewState: {
        sorting: [{ id: 'title', desc: false }],
        filtering: '',
        playlistId: 'does-not-exist',
      },
    });
    expect(() => getFilteredAndSortedTrackIds('playlist')).toThrow(
      'Playlist not found',
    );
  });
});

describe('findNextSong (non-shuffle)', () => {
  beforeEach(() => {
    seedLibrary({
      tracks: [
        makeTrack({ id: '1', title: 'A' }),
        makeTrack({ id: '2', title: 'B' }),
        makeTrack({ id: '3', title: 'C' }),
      ],
    });
  });

  test('returns the next track in sorted order', () => {
    const next = findNextSong('1', false, 'library', 'off');
    expect(next?.id).toBe('2');
  });

  test('returns undefined at end of list with repeat off', () => {
    const next = findNextSong('3', false, 'library', 'off');
    expect(next).toBeUndefined();
  });

  test('wraps to the first track at end of list with repeat all', () => {
    const next = findNextSong('3', false, 'library', 'all');
    expect(next?.id).toBe('1');
  });

  test('returns undefined when given an empty currentTrackId', () => {
    expect(findNextSong('', false, 'library', 'off')).toBeUndefined();
  });
});

describe('findNextSong (shuffle)', () => {
  beforeEach(() => {
    seedLibrary({
      tracks: [
        makeTrack({ id: '1' }),
        makeTrack({ id: '2' }),
        makeTrack({ id: '3' }),
      ],
    });
  });

  test('picks an unplayed track when history exists', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    // history = [track 2], current = 1, available = [3]
    const next = findNextSong(
      '1',
      true,
      'library',
      'off',
      null,
      [makeTrack({ id: '2' })],
      null,
    );
    expect(next?.id).toBe('3');
    randomSpy.mockRestore();
  });

  test('returns undefined when all tracks have been played and repeat is off', () => {
    const next = findNextSong(
      '1',
      true,
      'library',
      'off',
      null,
      [makeTrack({ id: '2' }), makeTrack({ id: '3' })],
      null,
    );
    expect(next).toBeUndefined();
  });

  test('starts over from full pool when all played and repeat is all', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const next = findNextSong(
      '1',
      true,
      'library',
      'all',
      null,
      [makeTrack({ id: '2' }), makeTrack({ id: '3' })],
      null,
    );
    expect(next).toBeDefined();
    expect(['1', '2', '3']).toContain(next!.id);
    randomSpy.mockRestore();
  });
});

describe('findPreviousSong', () => {
  beforeEach(() => {
    seedLibrary({
      tracks: [
        makeTrack({ id: '1', title: 'A' }),
        makeTrack({ id: '2', title: 'B' }),
        makeTrack({ id: '3', title: 'C' }),
      ],
    });
  });

  test('returns the previous track in sorted order', () => {
    expect(findPreviousSong('2', false, 'library', 'off')?.id).toBe('1');
  });

  test('returns undefined at start of list with repeat off', () => {
    expect(findPreviousSong('1', false, 'library', 'off')).toBeUndefined();
  });

  test('wraps to last track at start of list with repeat all', () => {
    expect(findPreviousSong('1', false, 'library', 'all')?.id).toBe('3');
  });

  test('shuffle mode with history returns the most recent history entry', () => {
    const history = [makeTrack({ id: '2' }), makeTrack({ id: '3' })];
    expect(findPreviousSong('1', true, 'library', 'off', history)?.id).toBe(
      '3',
    );
  });

  test('shuffle mode with empty history falls through to sequential prev', () => {
    expect(findPreviousSong('2', true, 'library', 'off', [])?.id).toBe('1');
  });
});

describe('computeCanGoNext', () => {
  const baseTrack = makeTrack({ id: '1', title: 'A' });

  beforeEach(() => {
    seedLibrary({
      tracks: [baseTrack, makeTrack({ id: '2', title: 'B' })],
    });
  });

  const baseInputs = (overrides: Partial<CanGoInputs> = {}): CanGoInputs => ({
    currentTrack: baseTrack,
    position: 0,
    repeatMode: 'off',
    shuffleMode: false,
    shuffleHistory: [],
    shuffleHistoryPosition: -1,
    playbackSource: 'library',
    playbackContextBrowserFilter: null as any,
    ...overrides,
  });

  test('returns false when there is no current track', () => {
    expect(computeCanGoNext(baseInputs({ currentTrack: null as any }))).toBe(
      false,
    );
  });

  test('returns true unconditionally when repeatMode is "track"', () => {
    // No next track in library, but repeat-track means Next restarts current
    seedLibrary({ tracks: [baseTrack] });
    expect(
      computeCanGoNext(
        baseInputs({ currentTrack: baseTrack, repeatMode: 'track' }),
      ),
    ).toBe(true);
  });

  test('returns true unconditionally when repeatMode is "all"', () => {
    seedLibrary({ tracks: [baseTrack] });
    expect(
      computeCanGoNext(
        baseInputs({ currentTrack: baseTrack, repeatMode: 'all' }),
      ),
    ).toBe(true);
  });

  test('returns true in shuffle mode when there is a forward history entry', () => {
    expect(
      computeCanGoNext(
        baseInputs({
          shuffleMode: true,
          shuffleHistory: [makeTrack({ id: '2' }), makeTrack({ id: '3' })],
          shuffleHistoryPosition: 0,
        }),
      ),
    ).toBe(true);
  });

  test('falls back to findNextSong when not at a forward history entry', () => {
    // currentTrack is id '1' with id '2' available next — not at end
    expect(computeCanGoNext(baseInputs())).toBe(true);
  });

  test('returns false when at end of library with no repeat and no shuffle history', () => {
    // currentTrack is the last track in sorted order
    const lastTrack = makeTrack({ id: '2', title: 'B' });
    expect(computeCanGoNext(baseInputs({ currentTrack: lastTrack }))).toBe(
      false,
    );
  });
});
