import { Playlist } from '../../types/dbTypes';

/**
 * Centralized query key factory.
 *
 * Hierarchy is intentional so callers can target broad invalidations:
 *   - `qc.invalidateQueries({ queryKey: queryKeys.tracks })` — invalidate all
 *     track-shaped queries.
 *   - `qc.invalidateQueries({ queryKey: queryKeys.playlist(id) })` — only
 *     that one playlist.
 */
export const queryKeys = {
  tracks: ['tracks'] as const,
  playlists: ['playlists'] as const,
  smartPlaylistTracks: (ruleSet: Playlist['ruleSet']) =>
    ['playlists', 'smart', ruleSet] as const,
  settings: ['settings'] as const,
  albumArt: (filePath: string) => ['albumArt', filePath] as const,
  fileExists: (filePath: string) => ['fileExists', filePath] as const,
  logFilePath: ['logFilePath'] as const,
} as const;
