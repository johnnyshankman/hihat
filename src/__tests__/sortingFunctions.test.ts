/**
 * @jest-environment node
 */

import {
  getSortingFunction,
  sortByAlbum,
  sortByAlbumArtist,
  sortByArtist,
  sortByArtistSmart,
  sortByDateAdded,
  sortByDuration,
  sortByGenre,
  sortByLastPlayed,
  sortByPlayCount,
  sortByTitle,
} from '../renderer/utils/sortingFunctions';

type TrackLike = {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  duration?: number;
  playCount?: number;
  dateAdded?: string;
  lastPlayed?: string | null;
  albumArtist?: string;
  trackNumber?: number | null;
};

const t = (overrides: Partial<TrackLike> = {}): TrackLike => ({
  id: 'x',
  ...overrides,
});

const sign = (n: number): -1 | 0 | 1 => {
  if (n < 0) return -1;
  if (n > 0) return 1;
  return 0;
};

describe('sortByArtist', () => {
  test('orders by artist ascending', () => {
    const a = t({ artist: 'Beatles' });
    const b = t({ artist: 'Zappa' });
    expect(sign(sortByArtist(a, b, false))).toBe(-1);
    expect(sign(sortByArtist(b, a, false))).toBe(1);
  });

  test('descending flips the sign', () => {
    const a = t({ artist: 'Beatles' });
    const b = t({ artist: 'Zappa' });
    expect(sign(sortByArtist(a, b, true))).toBe(1);
    expect(sign(sortByArtist(b, a, true))).toBe(-1);
  });

  test('strips leading "The " when comparing', () => {
    // "The Beatles" should sort as "beatles", before "Cure"
    const beatles = t({ artist: 'The Beatles' });
    const cure = t({ artist: 'Cure' });
    expect(sign(sortByArtist(beatles, cure, false))).toBe(-1);
  });

  test('case-insensitive comparison', () => {
    const lower = t({ artist: 'beatles' });
    const upper = t({ artist: 'BEATLES' });
    expect(sortByArtist(lower, upper, false)).toBe(0);
  });

  test('ties on artist break by album then trackNumber', () => {
    const a = t({ artist: 'Same', album: 'A', trackNumber: 1 });
    const b = t({ artist: 'Same', album: 'B', trackNumber: 1 });
    expect(sign(sortByArtist(a, b, false))).toBe(-1);

    const c = t({ artist: 'Same', album: 'A', trackNumber: 1 });
    const d = t({ artist: 'Same', album: 'A', trackNumber: 2 });
    expect(sign(sortByArtist(c, d, false))).toBe(-1);
  });

  test('null trackNumber sorts before non-null in ascending', () => {
    const nullTrack = t({ artist: 'Same', album: 'A', trackNumber: null });
    const numbered = t({ artist: 'Same', album: 'A', trackNumber: 5 });
    expect(sign(sortByArtist(nullTrack, numbered, false))).toBe(-1);
    expect(sign(sortByArtist(numbered, nullTrack, false))).toBe(1);
  });

  test('null trackNumber sort flips with descending', () => {
    const nullTrack = t({ artist: 'Same', album: 'A', trackNumber: null });
    const numbered = t({ artist: 'Same', album: 'A', trackNumber: 5 });
    expect(sign(sortByArtist(nullTrack, numbered, true))).toBe(1);
  });

  test('missing artist treated as empty string', () => {
    const noArtist = t({});
    const someArtist = t({ artist: 'Aardvark' });
    expect(sign(sortByArtist(noArtist, someArtist, false))).toBe(-1);
  });

  test('fully equal returns 0', () => {
    const a = t({ artist: 'Same', album: 'A', trackNumber: 1 });
    const b = t({ artist: 'Same', album: 'A', trackNumber: 1 });
    expect(sortByArtist(a, b, false)).toBe(0);
  });
});

describe('sortByAlbumArtist', () => {
  test('uses albumArtist field, not artist', () => {
    const a = t({ artist: 'Z', albumArtist: 'Aardvark' });
    const b = t({ artist: 'A', albumArtist: 'Zebra' });
    expect(sign(sortByAlbumArtist(a, b, false))).toBe(-1);
  });

  test('strips leading "The " from albumArtist', () => {
    const beatles = t({ albumArtist: 'The Beatles' });
    const cure = t({ albumArtist: 'Cure' });
    expect(sign(sortByAlbumArtist(beatles, cure, false))).toBe(-1);
  });

  test('ties break by album then trackNumber', () => {
    const a = t({ albumArtist: 'X', album: 'A', trackNumber: 2 });
    const b = t({ albumArtist: 'X', album: 'A', trackNumber: 5 });
    expect(sign(sortByAlbumArtist(a, b, false))).toBe(-1);
  });
});

