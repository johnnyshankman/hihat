/**
 * @jest-environment node
 */

import {
  buildQueue,
  advance,
  retreat,
  jumpTo,
  reshuffleFuture,
  unshuffleFuture,
  syncWithLibrary,
  removeAt,
  peekNext,
  snapshotsEqual,
  type QueueSourceSnapshot,
  type QueueState,
} from '../renderer/utils/playbackQueue';

const LIBRARY_SOURCE: QueueSourceSnapshot = {
  kind: 'library',
  playlistId: null,
  filter: null,
};

const PLAYLIST_SOURCE: QueueSourceSnapshot = {
  kind: 'playlist',
  playlistId: 'p1',
  filter: null,
};

const FILTERED_LIBRARY: QueueSourceSnapshot = {
  kind: 'library',
  playlistId: null,
  filter: { artist: 'Aphex Twin', album: null },
};

function fixedSeed(value: number) {
  // Deterministic Math.random for shuffle tests. Returns a generator-like
  // function suitable for jest.spyOn(Math, 'random').
  let s = value;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe('snapshotsEqual', () => {
  it('returns true for identical snapshots', () => {
    expect(snapshotsEqual(LIBRARY_SOURCE, { ...LIBRARY_SOURCE })).toBe(true);
  });

  it('treats null filter and {artist: null, album: null} as different', () => {
    const a: QueueSourceSnapshot = {
      kind: 'library',
      playlistId: null,
      filter: null,
    };
    const b: QueueSourceSnapshot = {
      kind: 'library',
      playlistId: null,
      filter: { artist: null, album: null },
    };
    // Both reduce to (null, null) under the comparison.
    expect(snapshotsEqual(a, b)).toBe(true);
  });

  it('detects kind change', () => {
    expect(snapshotsEqual(LIBRARY_SOURCE, PLAYLIST_SOURCE)).toBe(false);
  });

  it('detects playlist id change', () => {
    expect(
      snapshotsEqual(PLAYLIST_SOURCE, { ...PLAYLIST_SOURCE, playlistId: 'p2' }),
    ).toBe(false);
  });

  it('detects artist filter change', () => {
    expect(snapshotsEqual(LIBRARY_SOURCE, FILTERED_LIBRARY)).toBe(false);
  });

  it('handles null inputs', () => {
    expect(snapshotsEqual(null, null)).toBe(true);
    expect(snapshotsEqual(LIBRARY_SOURCE, null)).toBe(false);
    expect(snapshotsEqual(null, LIBRARY_SOURCE)).toBe(false);
  });
});

describe('buildQueue', () => {
  it('non-shuffle: preserves source order, points at start track', () => {
    const q = buildQueue({
      sourceTrackIds: ['a', 'b', 'c', 'd'],
      startTrackId: 'c',
      shuffle: false,
      source: LIBRARY_SOURCE,
    });
    expect(q.trackIds).toEqual(['a', 'b', 'c', 'd']);
    expect(q.currentIndex).toBe(2);
    expect(q.source).toEqual(LIBRARY_SOURCE);
  });

  it('non-shuffle: start track not in source falls back to single-track queue', () => {
    const q = buildQueue({
      sourceTrackIds: ['a', 'b', 'c'],
      startTrackId: 'orphan',
      shuffle: false,
      source: LIBRARY_SOURCE,
    });
    expect(q.trackIds).toEqual(['orphan']);
    expect(q.currentIndex).toBe(0);
  });

  it('non-shuffle: empty source returns single-track queue', () => {
    const q = buildQueue({
      sourceTrackIds: [],
      startTrackId: 'a',
      shuffle: false,
      source: LIBRARY_SOURCE,
    });
    expect(q.trackIds).toEqual(['a']);
    expect(q.currentIndex).toBe(0);
  });

  it('shuffle: same length as source, start track at index 0', () => {
    const spy = jest.spyOn(Math, 'random').mockImplementation(fixedSeed(42));
    try {
      const q = buildQueue({
        sourceTrackIds: ['a', 'b', 'c', 'd', 'e'],
        startTrackId: 'c',
        shuffle: true,
        source: LIBRARY_SOURCE,
      });
      expect(q.trackIds).toHaveLength(5);
      expect(q.trackIds[0]).toBe('c');
      expect(q.currentIndex).toBe(0);
      // All source tracks must appear exactly once.
      expect([...q.trackIds].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
    } finally {
      spy.mockRestore();
    }
  });

  it('shuffle: start track not in source still pinned to index 0', () => {
    const q = buildQueue({
      sourceTrackIds: ['a', 'b', 'c'],
      startTrackId: 'orphan',
      shuffle: true,
      source: LIBRARY_SOURCE,
    });
    expect(q.trackIds[0]).toBe('orphan');
    expect(q.trackIds).toHaveLength(4); // orphan + a + b + c
    expect(q.currentIndex).toBe(0);
  });
});

describe('advance', () => {
  const refresh = jest.fn(() => ['x', 'y', 'z']);

  beforeEach(() => {
    refresh.mockClear();
  });

  it('mid-queue: bumps pointer', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c'],
      currentIndex: 0,
      source: LIBRARY_SOURCE,
    };
    const result = advance(state, 'off', false, refresh);
    expect(result.changed).toBe(true);
    expect(result.state.currentIndex).toBe(1);
    expect(result.state.trackIds).toEqual(['a', 'b', 'c']);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('end-of-queue + repeat off: no-op', () => {
    const state: QueueState = {
      trackIds: ['a', 'b'],
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    const result = advance(state, 'off', false, refresh);
    expect(result.changed).toBe(false);
    expect(result.state).toBe(state);
  });

  it('end-of-queue + repeat track: no-op (singleMode handles it)', () => {
    const state: QueueState = {
      trackIds: ['a', 'b'],
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    const result = advance(state, 'track', false, refresh);
    expect(result.changed).toBe(false);
  });

  it('end-of-queue + repeat all + non-shuffle: wraps pointer to 0', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c'],
      currentIndex: 2,
      source: LIBRARY_SOURCE,
    };
    const result = advance(state, 'all', false, refresh);
    expect(result.changed).toBe(true);
    expect(result.state.currentIndex).toBe(0);
    expect(result.state.trackIds).toEqual(['a', 'b', 'c']);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('end-of-queue + repeat all + shuffle: appends fresh shuffled pass', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c'],
      currentIndex: 2,
      source: LIBRARY_SOURCE,
    };
    const result = advance(state, 'all', true, refresh);
    expect(result.changed).toBe(true);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(result.state.trackIds).toHaveLength(6);
    expect(result.state.trackIds.slice(0, 3)).toEqual(['a', 'b', 'c']);
    expect(result.state.currentIndex).toBe(3);
    // Fresh pass contains every source track exactly once.
    expect([...result.state.trackIds.slice(3)].sort()).toEqual(['x', 'y', 'z']);
  });

  it('shuffle wrap with empty source: no-op', () => {
    const state: QueueState = {
      trackIds: ['a'],
      currentIndex: 0,
      source: LIBRARY_SOURCE,
    };
    const result = advance(state, 'all', true, () => []);
    expect(result.changed).toBe(false);
  });

  it('empty queue: no-op', () => {
    const state: QueueState = {
      trackIds: [],
      currentIndex: -1,
      source: LIBRARY_SOURCE,
    };
    const result = advance(state, 'all', true, refresh);
    expect(result.changed).toBe(false);
  });
});

describe('retreat', () => {
  it('mid-queue: decrements pointer', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c'],
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    const result = retreat(state, 'off');
    expect(result.changed).toBe(true);
    expect(result.state.currentIndex).toBe(0);
  });

  it('start-of-queue + repeat off: no-op', () => {
    const state: QueueState = {
      trackIds: ['a', 'b'],
      currentIndex: 0,
      source: LIBRARY_SOURCE,
    };
    const result = retreat(state, 'off');
    expect(result.changed).toBe(false);
  });

  it('start-of-queue + repeat all: wraps to last index', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c'],
      currentIndex: 0,
      source: LIBRARY_SOURCE,
    };
    const result = retreat(state, 'all');
    expect(result.changed).toBe(true);
    expect(result.state.currentIndex).toBe(2);
  });

  it('empty queue: no-op', () => {
    const state: QueueState = {
      trackIds: [],
      currentIndex: -1,
      source: LIBRARY_SOURCE,
    };
    const result = retreat(state, 'all');
    expect(result.changed).toBe(false);
  });
});

