import { Track } from '../../types/dbTypes';
import useLibraryStore from '../stores/libraryStore';
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

/**
 * Gets the ID of the next track to play based on current playback state.
 * Does not take into account repeat mode as that's not what this function is for.
 *
 * @param currentTrackId - The ID of the current track
 * @param state - The current playback store state
 * @returns The ID of the next track, or null if there is no next track to play
 */
export const findNextSong = (
  currentTrackId: string,
  shuffleMode: boolean,
  playbackSource: 'library' | 'playlist',
  repeatMode: 'off' | 'track' | 'all',
  artistFilter?: string | null,
  shuffleHistory?: Track[],
  albumFilter?: string | null,
): Track | undefined => {
  if (!currentTrackId) return undefined;

  // Get library state for tracks
  const libraryState = useLibraryStore.getState();
  const { tracks } = libraryState;

  // Get the filtered and sorted track IDs
  const trackIds = getFilteredAndSortedTrackIds(
    playbackSource,
    artistFilter,
    albumFilter,
  );

  // if shuffle mode is on, return a random track that hasn't been played yet
  if (shuffleMode) {
    // Get the set of already played track IDs from shuffle history
    const playedTrackIds = new Set(shuffleHistory?.map((t) => t.id) || []);

    // Also add the current track to the played set
    playedTrackIds.add(currentTrackId);

    // Filter out already played tracks from available tracks
    const availableTrackIds = trackIds.filter((id) => !playedTrackIds.has(id));

    // If no unplayed tracks are available
    if (availableTrackIds.length === 0) {
      // If repeat mode is all, we've played all songs, so start over
      if (repeatMode === 'all') {
        // Clear history and pick a random track from all tracks
        const randomIndex = Math.floor(Math.random() * trackIds.length);
        const randomTrackId = trackIds[randomIndex];
        return tracks.find((t) => t.id === randomTrackId);
      }
      // No more songs to play
      return undefined;
    }

    // Pick a random track from the available (unplayed) tracks
    const randomIndex = Math.floor(Math.random() * availableTrackIds.length);
    const randomTrackId = availableTrackIds[randomIndex];
    return tracks.find((t) => t.id === randomTrackId);
  }

  // Non-shuffle mode remains the same
  // find the current index of the current track
  const currentIndex = trackIds.indexOf(currentTrackId);

  // if the current index is the last index
  if (currentIndex === trackIds.length - 1) {
    // if repeat mode is all, return the first track
    if (repeatMode === 'all') {
      const firstTrackId = trackIds[0];
      return tracks.find((t) => t.id === firstTrackId);
    }

    // otherwise, return undefined
    return undefined;
  }

  // return the next track
  const nextTrackId = trackIds[currentIndex + 1];
  return tracks.find((t) => t.id === nextTrackId);
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

export const findPreviousSong = (
  currentTrackId: string,
  shuffleMode: boolean,
  playbackSource: 'library' | 'playlist',
  repeatMode: 'off' | 'track' | 'all',
  shuffleHistory?: Track[],
  artistFilter?: string | null,
  albumFilter?: string | null,
): Track | undefined => {
  if (!currentTrackId) return undefined;

  // If in shuffle mode and we have history, return the last track from history
  if (shuffleMode && shuffleHistory && shuffleHistory.length > 0) {
    return shuffleHistory[shuffleHistory.length - 1];
  }

  // Get library state for tracks
  const libraryState = useLibraryStore.getState();
  const { tracks } = libraryState;

  // Get the filtered and sorted track IDs
  const trackIds = getFilteredAndSortedTrackIds(
    playbackSource,
    artistFilter,
    albumFilter,
  );

  // find the current index of the current track
  const currentIndex = trackIds.indexOf(currentTrackId);

  // if the current index is the first index
  if (currentIndex === 0) {
    // if repeat mode is all, return the last track
    if (repeatMode === 'all') {
      const lastTrackId = trackIds[trackIds.length - 1];
      return tracks.find((t) => t.id === lastTrackId);
    }

    // otherwise, return undefined
    return undefined;
  }

  // return the previous track
  const previousTrackId = trackIds[currentIndex - 1];
  return tracks.find((t) => t.id === previousTrackId);
};