describe('sortByArtistSmart', () => {
  test('orders by albumArtist when both fields populated and differ', () => {
    // Toggle-on path: featured-artist track stays grouped with the album.
    const featured = t({
      artist: 'Kendrick Lamar feat. SZA',
      albumArtist: 'Kendrick Lamar',
      album: 'Mr. Morale',
      trackNumber: 1,
    });
    const sameAlbum = t({
      artist: 'Kendrick Lamar',
      albumArtist: 'Kendrick Lamar',
      album: 'Mr. Morale',
      trackNumber: 2,
    });
    const otherAlbumArtist = t({
      artist: 'Frank Ocean',
      albumArtist: 'Frank Ocean',
      album: 'Blonde',
      trackNumber: 1,
    });

    // 'frank ocean' < 'kendrick lamar', so Frank sorts first.
    expect(sign(sortByArtistSmart(otherAlbumArtist, featured, false))).toBe(-1);
    // Within Kendrick group, track 1 (featured) precedes track 2.
    expect(sign(sortByArtistSmart(featured, sameAlbum, false))).toBe(-1);
  });

  test('falls back to raw artist when albumArtist is empty', () => {
    // No albumArtist on either track — should sort by raw artist tag.
    const a = t({ artist: 'Aardvark' });
    const b = t({ artist: 'Zebra' });
    expect(sign(sortByArtistSmart(a, b, false))).toBe(-1);
    expect(sign(sortByArtistSmart(b, a, false))).toBe(1);
  });

  test('one track missing albumArtist falls back to artist for that one', () => {
    // First key resolves to 'beatles' for both via fallback / direct.
    const fallback = t({ artist: 'Beatles', album: 'X', trackNumber: 1 });
    const direct = t({ albumArtist: 'Beatles', album: 'X', trackNumber: 2 });
    expect(sign(sortByArtistSmart(fallback, direct, false))).toBe(-1);
  });

  test('strips leading "The " from primary key', () => {
    const beatles = t({ albumArtist: 'The Beatles' });
    const cure = t({ artist: 'Cure' });
    expect(sign(sortByArtistSmart(beatles, cure, false))).toBe(-1);
  });

  test('descending flips the sign', () => {
    const a = t({ albumArtist: 'A' });
    const b = t({ albumArtist: 'Z' });
    expect(sign(sortByArtistSmart(a, b, true))).toBe(1);
    expect(sign(sortByArtistSmart(b, a, true))).toBe(-1);
  });

  test('ties on primary key break by album then trackNumber', () => {
    const a = t({ albumArtist: 'Same', album: 'A', trackNumber: 2 });
    const b = t({ albumArtist: 'Same', album: 'A', trackNumber: 5 });
    expect(sign(sortByArtistSmart(a, b, false))).toBe(-1);

    const c = t({ albumArtist: 'Same', album: 'A', trackNumber: 1 });
    const d = t({ albumArtist: 'Same', album: 'B', trackNumber: 1 });
    expect(sign(sortByArtistSmart(c, d, false))).toBe(-1);
  });

  test('toggle-off path matches sortByArtist behavior bit-for-bit', () => {
    // Acceptance criterion (c): toggle off => behavior identical to
    // pre-feature sortByArtist. Verified at the dispatch level via
    // getSortingFunction; here we just confirm same outputs across the
    // mixed dataset that exposes the divergence vs sortByArtistSmart.
    const tracks: TrackLike[] = [
      t({
        artist: 'Kendrick Lamar feat. SZA',
        albumArtist: 'Kendrick Lamar',
        album: 'Mr. Morale',
        trackNumber: 1,
      }),
      t({
        artist: 'Kendrick Lamar',
        albumArtist: 'Kendrick Lamar',
        album: 'Mr. Morale',
        trackNumber: 2,
      }),
      t({
        artist: 'Frank Ocean',
        albumArtist: 'Frank Ocean',
        album: 'Blonde',
        trackNumber: 1,
      }),
    ];

    const offFn = getSortingFunction('artist', {
      sortArtistByAlbumArtist: false,
    });
    const offCases: Array<[number, number]> = [
      [0, 1],
      [0, 2],
      [1, 2],
    ];
    offCases.forEach(([i, j]) => {
      expect(sign(offFn(tracks[i], tracks[j], false))).toBe(
        sign(sortByArtist(tracks[i], tracks[j], false)),
      );
    });
  });
});

describe('sortByAlbum', () => {
  test('orders by album', () => {
    const a = t({ album: 'A' });
    const b = t({ album: 'B' });
    expect(sign(sortByAlbum(a, b, false))).toBe(-1);
  });

  test('ties break by trackNumber', () => {
    const a = t({ album: 'X', trackNumber: 1 });
    const b = t({ album: 'X', trackNumber: 7 });
    expect(sign(sortByAlbum(a, b, false))).toBe(-1);
  });
});

