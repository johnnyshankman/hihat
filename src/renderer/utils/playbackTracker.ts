/**
 * Playback Tracker Utility
 *
 * This module provides intelligence for tracking song playbacks and
 * determining when to count a song as "played" for playcount purposes.
 *
 * Following Spotify/Tidal's approach, a song is only counted as played
 * if the user listens to at least 30 seconds of it, cumulatively.
 */

/**
 * Class to track playback for accurate play counts
 */
export class PlaybackTracker {
  // The current track being tracked
  private currentTrackId: string | null = null;

  // Map to track accumulated listen time for each track
  private listenTimeMap: Map<string, number> = new Map();

  // Threshold in seconds to count a song as played (30 seconds)
  private readonly PLAY_COUNT_THRESHOLD = 30;

  // Has the current track already hit the threshold and been counted?
  private hasCurrentTrackBeenCounted = false;

  /**
   * Start tracking a new track
   * @param trackId - ID of the track to track
   */
  public startTrackingTrack(trackId: string): void {
    // Reset the counted flag for the new track
    this.hasCurrentTrackBeenCounted = false;

    // If this is a new track, start tracking it
    if (this.currentTrackId !== trackId) {
      this.currentTrackId = trackId;

      // Initialize listen time if this is the first time we've seen this track
      if (!this.listenTimeMap.has(trackId)) {
        this.listenTimeMap.set(trackId, 0);
      }

      // eslint-disable-next-line no-console
      console.log(
        `PlaybackTracker: Started tracking playback for track ${trackId}`,
      );
    }
  }

  /**
   * Update the accumulated listen time for a track
   * @param trackId - ID of the track
   * @param secondsListened - Additional seconds listened
   * @returns Whether this update caused the track to cross the play count threshold
   */
  public updateListenTime(trackId: string, secondsListened: number): boolean {
    // Make sure we're tracking the right track
    if (this.currentTrackId !== trackId || this.hasCurrentTrackBeenCounted) {
      return false;
    }

    // Get current listen time
    let currentTime = this.listenTimeMap.get(trackId) || 0;

    // Add the new listening time
    currentTime += secondsListened;
    this.listenTimeMap.set(trackId, currentTime);

    // eslint-disable-next-line no-console
    console.log(
      `PlaybackTracker: Track ${trackId} has been played for ${currentTime}/${this.PLAY_COUNT_THRESHOLD} seconds`,
    );

    // Check if we've crossed the threshold
    if (
      currentTime >= this.PLAY_COUNT_THRESHOLD &&
      !this.hasCurrentTrackBeenCounted
    ) {
      this.hasCurrentTrackBeenCounted = true;
      // eslint-disable-next-line no-console
      console.log(
        `PlaybackTracker: Track ${trackId} reached the 30-second threshold!`,
      );
      return true;
    }

    return false;
  }

  /**
   * Reset tracking for a track
   * @param trackId - ID of the track to reset
   */
  public resetTrack(trackId: string): void {
    if (trackId === this.currentTrackId) {
      this.hasCurrentTrackBeenCounted = false;
    }
    this.listenTimeMap.set(trackId, 0);

    // eslint-disable-next-line no-console
    console.log(`PlaybackTracker: Reset tracking for track ${trackId}`);
  }

  /**
   * Get the current accumulated listen time for a track
   * @param trackId - ID of the track
   * @returns Accumulated listen time in seconds
   */
  public getListenTime(trackId: string): number {
    return this.listenTimeMap.get(trackId) || 0;
  }

  /**
   * Check if the current track has been counted for play count
   * @returns True if the current track has been counted
   */
  public isCurrentTrackCounted(): boolean {
    return this.hasCurrentTrackBeenCounted;
  }
}

// Create a singleton instance of the tracker
export const playbackTracker = new PlaybackTracker();

/**
 * Updates the play count for a track in the database
 * @param trackId - ID of the track to update
 */
export async function updatePlayCount(trackId: string): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log(
      `PlaybackTracker: 30-second threshold reached - updating play count for track ${trackId}`,
    );
    if (typeof window !== 'undefined' && window.electron) {
      await window.electron.tracks.updatePlayCount(
        trackId,
        new Date().toISOString(),
      );
    }
  } catch (error) {
    console.error(`Failed to update play count for track ${trackId}:`, error);
  }
}
