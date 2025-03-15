/**
 * Playback Service
 *
 * This module provides functionality for playing audio files in the main process.
 * It uses the Gapless5 library for audio playback and manages the playback state.
 */

import { BrowserWindow } from 'electron';
import * as db from '../db';
import { Track } from '../../types/dbTypes';

// Main window reference for sending events
let mainWindow: BrowserWindow | null = null;

// Current playback state
const currentState = {
  isPlaying: false,
  currentTrack: null as Track | null,
  position: 0,
  duration: 0,
  volume: 0.75,
  queue: [] as string[], // Track IDs in the current queue
  queueIndex: -1, // Current position in the queue
  repeatMode: 'track' as 'track' | 'all' | 'none',
  shuffleMode: false,
  shuffleHistory: [] as string[],
};

// Audio player instance (will be implemented with actual audio library)
const audioPlayer: any = null;
let positionUpdateInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Set the main window reference for sending events
 * @param window - Main window reference
 */
export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Send an event to the renderer process
 * @param event - Event name
 * @param data - Event data
 */
function sendEvent(event: string, data: any): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(event, data);
  }
}

/**
 * Seek to a position in the current track
 * @param position - Position in milliseconds
 * @returns True if successful
 */
export function seekToPosition(position: number): boolean {
  try {
    if (!currentState.currentTrack) {
      return false;
    }

    // Ensure position is within valid range
    const validPosition = Math.max(
      0,
      Math.min(position, currentState.duration),
    );
    currentState.position = validPosition;

    sendEvent('playback:positionChanged', {
      position: validPosition,
      duration: currentState.duration,
    });
    return true;
  } catch (error) {
    console.error(`Error seeking to position ${position}:`, error);
    return false;
  }
}

/**
 * Play a track
 * @param trackId - ID of the track to play
 * @returns True if successful
 */
export function playTrack(trackId: string): boolean {
  try {
    // Get track from database
    const track = db.getTrackById(trackId);

    if (!track) {
      console.error(`Track with ID ${trackId} not found`);
      return false;
    }

    // Set current track
    currentState.currentTrack = track;

    // Ensure duration is a valid number in milliseconds
    // Most music metadata libraries store duration in milliseconds
    if (typeof track.duration !== 'number' || track.duration <= 0) {
      currentState.duration = 180000; // Default to 3 minutes (in milliseconds)
    } else if (track.duration < 100) {
      // Probably in minutes, convert to milliseconds
      currentState.duration = track.duration * 60 * 1000;
    } else if (track.duration < 10000) {
      // Probably in seconds, convert to milliseconds
      currentState.duration = track.duration * 1000;
    } else {
      // Already in milliseconds
      currentState.duration = track.duration;
    }

    currentState.position = 0;

    // Update queue if this track is in it
    const trackIndex = currentState.queue.indexOf(trackId);
    if (trackIndex !== -1) {
      currentState.queueIndex = trackIndex;
    } else {
      // If the track isn't in the queue, add it and set as current
      currentState.queue = [trackId];
      currentState.queueIndex = 0;
    }

    // Send track changed event
    sendEvent('playback:trackChanged', { track });

    // Send initial position event
    sendEvent('playback:positionChanged', {
      position: 0,
      duration: currentState.duration,
    });

    // Set playing state
    currentState.isPlaying = true;
    sendEvent('playback:stateChanged', { isPlaying: true });

    return true;
  } catch (error) {
    console.error(`Error playing track with ID ${trackId}:`, error);
    return false;
  }
}

/**
 * Play the next track in the queue
 * @returns True if successful
 */
export function playNextTrack(): boolean {
  try {
    // Check if there's a next track in the queue
    if (currentState.queueIndex < currentState.queue.length - 1) {
      // Move to the next track
      currentState.queueIndex += 1;
      const nextTrackId = currentState.queue[currentState.queueIndex];

      // Play the next track
      return playTrack(nextTrackId);
    }

    return false;
  } catch (error) {
    console.error('Error playing next track:', error);
    return false;
  }
}

/**
 * Play the previous track in the queue
 * @returns True if successful
 */
