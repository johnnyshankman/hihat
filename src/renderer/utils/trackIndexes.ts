import { Track } from '../../types/dbTypes';
import { SearchIndexData } from '../stores/types';

export interface TrackIndexes {
  trackIndex: Map<string, Track>;
  artistIndex: Map<string, Set<string>>;
  albumIndex: Map<string, Set<string>>;
  searchIndex: Map<string, SearchIndexData>;
}

/**
 * Build O(1)-lookup indexes over a tracks array.
 *
 * Used by the `useTracks` query (so all consumers share one set of
 * indexes computed once at fetch time) and — until Phase 5c strips it —
 * by the existing `libraryStore` server-state cache.
 */
export function buildIndexes(tracks: Track[]): TrackIndexes {
  const trackIndex = new Map<string, Track>();
  const artistIndex = new Map<string, Set<string>>();
  const albumIndex = new Map<string, Set<string>>();
  const searchIndex = new Map<string, SearchIndexData>();

  tracks.forEach((track) => {
    trackIndex.set(track.id, track);

    const artist = track.albumArtist || track.artist || 'Unknown Artist';
    if (!artistIndex.has(artist)) artistIndex.set(artist, new Set());
    artistIndex.get(artist)!.add(track.id);

    const album = track.album || 'Unknown Album';
    if (!albumIndex.has(album)) albumIndex.set(album, new Set());
    albumIndex.get(album)!.add(track.id);

    searchIndex.set(track.id, {
      titleLower: (track.title || '').toLowerCase(),
      artistLower: (track.artist || '').toLowerCase(),
      albumLower: (track.album || '').toLowerCase(),
      genreLower: (track.genre || '').toLowerCase(),
    });
  });

  return { trackIndex, artistIndex, albumIndex, searchIndex };
}
