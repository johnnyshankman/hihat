/**
 * Sorting Functions Utility
 *
 * This module provides custom sorting functions for tracks in the library and playlists.
 */

interface TrackWithOptionalFields {
  id: string;
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
  duration?: number;
  playCount?: number;
  dateAdded?: string;
  albumArtist?: string;
  trackNumber?: number | null;
}

/**
 * Sort tracks by artist, then album, then track number
 */
export function sortByArtist(
  trackA: TrackWithOptionalFields,
  trackB: TrackWithOptionalFields,
  isDescending: boolean,
): number {
  // Get artist values, preferring albumArtist if available
  const artistA = trackA.albumArtist || trackA.artist;
  const artistB = trackB.albumArtist || trackB.artist;

  // Normalize artist names by converting to lowercase and removing leading "the "
  const normalizedArtistA = artistA?.toLowerCase().replace(/^the /, '') || '';
  const normalizedArtistB = artistB?.toLowerCase().replace(/^the /, '') || '';

  // Get album and track values
  const albumA = trackA.album?.toLowerCase() || '';
  const albumB = trackB.album?.toLowerCase() || '';
  const trackANum = trackA.trackNumber ?? null;
  const trackBNum = trackB.trackNumber ?? null;

  // Compare artists
  if (normalizedArtistA < normalizedArtistB) return isDescending ? 1 : -1;
  if (normalizedArtistA > normalizedArtistB) return isDescending ? -1 : 1;

  // If artists are the same, compare albums
  if (albumA < albumB) return isDescending ? 1 : -1;
  if (albumA > albumB) return isDescending ? -1 : 1;

  // If albums are the same, compare track numbers
  if (trackANum === null && trackBNum !== null) return isDescending ? 1 : -1;
  if (trackANum !== null && trackBNum === null) return isDescending ? -1 : 1;
  if (trackANum !== null && trackBNum !== null) {
    if (trackANum < trackBNum) return isDescending ? 1 : -1;
    if (trackANum > trackBNum) return isDescending ? -1 : 1;
  }

  // If everything is equal, return 0
  return 0;
}

/**
 * Sort tracks by album, then track number
 */
export function sortByAlbum(
  trackA: TrackWithOptionalFields,
  trackB: TrackWithOptionalFields,
  isDescending: boolean,
): number {
  // Get album and track values
  const albumA = trackA.album?.toLowerCase() || '';
  const albumB = trackB.album?.toLowerCase() || '';
  const trackANum = trackA.trackNumber ?? null;
  const trackBNum = trackB.trackNumber ?? null;

  // Compare albums
  if (albumA < albumB) return isDescending ? 1 : -1;
  if (albumA > albumB) return isDescending ? -1 : 1;

  // If albums are the same, compare track numbers
  if (trackANum === null && trackBNum !== null) return isDescending ? 1 : -1;
  if (trackANum !== null && trackBNum === null) return isDescending ? -1 : 1;
  if (trackANum !== null && trackBNum !== null) {
    if (trackANum < trackBNum) return isDescending ? 1 : -1;
    if (trackANum > trackBNum) return isDescending ? -1 : 1;
  }

  // If everything is equal, return 0
  return 0;
}

/**
 * Sort tracks by title
 */
export function sortByTitle(
  trackA: TrackWithOptionalFields,
  trackB: TrackWithOptionalFields,
  isDescending: boolean,
): number {
  const titleA = trackA.title?.toLowerCase() || '';
  const titleB = trackB.title?.toLowerCase() || '';

  if (titleA < titleB) return isDescending ? 1 : -1;
  if (titleA > titleB) return isDescending ? -1 : 1;
  return 0;
}

/**
 * Sort tracks by genre
 */
export function sortByGenre(
  trackA: TrackWithOptionalFields,
  trackB: TrackWithOptionalFields,
  isDescending: boolean,
): number {
  const genreA = trackA.genre?.toLowerCase() || '';
  const genreB = trackB.genre?.toLowerCase() || '';

  if (genreA < genreB) return isDescending ? 1 : -1;
  if (genreA > genreB) return isDescending ? -1 : 1;
  return 0;
}

/**
 * Sort tracks by duration
 */
export function sortByDuration(
  trackA: TrackWithOptionalFields,
  trackB: TrackWithOptionalFields,
  isDescending: boolean,
): number {
  const durationA = trackA.duration || 0;
  const durationB = trackB.duration || 0;

  if (durationA < durationB) return isDescending ? 1 : -1;
  if (durationA > durationB) return isDescending ? -1 : 1;
  return 0;
}

/**
 * Sort tracks by play count
 */
export function sortByPlayCount(
  trackA: TrackWithOptionalFields,
  trackB: TrackWithOptionalFields,
  isDescending: boolean,
): number {
  const playCountA = trackA.playCount || 0;
  const playCountB = trackB.playCount || 0;

  if (playCountA < playCountB) return isDescending ? 1 : -1;
  if (playCountA > playCountB) return isDescending ? -1 : 1;
  return 0;
}

/**
 * Sort tracks by date added
 */
export function sortByDateAdded(
  trackA: TrackWithOptionalFields,
  trackB: TrackWithOptionalFields,
  isDescending: boolean,
): number {
  const dateA = trackA.dateAdded ? new Date(trackA.dateAdded).getTime() : 0;
  const dateB = trackB.dateAdded ? new Date(trackB.dateAdded).getTime() : 0;

  if (dateA < dateB) return isDescending ? 1 : -1;
  if (dateA > dateB) return isDescending ? -1 : 1;
  return 0;
}

/**
 * Get the appropriate sorting function based on the field
 */
export function getSortingFunction(
  field: string,
): (
  a: TrackWithOptionalFields,
  b: TrackWithOptionalFields,
  isDescending: boolean,
) => number {
  switch (field) {
    case 'artist':
      return sortByArtist;
    case 'album':
      return sortByAlbum;
    case 'title':
      return sortByTitle;
    case 'genre':
      return sortByGenre;
    case 'duration':
      return sortByDuration;
    case 'playCount':
      return sortByPlayCount;
    case 'dateAdded':
      return sortByDateAdded;
    default:
      return sortByTitle;
  }
}
