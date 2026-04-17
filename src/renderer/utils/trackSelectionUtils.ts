import { Track } from '../../types/dbTypes';
import useLibraryStore from '../stores/libraryStore';
import type { SettingsAndPlaybackStore } from '../stores/types';
import { getSortingFunction } from './sortingFunctions';

// Define MediaImage interface for TypeScript
interface MediaImage {
  src: string;
  sizes: string;
  type: string;
}

// Helper function to convert a track path to a URL using our custom protocol
export function getTrackUrl(filePath: string): string {
  return `hihat-audio://getfile/${encodeURIComponent(filePath)}`;
}

export function getFilePathFromTrackUrl(trackUrl: string): string {
  const encodedFilePath = trackUrl.replace('hihat-audio://getfile/', '');
  return decodeURIComponent(encodedFilePath);
}

/**
 * Gets filtered and sorted track IDs based on the current view state
 *
 * @param playbackSource - The source of playback ('library' or 'playlist')
 * @param artistFilter - Optional artist filter to apply (only for library source)
 * @returns An array of track IDs in the correct order based on filtering and sorting
 */
export const getFilteredAndSortedTrackIds = (
  playbackSource: 'library' | 'playlist',
  artistFilter?: string | null,
  albumFilter?: string | null,
): string[] => {
  // Get library state for tracks, playlists, and view states
  const libraryState = useLibraryStore.getState();
  const { tracks, playlists, libraryViewState, playlistViewState } =
    libraryState;

  // Get the appropriate track IDs array based on the playback source
  let trackIds: string[] = [];

  if (playbackSource === 'library') {
    // Apply filtering from library view
    let filteredTracks = [...tracks];

    // Apply artist filter first if provided
    if (artistFilter) {
      filteredTracks = filteredTracks.filter((track) => {
        const artist = track.albumArtist || track.artist || 'Unknown Artist';
        return artist === artistFilter;
      });
    }

    // Apply album filter if provided
    if (albumFilter) {
      filteredTracks = filteredTracks.filter(
        (track) => (track.album || 'Unknown Album') === albumFilter,
      );
    }

    // Apply filtering from library view
    // which matches the 'contains' globalFilterFn in the Material React Table
    if (libraryViewState.filtering) {
      const searchTerm = libraryViewState.filtering.toLowerCase();
      filteredTracks = filteredTracks.filter(
        (track) =>
          track.title?.toLowerCase().includes(searchTerm) ||
          track.artist?.toLowerCase().includes(searchTerm) ||
          track.album?.toLowerCase().includes(searchTerm) ||
          track.genre?.toLowerCase().includes(searchTerm),
      );
    }

    // Apply sorting from library view
    if (libraryViewState.sorting && libraryViewState.sorting.length > 0) {
      const sortConfig = libraryViewState.sorting[0];
      const { id: sortField, desc: isDescending } = sortConfig;

      // Use our custom sorting functions
      const sortFn = getSortingFunction(sortField);
      filteredTracks.sort((a, b) => sortFn(a, b, isDescending));
    }

    // Get the track IDs
    trackIds = filteredTracks.map((t) => t.id);
  } else if (playbackSource === 'playlist') {
    // Get the current playlist
    const currentPlaylist = playlists.find(
      (p) => p.id === playlistViewState.playlistId,
    );

    if (!currentPlaylist) {
      throw new Error('Playlist not found');
    }

    const playlistTrackIds = [...currentPlaylist.trackIds];
    let filteredTracks = playlistTrackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((track): track is Track => !!track);

    // Apply artist filter if provided
    if (artistFilter) {
      filteredTracks = filteredTracks.filter((track) => {
        const artist = track.albumArtist || track.artist || 'Unknown Artist';
        return artist === artistFilter;
      });
    }

    // Apply album filter if provided
    if (albumFilter) {
      filteredTracks = filteredTracks.filter(
        (track) => (track.album || 'Unknown Album') === albumFilter,
      );
    }

    // Apply filtering from playlist view
    // which matches the 'contains' globalFilterFn in the Material React Table
    if (playlistViewState.filtering) {
      const searchTerm = playlistViewState.filtering.toLowerCase();
      filteredTracks = filteredTracks.filter(
        (track) =>
          track.title?.toLowerCase().includes(searchTerm) ||
          track.artist?.toLowerCase().includes(searchTerm) ||
          track.album?.toLowerCase().includes(searchTerm) ||
          track.genre?.toLowerCase().includes(searchTerm),
      );
    }

    // Apply sorting from playlist view
    if (playlistViewState.sorting && playlistViewState.sorting.length > 0) {
      const sortConfig = playlistViewState.sorting[0];
      const { id: sortField, desc: isDescending } = sortConfig;

      // Use our custom sorting functions
      const sortFn = getSortingFunction(sortField);
      filteredTracks.sort((a, b) => sortFn(a, b, isDescending));
    }

    // Get the track IDs
    trackIds = filteredTracks.map((t) => t.id);
  }

  return trackIds;
};

export const updateMediaSession = async (track: Track) => {
  if (!navigator.mediaSession) {
    console.error('Media session not supported');
    return;
  }

  try {
    // Get album artwork if supported
    let artwork: MediaImage[] = [];

    try {
      const albumArtData = await window.electron.albumArt.get(track.filePath);
      if (albumArtData) {
        artwork = [
          {
            src: albumArtData,
            sizes: '512x512', // Default size
            type: 'image/jpeg',
          } as MediaImage,
        ];
      }
    } catch (error) {
      console.error('Error fetching album art for media session:', error);
    }

    // Create a new MediaMetadata object rather than updating the existing one
    // This ensures all properties are properly refreshed
    navigator.mediaSession.metadata = new MediaMetadata({
      title: track.title || 'Unknown Title',
      artist: track.artist || 'Unknown Artist',
      album: track.album || 'Unknown Album',
      artwork,
    });
  } catch (error) {
    console.error('Error updating media session metadata:', error);
  }
};

export type CanGoInputs = Pick<
  SettingsAndPlaybackStore,
  | 'currentTrack'
  | 'position'
  | 'repeatMode'
  | 'queueTrackIds'
  | 'queueCurrentIndex'
>;

/**
 * Returns true when the Next button should be enabled. False only when the
 * click would truly be a no-op — at the end of the queue with no repeat to
 * recycle.
 *
 * When `repeatMode === 'track'`, clicking Next restarts the current song
 * (see skipToNextTrack's repeat-track branch), so this returns true — the
 * click always does something. Likewise repeat='all' always wraps.
 */
export const computeCanGoNext = (s: CanGoInputs): boolean => {
  if (!s.currentTrack) return false;
  if (s.repeatMode !== 'off') return true;
  return s.queueCurrentIndex < s.queueTrackIds.length - 1;
};

/**
 * Returns true when the Previous button should be enabled. The button
 * handles two mutually exclusive actions depending on playback position:
 *
 *   - position > 3s: clicking restarts the current track (in-place rewind).
 *   - position <= 3s: clicking navigates to the previous queue entry if
 *     one exists, or wraps when repeat='all'.
 *
 * The name reflects that `true` may mean either "restart" or "navigate back"
 * — consumers should not assume a previous track exists just because this
 * boolean is true.
 */
export const computeCanGoPrevOrRestart = (s: CanGoInputs): boolean => {
  if (!s.currentTrack) return false;
  if (s.position > 3) return true;
  if (s.repeatMode !== 'off') return true;
  return s.queueCurrentIndex > 0;
};