export function playPreviousTrack(): boolean {
  try {
    // If we're more than 3 seconds into the current track, restart it
    // This implements the classic CD player behavior
    if (currentState.position > 3) {
      seekToPosition(0);
      return true;
    }

    // If repeat mode is set to 'track', just restart the current song
    if (currentState.repeatMode === 'track') {
      seekToPosition(0);
      return true;
    }

    // If shuffle mode is enabled, try to go to the last song in the shuffle history
    if (
      currentState.shuffleMode &&
      currentState.shuffleHistory &&
      currentState.shuffleHistory.length >= 2
    ) {
      // Get the previous track from the shuffle history
      const prevTrackId =
        currentState.shuffleHistory[currentState.shuffleHistory.length - 2];

      // Remove the current track from the history
      currentState.shuffleHistory.pop();

      // Play the previous track
      return playTrack(prevTrackId);
    }

    // Check if there's a previous track in the queue
    if (currentState.queueIndex > 0) {
      // Move to the previous track
      currentState.queueIndex -= 1;
      const prevTrackId = currentState.queue[currentState.queueIndex];

      // Play the previous track
      return playTrack(prevTrackId);
    }

    // If we're at the beginning of the queue and repeat mode is 'all',
    // go to the last track in the queue
    if (currentState.repeatMode === 'all' && currentState.queue.length > 0) {
      currentState.queueIndex = currentState.queue.length - 1;
      const lastTrackId = currentState.queue[currentState.queueIndex];

      // Play the last track
      return playTrack(lastTrackId);
    }

    return false;
  } catch (error) {
    console.error('Error playing previous track:', error);
    return false;
  }
}

/**
 * Handle track ended event
 */
function handleTrackEnded(): void {
  if (currentState.currentTrack) {
    // Update play count
    db.updatePlayCount(currentState.currentTrack.id, new Date().toISOString());
  }

  // Try to play the next track
  if (!playNextTrack()) {
    // If there's no next track, stop playback
    audioPlayer.stop();

    // Reset current track
    currentState.currentTrack = null;
    sendEvent('playback:trackChanged', { track: null });
  }
}

/**
 * Initialize the playback service
 */
export function initPlayback(): void {
  // Initialize position update interval
  positionUpdateInterval = setInterval(() => {
    if (currentState.isPlaying && currentState.currentTrack) {
      // Only increment position if we have a track and are playing
      currentState.position += 1000; // Increment by 1 second (1000ms)

      // Make sure position doesn't exceed duration
      if (currentState.position >= currentState.duration) {
        // Track ended
        handleTrackEnded();
      } else {
        sendEvent('playback:positionChanged', {
          position: currentState.position,
          duration: currentState.duration,
        });
      }
    }
  }, 1000);
}

/**
 * Set the current queue of tracks
 * @param trackIds - Array of track IDs to set as the queue
 * @param startIndex - Index to start playback from
 */
export function setQueue(trackIds: string[], startIndex = 0): void {
  currentState.queue = trackIds;
  currentState.queueIndex = startIndex;
}

/**
 * Pause playback
 * @returns True if successful
 */
export function pausePlayback(): boolean {
  try {
    audioPlayer.pause();
    return true;
  } catch (error) {
    console.error('Error pausing playback:', error);
    return false;
  }
}

/**
 * Resume playback
 * @returns True if successful
 */
export function resumePlayback(): boolean {
  try {
    audioPlayer.play();
    return true;
  } catch (error) {
    console.error('Error resuming playback:', error);
    return false;
  }
}

/**
 * Stop playback
 * @returns True if successful
 */
export function stopPlayback(): boolean {
  try {
    audioPlayer.stop();
    return true;
  } catch (error) {
    console.error('Error stopping playback:', error);
    return false;
  }
}

/**
 * Set the volume
 * @param volume - Volume level (0-1)
 * @returns True if successful
 */
export function setVolume(volume: number): boolean {
  try {
    audioPlayer.setVolume(volume);
    return true;
  } catch (error) {
    console.error(`Error setting volume to ${volume}:`, error);
    return false;
  }
}

/**
 * Get the current playback status
 * @returns Playback status object
 */
export function getPlaybackStatus(): {
  isPlaying: boolean;
  currentTrack: Track | null;
  position: number;
  duration: number;
  volume: number;
  queue: string[];
  queueIndex: number;
} {
  return currentState;
}

/**
 * Clean up resources when the app is closing
 */
export function cleanupPlayback(): void {
  if (positionUpdateInterval) {
    clearInterval(positionUpdateInterval);
    positionUpdateInterval = null;
  }
}
