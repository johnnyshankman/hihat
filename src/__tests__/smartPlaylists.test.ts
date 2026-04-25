/**
 * @jest-environment node
 */

import { SMART_PLAYLISTS } from '../types/smartPlaylists';

describe('SMART_PLAYLISTS constant', () => {
  test('defines exactly the three built-in smart playlists', () => {
    expect(SMART_PLAYLISTS).toHaveLength(3);
  });

  test('every entry has a stable smartPlaylistId, a name, and a ruleSet', () => {
    SMART_PLAYLISTS.forEach((p) => {
      expect(typeof p.smartPlaylistId).toBe('string');
      expect(p.smartPlaylistId.length).toBeGreaterThan(0);
      expect(typeof p.name).toBe('string');
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.ruleSet).toBeDefined();
      expect(typeof p.ruleSet.type).toBe('string');
      expect(typeof p.ruleSet.limit).toBe('number');
    });
  });

  test('smartPlaylistIds are unique', () => {
    const ids = SMART_PLAYLISTS.map((p) => p.smartPlaylistId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('smartPlaylistIds match the documented stable identifiers', () => {
    // These IDs must NEVER change — they identify rows in users' databases.
    // If a test here fails, the schema migration is broken.
    const ids = SMART_PLAYLISTS.map((p) => p.smartPlaylistId).sort();
    expect(ids).toEqual(['most-played', 'recently-added', 'recently-played']);
  });

  test('each rule type appears exactly once', () => {
    const types = SMART_PLAYLISTS.map((p) => p.ruleSet.type).sort();
    expect(types).toEqual(['mostPlayed', 'recentlyAdded', 'recentlyPlayed']);
  });

  test('each smart playlist limits to 50 tracks', () => {
    SMART_PLAYLISTS.forEach((p) => {
      expect(p.ruleSet.limit).toBe(50);
    });
  });

  test('id <-> rule type pairing is correct', () => {
    const byId = new Map(SMART_PLAYLISTS.map((p) => [p.smartPlaylistId, p]));
    expect(byId.get('recently-added')?.ruleSet.type).toBe('recentlyAdded');
    expect(byId.get('recently-played')?.ruleSet.type).toBe('recentlyPlayed');
    expect(byId.get('most-played')?.ruleSet.type).toBe('mostPlayed');
  });
});
