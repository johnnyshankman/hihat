/**
 * @jest-environment node
 */

import { PlaybackTracker } from '../renderer/utils/playbackTracker';

describe('PlaybackTracker', () => {
  let tracker: PlaybackTracker;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    tracker = new PlaybackTracker();
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  describe('updateListenTime threshold logic', () => {
    test('returns false when track is not currently being tracked', () => {
      // No startTrackingTrack call: currentTrackId is null
      expect(tracker.updateListenTime('a', 30, 200)).toBe(false);
    });

    test('returns false when updating a different track than the current one', () => {
      tracker.startTrackingTrack('a');
      expect(tracker.updateListenTime('b', 30, 200)).toBe(false);
    });

    test('uses 30s cap for long tracks (duration * 0.2 > 30)', () => {
      tracker.startTrackingTrack('long');
      // 300s track -> threshold = min(30, 60) = 30
      expect(tracker.updateListenTime('long', 29, 300)).toBe(false);
      expect(tracker.updateListenTime('long', 1, 300)).toBe(true);
    });

    test('uses 20%-of-duration for short tracks (duration * 0.2 < 30)', () => {
      tracker.startTrackingTrack('short');
      // 60s track -> threshold = min(30, 12) = 12
      expect(tracker.updateListenTime('short', 11, 60)).toBe(false);
      expect(tracker.updateListenTime('short', 1, 60)).toBe(true);
    });

    test('crosses threshold exactly once, then returns false even on more time', () => {
      tracker.startTrackingTrack('a');
      expect(tracker.updateListenTime('a', 30, 200)).toBe(true);
      // already counted — subsequent increments must not double-count
      expect(tracker.updateListenTime('a', 50, 200)).toBe(false);
      expect(tracker.updateListenTime('a', 50, 200)).toBe(false);
    });

    test('threshold equality counts as crossed (>=)', () => {
      tracker.startTrackingTrack('a');
      // 100s track -> threshold = min(30, 20) = 20
      expect(tracker.updateListenTime('a', 20, 100)).toBe(true);
    });

    test('accumulates time across multiple updates before crossing', () => {
      tracker.startTrackingTrack('a');
      // 200s track -> threshold = min(30, 40) = 30
      expect(tracker.updateListenTime('a', 10, 200)).toBe(false);
      expect(tracker.updateListenTime('a', 10, 200)).toBe(false);
      expect(tracker.updateListenTime('a', 10, 200)).toBe(true);
    });
  });

  describe('startTrackingTrack', () => {
    test('switching tracks resets the counted flag, allowing the new one to count', () => {
      tracker.startTrackingTrack('a');
      expect(tracker.updateListenTime('a', 30, 200)).toBe(true);

      tracker.startTrackingTrack('b');
      expect(tracker.updateListenTime('b', 30, 200)).toBe(true);
    });

    test('re-starting tracking on the SAME track resets the counted flag', () => {
      // The implementation resets hasCurrentTrackBeenCounted unconditionally,
      // even when the trackId matches. Pin this behavior so a refactor that
      // moves the reset inside the "new track" branch is caught.
      tracker.startTrackingTrack('a');
      expect(tracker.updateListenTime('a', 30, 200)).toBe(true);

      tracker.startTrackingTrack('a');
      // listen time persists in the map, so the next update is already past
      // threshold and counts again
      expect(tracker.updateListenTime('a', 0, 200)).toBe(true);
    });
  });

  describe('resetTrack', () => {
    test('clears accumulated listen time so the threshold must be re-crossed', () => {
      tracker.startTrackingTrack('a');
      expect(tracker.updateListenTime('a', 25, 200)).toBe(false);

      tracker.resetTrack('a');
      // Need the full threshold again from zero
      expect(tracker.updateListenTime('a', 25, 200)).toBe(false);
      expect(tracker.updateListenTime('a', 5, 200)).toBe(true);
    });

    test('resets the counted flag only for the currently-tracked track', () => {
      tracker.startTrackingTrack('a');
      expect(tracker.updateListenTime('a', 30, 200)).toBe(true);

      // Resetting a different track should not unlock 'a' to be counted again
      tracker.resetTrack('b');
      expect(tracker.updateListenTime('a', 30, 200)).toBe(false);

      // Resetting the current track DOES unlock counting
      tracker.resetTrack('a');
      expect(tracker.updateListenTime('a', 30, 200)).toBe(true);
    });
  });
});
