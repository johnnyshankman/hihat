/**
 * Playback Tracker Utility
 *
 * This module provides intelligence for tracking song playbacks and
 * determining when to count a song as "played" for playcount purposes.
 *
 * Following Spotify/Tidal's approach, a song is counted as played
 * when the user listens to min(30 seconds, 20% of track duration).
 * This allows shorter songs to count plays faster while keeping
 * the 30-second cap for longer tracks.
 */

/**
 * Class to track playback for accurate play counts
 */
export class PlaybackTracker {
  // The current track being tracked
  private currentTrackId: string | null = null;

  // Map to track accumulated listen time for each track
  private listenTimeMap: Map<string, number> = new Map();

  // Maximum threshold in seconds (cap for long songs)
  private readonly MAX_PLAY_COUNT_THRESHOLD = 30;

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

      console.warn(
        `PlaybackTracker: Started tracking playback for track ${trackId}`,
      );
    }
  }

  /**
   * Update the accumulated listen time for a track
   * @param trackId - ID of the track
   * @param secondsListened - Additional seconds listened
   * @param trackDuration - Duration of the track in seconds (used to calculate dynamic threshold)
   * @returns Whether this update caused the track to cross the play count threshold
   */
  public updateListenTime(
    trackId: string,
    secondsListened: number,
    trackDuration: number,
  ): boolean {
    // Make sure we're tracking the right track
    if (this.currentTrackId !== trackId || this.hasCurrentTrackBeenCounted) {
      return false;
    }

    // Get current listen time
    let currentTime = this.listenTimeMap.get(trackId) || 0;

    // Add the new listening time
    currentTime += secondsListened;
    this.listenTimeMap.set(trackId, currentTime);

    // Calculate dynamic threshold: min(30 seconds, 20% of track duration)
    // This allows shorter songs to count plays faster while keeping the 30-second cap for longer tracks
    const threshold = Math.min(
      this.MAX_PLAY_COUNT_THRESHOLD,
      trackDuration * 0.2,
    );

    console.warn(
      `PlaybackTracker: Track ${trackId} has been played for ${currentTime}/${threshold.toFixed(1)} seconds`,
    );

    // Check if we've crossed the threshold
    if (currentTime >= threshold && !this.hasCurrentTrackBeenCounted) {
      this.hasCurrentTrackBeenCounted = true;
      console.warn(
        `PlaybackTracker: Track ${trackId} reached the ${threshold.toFixed(1)}-second threshold!`,
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

    console.warn(`PlaybackTracker: Reset tracking for track ${trackId}`);
  }
}

// Create a singleton instance of the tracker
export const playbackTracker = new PlaybackTracker();

/**
 * Updates the play count for a track in the database, optimistically
 * mirrors the change into the TanStack Query tracks cache (incl. its
 * indexes), and invalidates the playlists query so smart playlists
 * (which sort by playCount / lastPlayed) reflect the new data.
 *
 * Called from non-React code (the playback engine), so we read/write
 * the cache through the queryClient singleton rather than hooks.
 */
export async function updatePlayCount(trackId: string): Promise<void> {
  try {
    console.warn(
      `PlaybackTracker: Play count threshold reached - updating play count for track ${trackId}`,
    );

    if (typeof window === 'undefined' || !window.electron) return;

    await window.electron.tracks.updatePlayCount(
      trackId,
      new Date().toISOString(),
    );

    // Lazy import keeps this util dependency-light at module load and
    // avoids a circular import (queries/* eventually pulls in stores).
    const [{ queryClient }, { queryKeys }, { buildIndexes }] =
      await Promise.all([
        import('../queries/client'),
        import('../queries/keys'),
        import('./trackIndexes'),
      ]);

    type TracksData = {
      tracks: import('../../types/dbTypes').Track[];
      indexes: ReturnType<typeof buildIndexes>;
    };

    queryClient.setQueryData<TracksData>(queryKeys.tracks, (old) => {
      if (!old) return old;
      const idx = old.tracks.findIndex((t) => t.id === trackId);
      if (idx === -1) return old;
      const updatedTrack = {
        ...old.tracks[idx],
        playCount: (old.tracks[idx].playCount || 0) + 1,
        lastPlayed: new Date().toISOString(),
      };
      const updatedTracks = [...old.tracks];
      updatedTracks[idx] = updatedTrack;
      return { tracks: updatedTracks, indexes: buildIndexes(updatedTracks) };
    });

    // Smart playlists derive from track stats (playCount, lastPlayed),
    // so invalidating ensures the next mount of usePlaylists refetches.
    queryClient.invalidateQueries({ queryKey: queryKeys.playlists });

    console.warn(
      `PlaybackTracker: TQ tracks cache updated for play count of ${trackId}`,
    );
  } catch (error) {
    console.error(`Failed to update play count for track ${trackId}:`, error);
  }
}
