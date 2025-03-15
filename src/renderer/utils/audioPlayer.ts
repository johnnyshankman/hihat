/**
 * Audio Player Utility
 *
 * This module provides utility functions for audio playback.
 * The actual Gapless5 player instance is managed by PlaybackContext.
 */

import { Track } from '../../types/dbTypes';

/**
 * Find the next song to play based on the current song and shuffle state
 * @param currentSongId - The ID of the current song
 * @param trackIds - Array of track IDs to choose from
 * @param shuffle - Whether shuffle mode is enabled
 * @param shuffleHistory - The current shuffle history (for updating in the context)
 * @returns The ID of the next song to play, its index, and the updated shuffle history
 */
export function findNextSong(
  currentSongId: string,
  trackIds: string[], // equivalent of filteredLibrary
  shuffle: boolean,
  shuffleHistory: string[] = [],
): { songId: string; index: number; updatedShuffleHistory: string[] } {
  const currentIndex = trackIds.indexOf(currentSongId);
  let updatedShuffleHistory = [...shuffleHistory];

  if (shuffle) {
    // In shuffle mode, pick a random song that's not the current one
    let randomIndex = Math.floor(Math.random() * trackIds.length);

    // Try to avoid picking the same song if possible
    if (trackIds.length > 1) {
      while (randomIndex === currentIndex) {
        randomIndex = Math.floor(Math.random() * trackIds.length);
      }
    }

    // Update shuffle history
    if (currentSongId) {
      updatedShuffleHistory = [...shuffleHistory, currentSongId];
      if (updatedShuffleHistory.length > 100) {
        updatedShuffleHistory.shift();
      }
    }

    return {
      songId: trackIds[randomIndex],
      index: randomIndex,
      updatedShuffleHistory,
    };
  }

  // In sequential mode, pick the next song or loop back to the beginning
  const nextIndex = currentIndex + 1 >= trackIds.length ? 0 : currentIndex + 1;
  return {
    songId: trackIds[nextIndex],
    index: nextIndex,
    updatedShuffleHistory,
  };
}

/**
 * Get the duration of a track in seconds
 * @param track - The track to get the duration for
 * @returns The track duration in seconds
 */
export function getTrackDuration(track: Track | null): number {
  if (!track) return 0;
  // Convert from milliseconds to seconds
  return track.duration / 1000;
}
