import { Track } from '../../types/dbTypes';
import useLibraryStore from '../stores/libraryStore';
import { getSortingFunction } from './sortingFunctions';

// Helper function to convert a track path to a URL using our custom protocol
export function getTrackUrl(filePath: string): string {
  return `hihat-audio://getfile/${encodeURIComponent(filePath)}`;
}

export function getFilePathFromTrackUrl(trackUrl: string): string {
  const encodedFilePath = trackUrl.replace('hihat-audio://getfile/', '');
  return decodeURIComponent(encodedFilePath);
}

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
): Track | undefined => {
  if (!currentTrackId) return undefined;

  // Get library state for tracks, playlists, and view states
  const libraryState = useLibraryStore.getState();
  const { tracks, playlists, libraryViewState, playlistViewState } =
    libraryState;

  // Get the appropriate track IDs array based on the playback source
  let trackIds: string[] = [];
  if (playbackSource === 'library') {
    // Apply filtering from library view
    let filteredTracks = [...tracks];

    // Apply filtering from library view
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
      throw new Error('Playlist not found to find next song in');
    }

    const filteredTrackIds = [...currentPlaylist.trackIds];
    let filteredTracks = filteredTrackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((track): track is Track => !!track);

    // Apply filtering from playlist view
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
  } else {
    throw new Error('Invalid playback source');
  }

  // find the current index of the current track
  const currentIndex = trackIds.indexOf(currentTrackId);

  // if the current index is the last index
  if (currentIndex === trackIds.length - 1) {
    // if repeat mode is all, return the first track
    if (repeatMode === 'all') {
      return tracks[0];
    }

    // otherwise, return undefined
    // @TODO: should i just return the current song?
    return undefined;
  }

  // if shuffle mode is on, return a random track
  if (shuffleMode) {
    const randomIndex = Math.floor(Math.random() * trackIds.length);
    const randomTrackId = trackIds[randomIndex];
    return tracks.find((t) => t.id === randomTrackId);
  }

  // return the next track
  const nextTrackId = trackIds[currentIndex + 1];
  return tracks.find((t) => t.id === nextTrackId);
};

export const updateMediaSession = (track: Track) => {
  const mediaData = {
    title: track.title,
    artist: track.artist,
    album: track.album,
  };

  if (!navigator.mediaSession) {
    console.error('Media session not supported');
    return;
  }

  if (navigator.mediaSession.metadata) {
    Object.assign(navigator.mediaSession.metadata, mediaData);
  } else {
    navigator.mediaSession.metadata = new MediaMetadata(mediaData);
  }
};

export const findPreviousSong = (
  currentTrackId: string,
  playbackSource: 'library' | 'playlist',
  repeatMode: 'off' | 'track' | 'all',
): Track | undefined => {
  if (!currentTrackId) return undefined;

  // Get library state for tracks, playlists, and view states
  const libraryState = useLibraryStore.getState();
  const { tracks, playlists, libraryViewState, playlistViewState } =
    libraryState;

  // Get the appropriate track IDs array based on the playback source
  let trackIds: string[] = [];
  if (playbackSource === 'library') {
    // Apply filtering from library view
    let filteredTracks = [...tracks];

    // Apply filtering from library view
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
      throw new Error('Playlist not found to find next song in');
    }

    const filteredTrackIds = [...currentPlaylist.trackIds];
    let filteredTracks = filteredTrackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((track): track is Track => !!track);

    // Apply filtering from playlist view
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
  } else {
    throw new Error('Invalid playback source');
  }

  // find the current index of the current track
  const currentIndex = trackIds.indexOf(currentTrackId);

  // if the current index is the last index, return null
  if (currentIndex === trackIds.length - 1) {
    // if repeat mode is all, return the first track
    if (repeatMode === 'all') {
      return tracks[0];
    }

    // otherwise, return undefined
    // @TODO: should i just return the current song?
    return undefined;
  }

  // return the next track
  const previousTrackId = trackIds[currentIndex - 1];
  return tracks.find((t) => t.id === previousTrackId);
};
