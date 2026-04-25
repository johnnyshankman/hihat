/**
 * @jest-environment node
 */

// Stub Gapless5 — only the type is used by playerQueue, but the value import
// would load the real module. The tests pass a hand-rolled mock instance.
import type { Gapless5 } from '@regosen/gapless-5';
import {
  preloadNextInQueue,
  syncPlayerQueue,
} from '../renderer/utils/playerQueue';
import { Track } from '../types/dbTypes';

jest.mock('@regosen/gapless-5', () => ({ Gapless5: class {} }));

interface MockPlayer {
  pause: jest.Mock;
  removeAllTracks: jest.Mock;
  addTrack: jest.Mock;
  play: jest.Mock;
  getTracks: jest.Mock;
}

function createMockPlayer(): MockPlayer {
  // getTracks reflects what addTrack calls have happened so the queue
  // invariant assertion sees a realistic length.
  const queue: string[] = [];
  return {
    pause: jest.fn(),
    removeAllTracks: jest.fn(() => {
      queue.length = 0;
    }),
    addTrack: jest.fn((url: string) => {
      queue.push(url);
    }),
    play: jest.fn(),
    getTracks: jest.fn(() => queue),
  };
}

const track = (id: string, filePath: string): Track => ({
  id,
  filePath,
  title: id,
  artist: '',
  album: '',
  albumArtist: '',
  genre: '',
  duration: 0,
  playCount: 0,
  dateAdded: '',
  lastPlayed: null,
  lyrics: null,
  trackNumber: null,
  totalTracks: null,
  discNumber: null,
  totalDiscs: null,
  year: null,
  bpm: null,
  composer: null,
  comment: null,
});

describe('syncPlayerQueue', () => {
  let player: MockPlayer;

  beforeEach(() => {
    player = createMockPlayer();
  });

  test('replaces the queue with current track only when next is null', () => {
    const current = track('a', '/path/a.mp3');

    syncPlayerQueue(player as unknown as Gapless5, {
      current,
      next: null,
      shouldPlay: false,
    });

    expect(player.removeAllTracks).toHaveBeenCalledTimes(1);
    expect(player.addTrack).toHaveBeenCalledTimes(1);
    expect(player.addTrack).toHaveBeenCalledWith(
      `hihat-audio://getfile/${encodeURIComponent('/path/a.mp3')}`,
    );
  });

  test('adds both current and next when provided', () => {
    const current = track('a', '/path/a.mp3');
    const next = track('b', '/path/b.mp3');

    syncPlayerQueue(player as unknown as Gapless5, {
      current,
      next,
      shouldPlay: false,
    });

    expect(player.addTrack).toHaveBeenCalledTimes(2);
    expect(player.addTrack).toHaveBeenNthCalledWith(
      1,
      `hihat-audio://getfile/${encodeURIComponent('/path/a.mp3')}`,
    );
    expect(player.addTrack).toHaveBeenNthCalledWith(
      2,
      `hihat-audio://getfile/${encodeURIComponent('/path/b.mp3')}`,
    );
  });

  test('treats next: undefined the same as null', () => {
    const current = track('a', '/path/a.mp3');

    syncPlayerQueue(player as unknown as Gapless5, {
      current,
      next: undefined,
      shouldPlay: false,
    });

    expect(player.addTrack).toHaveBeenCalledTimes(1);
  });

  test('does NOT call play when shouldPlay is false', () => {
    syncPlayerQueue(player as unknown as Gapless5, {
      current: track('a', '/a.mp3'),
      next: null,
      shouldPlay: false,
    });

    expect(player.play).not.toHaveBeenCalled();
  });

  test('calls play AFTER queue is rebuilt when shouldPlay is true', () => {
    const callOrder: string[] = [];
    const ordered: MockPlayer = {
      pause: jest.fn(() => callOrder.push('pause')),
      removeAllTracks: jest.fn(() => callOrder.push('removeAllTracks')),
      addTrack: jest.fn(() => callOrder.push('addTrack')),
      play: jest.fn(() => callOrder.push('play')),
      getTracks: jest.fn(() => []),
    };

    syncPlayerQueue(ordered as unknown as Gapless5, {
      current: track('a', '/a.mp3'),
      next: track('b', '/b.mp3'),
      shouldPlay: true,
    });

    expect(callOrder).toEqual([
      'removeAllTracks',
      'addTrack',
      'addTrack',
      'play',
    ]);
  });

  test('pauses BEFORE rebuilding the queue when pauseBeforeLoad is set', () => {
    const callOrder: string[] = [];
    const ordered: MockPlayer = {
      pause: jest.fn(() => callOrder.push('pause')),
      removeAllTracks: jest.fn(() => callOrder.push('removeAllTracks')),
      addTrack: jest.fn(() => callOrder.push('addTrack')),
      play: jest.fn(() => callOrder.push('play')),
      getTracks: jest.fn(() => []),
    };

    syncPlayerQueue(ordered as unknown as Gapless5, {
      current: track('a', '/a.mp3'),
      next: null,
      shouldPlay: false,
      pauseBeforeLoad: true,
    });

    expect(callOrder).toEqual(['pause', 'removeAllTracks', 'addTrack']);
  });

  test('does not pause when pauseBeforeLoad is false/omitted', () => {
    syncPlayerQueue(player as unknown as Gapless5, {
      current: track('a', '/a.mp3'),
      next: null,
      shouldPlay: false,
    });
    expect(player.pause).not.toHaveBeenCalled();
  });

  test('encodes special characters in file paths', () => {
    syncPlayerQueue(player as unknown as Gapless5, {
      current: track('a', '/path/with spaces/song&more.mp3'),
      next: null,
      shouldPlay: false,
    });

    const url = player.addTrack.mock.calls[0][0] as string;
    expect(url).toBe(
      `hihat-audio://getfile/${encodeURIComponent(
        '/path/with spaces/song&more.mp3',
      )}`,
    );
    // Decoding the URL portion must round-trip to the original path
    expect(decodeURIComponent(url.replace('hihat-audio://getfile/', ''))).toBe(
      '/path/with spaces/song&more.mp3',
    );
  });
});