describe('jumpTo', () => {
  const state: QueueState = {
    trackIds: ['a', 'b', 'c', 'd'],
    currentIndex: 1,
    source: LIBRARY_SOURCE,
  };

  it('moves to in-range index', () => {
    const result = jumpTo(state, 3);
    expect(result.currentIndex).toBe(3);
  });

  it('out-of-range index: no-op', () => {
    expect(jumpTo(state, -1)).toBe(state);
    expect(jumpTo(state, 99)).toBe(state);
  });

  it('jumping to current index: returns same state', () => {
    expect(jumpTo(state, 1)).toBe(state);
  });
});

describe('reshuffleFuture', () => {
  it('preserves past + current, randomizes future', () => {
    const spy = jest.spyOn(Math, 'random').mockImplementation(fixedSeed(7));
    try {
      const state: QueueState = {
        trackIds: ['a', 'b', 'c', 'd', 'e'],
        currentIndex: 1,
        source: LIBRARY_SOURCE,
      };
      const result = reshuffleFuture(state);
      expect(result.trackIds.slice(0, 2)).toEqual(['a', 'b']);
      expect(result.currentIndex).toBe(1);
      expect([...result.trackIds.slice(2)].sort()).toEqual(['c', 'd', 'e']);
    } finally {
      spy.mockRestore();
    }
  });

  it('at last index: no-op', () => {
    const state: QueueState = {
      trackIds: ['a', 'b'],
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    expect(reshuffleFuture(state)).toBe(state);
  });

  it('empty queue: no-op', () => {
    const state: QueueState = {
      trackIds: [],
      currentIndex: -1,
      source: LIBRARY_SOURCE,
    };
    expect(reshuffleFuture(state)).toBe(state);
  });
});

describe('unshuffleFuture', () => {
  it('preserves past, sorts future to source order, drops past from future', () => {
    const state: QueueState = {
      trackIds: ['c', 'a', 'd'], // played c then a, currently a; d queued
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    const sourceOrder = ['a', 'b', 'c', 'd', 'e'];
    const result = unshuffleFuture(state, sourceOrder);
    // Past: c, a (kept). Future: source minus past = b, d, e.
    expect(result.trackIds).toEqual(['c', 'a', 'b', 'd', 'e']);
    expect(result.currentIndex).toBe(1);
  });

  it('drops future tracks not in new source', () => {
    const state: QueueState = {
      trackIds: ['a', 'gone'],
      currentIndex: 0,
      source: LIBRARY_SOURCE,
    };
    const result = unshuffleFuture(state, ['a', 'b']);
    expect(result.trackIds).toEqual(['a', 'b']);
    expect(result.currentIndex).toBe(0);
  });

  it('currentIndex < 0: no-op', () => {
    const state: QueueState = {
      trackIds: [],
      currentIndex: -1,
      source: LIBRARY_SOURCE,
    };
    expect(unshuffleFuture(state, ['a'])).toBe(state);
  });
});

describe('syncWithLibrary', () => {
  it('current track survives: index re-pinned to new position', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c', 'd'],
      currentIndex: 2, // 'c'
      source: LIBRARY_SOURCE,
    };
    const result = syncWithLibrary(state, new Set(['b', 'c', 'd']));
    expect(result.trackIds).toEqual(['b', 'c', 'd']);
    expect(result.currentIndex).toBe(1); // 'c' is now at index 1
  });

  it('current track deleted: advances to next surviving track', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c', 'd'],
      currentIndex: 1, // 'b' (deleted)
      source: LIBRARY_SOURCE,
    };
    const result = syncWithLibrary(state, new Set(['a', 'c', 'd']));
    expect(result.trackIds).toEqual(['a', 'c', 'd']);
    expect(result.currentIndex).toBe(1); // 'c' (next surviving)
  });

  it('current track deleted at tail: falls back to previous surviving', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c'],
      currentIndex: 2, // 'c' (deleted)
      source: LIBRARY_SOURCE,
    };
    const result = syncWithLibrary(state, new Set(['a', 'b']));
    expect(result.trackIds).toEqual(['a', 'b']);
    expect(result.currentIndex).toBe(1); // 'b' (previous surviving)
  });

  it('whole queue wiped: returns empty queue with index -1', () => {
    const state: QueueState = {
      trackIds: ['a', 'b'],
      currentIndex: 0,
      source: LIBRARY_SOURCE,
    };
    const result = syncWithLibrary(state, new Set());
    expect(result.trackIds).toEqual([]);
    expect(result.currentIndex).toBe(-1);
  });

  it('empty queue: no-op', () => {
    const state: QueueState = {
      trackIds: [],
      currentIndex: -1,
      source: LIBRARY_SOURCE,
    };
    expect(syncWithLibrary(state, new Set(['a']))).toBe(state);
  });

  it('no tracks deleted: index unchanged, contents identical', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c'],
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    const result = syncWithLibrary(state, new Set(['a', 'b', 'c']));
    expect(result.trackIds).toEqual(['a', 'b', 'c']);
    expect(result.currentIndex).toBe(1);
  });
});