describe('sortByTitle', () => {
  test('orders by title case-insensitively', () => {
    const a = t({ title: 'apple' });
    const b = t({ title: 'BANANA' });
    expect(sign(sortByTitle(a, b, false))).toBe(-1);
  });

  test('missing title treated as empty', () => {
    const a = t({});
    const b = t({ title: 'something' });
    expect(sign(sortByTitle(a, b, false))).toBe(-1);
  });
});

describe('sortByGenre', () => {
  test('orders by genre case-insensitively', () => {
    const a = t({ genre: 'Ambient' });
    const b = t({ genre: 'rock' });
    expect(sign(sortByGenre(a, b, false))).toBe(-1);
  });
});

describe('sortByDuration', () => {
  test('orders by duration ascending', () => {
    const a = t({ duration: 60 });
    const b = t({ duration: 180 });
    expect(sign(sortByDuration(a, b, false))).toBe(-1);
  });

  test('missing duration treated as 0', () => {
    const a = t({});
    const b = t({ duration: 30 });
    expect(sign(sortByDuration(a, b, false))).toBe(-1);
  });
});

describe('sortByPlayCount', () => {
  test('orders by playCount', () => {
    const a = t({ playCount: 1 });
    const b = t({ playCount: 99 });
    expect(sign(sortByPlayCount(a, b, false))).toBe(-1);
    expect(sign(sortByPlayCount(a, b, true))).toBe(1);
  });

  test('missing playCount treated as 0', () => {
    const a = t({});
    const b = t({ playCount: 5 });
    expect(sign(sortByPlayCount(a, b, false))).toBe(-1);
  });
});

describe('sortByDateAdded', () => {
  test('orders by date string parsed as Date', () => {
    const older = t({ dateAdded: '2024-01-01T00:00:00.000Z' });
    const newer = t({ dateAdded: '2026-01-01T00:00:00.000Z' });
    expect(sign(sortByDateAdded(older, newer, false))).toBe(-1);
  });

  test('missing dateAdded treated as epoch (sorts first ascending)', () => {
    const undef = t({});
    const dated = t({ dateAdded: '2025-01-01T00:00:00.000Z' });
    expect(sign(sortByDateAdded(undef, dated, false))).toBe(-1);
  });
});

describe('sortByLastPlayed', () => {
  test('orders by lastPlayed', () => {
    const older = t({ lastPlayed: '2024-01-01T00:00:00.000Z' });
    const newer = t({ lastPlayed: '2026-01-01T00:00:00.000Z' });
    expect(sign(sortByLastPlayed(older, newer, false))).toBe(-1);
  });

  test('null lastPlayed treated as epoch', () => {
    const nullPlayed = t({ lastPlayed: null });
    const played = t({ lastPlayed: '2025-01-01T00:00:00.000Z' });
    expect(sign(sortByLastPlayed(nullPlayed, played, false))).toBe(-1);
  });
});

describe('getSortingFunction', () => {
  test.each([
    ['artist', sortByArtist],
    ['albumArtist', sortByAlbumArtist],
    ['album', sortByAlbum],
    ['title', sortByTitle],
    ['genre', sortByGenre],
    ['duration', sortByDuration],
    ['playCount', sortByPlayCount],
    ['dateAdded', sortByDateAdded],
    ['lastPlayed', sortByLastPlayed],
  ])('routes "%s" to the matching comparator', (field, expected) => {
    expect(getSortingFunction(field)).toBe(expected);
  });

  test('unknown field falls back to sortByTitle', () => {
    expect(getSortingFunction('nonexistent')).toBe(sortByTitle);
  });

  test('"artist" with sortArtistByAlbumArtist:true returns sortByArtistSmart', () => {
    expect(
      getSortingFunction('artist', { sortArtistByAlbumArtist: true }),
    ).toBe(sortByArtistSmart);
  });

  test('"artist" with sortArtistByAlbumArtist:false returns sortByArtist', () => {
    expect(
      getSortingFunction('artist', { sortArtistByAlbumArtist: false }),
    ).toBe(sortByArtist);
  });

  test('"artist" with no opts returns sortByArtist (raw-artist default)', () => {
    expect(getSortingFunction('artist')).toBe(sortByArtist);
  });

  test('opts only affects the artist field, not albumArtist', () => {
    expect(
      getSortingFunction('albumArtist', { sortArtistByAlbumArtist: true }),
    ).toBe(sortByAlbumArtist);
    expect(
      getSortingFunction('albumArtist', { sortArtistByAlbumArtist: false }),
    ).toBe(sortByAlbumArtist);
  });
});