describe('preloadNextInQueue', () => {
  test('appends a single track to the queue without removing existing entries', () => {
    const player = createMockPlayer();
    const next = track('b', '/path/b.mp3');

    preloadNextInQueue(player as unknown as Gapless5, next);

    expect(player.removeAllTracks).not.toHaveBeenCalled();
    expect(player.addTrack).toHaveBeenCalledTimes(1);
    expect(player.addTrack).toHaveBeenCalledWith(
      `hihat-audio://getfile/${encodeURIComponent('/path/b.mp3')}`,
    );
  });
});

describe('queue invariant logging', () => {
  // The dev-only invariant check warns when queue length > 2.
  // It runs only when NODE_ENV !== 'production'. Jest sets NODE_ENV='test'
  // by default, so this assertion is active in our suite.

  test('warns when the post-sync queue holds more than 2 tracks', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    // Player whose getTracks reports 3 entries — simulates the known leak
    const leakyPlayer: MockPlayer = {
      pause: jest.fn(),
      removeAllTracks: jest.fn(),
      addTrack: jest.fn(),
      play: jest.fn(),
      getTracks: jest.fn(() => ['a', 'b', 'c']),
    };

    syncPlayerQueue(leakyPlayer as unknown as Gapless5, {
      current: track('a', '/a.mp3'),
      next: null,
      shouldPlay: false,
    });

    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining('invariant violation'),
    );
    errSpy.mockRestore();
  });

  test('stays silent when queue length is within the 2-track invariant', () => {
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const player = createMockPlayer();

    syncPlayerQueue(player as unknown as Gapless5, {
      current: track('a', '/a.mp3'),
      next: track('b', '/b.mp3'),
      shouldPlay: false,
    });

    expect(errSpy).not.toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