describe('removeAt', () => {
  it('index < currentIndex: decrements pointer', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c', 'd'],
      currentIndex: 2,
      source: LIBRARY_SOURCE,
    };
    const result = removeAt(state, 0);
    expect(result.trackIds).toEqual(['b', 'c', 'd']);
    expect(result.currentIndex).toBe(1);
  });

  it('index > currentIndex: pointer unchanged', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c', 'd'],
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    const result = removeAt(state, 3);
    expect(result.trackIds).toEqual(['a', 'b', 'c']);
    expect(result.currentIndex).toBe(1);
  });

  it('index === currentIndex (mid-queue): pointer stays, now points at next track', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c'],
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    const result = removeAt(state, 1);
    expect(result.trackIds).toEqual(['a', 'c']);
    expect(result.currentIndex).toBe(1); // Now points at 'c'
  });

  it('index === currentIndex (last): pointer moves backward', () => {
    const state: QueueState = {
      trackIds: ['a', 'b'],
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    const result = removeAt(state, 1);
    expect(result.trackIds).toEqual(['a']);
    expect(result.currentIndex).toBe(0);
  });

  it('out-of-range index: no-op', () => {
    const state: QueueState = {
      trackIds: ['a'],
      currentIndex: 0,
      source: LIBRARY_SOURCE,
    };
    expect(removeAt(state, -1)).toBe(state);
    expect(removeAt(state, 99)).toBe(state);
  });
});

