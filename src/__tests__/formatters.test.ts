/**
 * @jest-environment node
 */

import {
  calculateTotalHours,
  formatDuration,
} from '../renderer/utils/formatters';

describe('formatDuration', () => {
  test('formats whole minutes', () => {
    expect(formatDuration(60)).toBe('1:00');
    expect(formatDuration(180)).toBe('3:00');
  });

  test('formats sub-minute durations', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(45)).toBe('0:45');
  });

  test('zero-pads seconds < 10', () => {
    expect(formatDuration(61)).toBe('1:01');
    expect(formatDuration(125)).toBe('2:05');
  });

  test('rounds to nearest second', () => {
    expect(formatDuration(59.4)).toBe('0:59');
    expect(formatDuration(59.6)).toBe('1:00');
  });

  test('returns 0:00 for invalid values', () => {
    expect(formatDuration(NaN)).toBe('0:00');
    expect(formatDuration(-1)).toBe('0:00');
    // @ts-expect-error testing invalid input
    expect(formatDuration(null)).toBe('0:00');
    // @ts-expect-error testing invalid input
    expect(formatDuration(undefined)).toBe('0:00');
  });

  test('handles long durations beyond an hour', () => {
    // No hours formatting — just rolls into many minutes
    expect(formatDuration(3661)).toBe('61:01');
  });
});

describe('calculateTotalHours', () => {
  test('returns minutes for under an hour', () => {
    const tracks = [{ duration: 1800 }, { duration: 600 }]; // 40 min
    expect(calculateTotalHours(tracks)).toBe('40.0m');
  });

  test('returns hours for 1h to under 24h', () => {
    const tracks = [{ duration: 3600 * 5 }]; // 5h
    expect(calculateTotalHours(tracks)).toBe('5.0h');
  });

  test('returns days for 24h or more', () => {
    const tracks = [{ duration: 3600 * 48 }]; // 2 days
    expect(calculateTotalHours(tracks)).toBe('2.0d');
  });

  test('handles empty tracks list', () => {
    expect(calculateTotalHours([])).toBe('0.0m');
  });

  test('treats missing/zero duration safely', () => {
    // Cast through unknown so we can pass an entry with no duration field —
    // the implementation guards with `track.duration || 0` and we want to
    // pin that fallback.
    const tracks = [
      { duration: 0 },
      {} as { duration: number },
      { duration: 60 },
    ];
    expect(calculateTotalHours(tracks)).toBe('1.0m');
  });

  test('crosses the 1h boundary correctly', () => {
    // 59m 59s -> still under 1h
    expect(calculateTotalHours([{ duration: 3599 }])).toMatch(/m$/);
    // 1h 0m 1s -> hours
    expect(calculateTotalHours([{ duration: 3601 }])).toMatch(/h$/);
  });

  test('crosses the 24h boundary correctly', () => {
    // 23h 59m 59s -> still hours
    expect(calculateTotalHours([{ duration: 86399 }])).toMatch(/h$/);
    // 24h 0m 1s -> days
    expect(calculateTotalHours([{ duration: 86401 }])).toMatch(/d$/);
  });
});