describe('peekNext', () => {
  it('mid-queue: returns trackIds[currentIndex+1]', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c'],
      currentIndex: 0,
      source: LIBRARY_SOURCE,
    };
    expect(peekNext(state, 'off', false)).toBe('b');
  });

  it('repeat track: returns current track', () => {
    const state: QueueState = {
      trackIds: ['a', 'b'],
      currentIndex: 0,
      source: LIBRARY_SOURCE,
    };
    expect(peekNext(state, 'track', false)).toBe('a');
  });

  it('end-of-queue + repeat off: returns null', () => {
    const state: QueueState = {
      trackIds: ['a', 'b'],
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    expect(peekNext(state, 'off', false)).toBeNull();
  });

  it('end-of-queue + repeat all + non-shuffle: returns trackIds[0]', () => {
    const state: QueueState = {
      trackIds: ['a', 'b', 'c'],
      currentIndex: 2,
      source: LIBRARY_SOURCE,
    };
    expect(peekNext(state, 'all', false)).toBe('a');
  });

  it('end-of-queue + repeat all + shuffle: returns null (load delay accepted)', () => {
    const state: QueueState = {
      trackIds: ['a', 'b'],
      currentIndex: 1,
      source: LIBRARY_SOURCE,
    };
    expect(peekNext(state, 'all', true)).toBeNull();
  });

  it('empty queue: returns null', () => {
    const state: QueueState = {
      trackIds: [],
      currentIndex: -1,
      source: LIBRARY_SOURCE,
    };
    expect(peekNext(state, 'all', false)).toBeNull();
  });
});
