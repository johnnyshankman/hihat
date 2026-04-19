import { Gapless5 } from '@regosen/gapless-5';
import { Track } from '../../types/dbTypes';
import { getTrackUrl } from './trackSelectionUtils';

export interface SyncPlayerQueueOptions {
  current: Track;
  next: Track | null | undefined;
  shouldPlay: boolean;
  pauseBeforeLoad?: boolean;
}

/**
 * Dev-only sanity check that the Gapless-5 queue hasn't grown past
 * the two-slot invariant (current + preloaded-next).
 *
 * Brief length-3 window: after an `autoPlayNextTrack` the queue momentarily
 * holds [finished, current, preloaded]. `scheduleStaleCleanup` drops the
 * finished entry ~50ms later (safely past Gapless-5's 25ms crossfade) or
 * immediately on pause, whichever comes first. If this assertion trips at
 * steady state rather than in that transient window, it means a cleanup
 * was missed somewhere.
 */
function assertQueueInvariant(player: Gapless5): void {
  if (process.env.NODE_ENV === 'production') return;
  const { length } = player.getTracks();
  if (length > 2) {
    console.error(
      `[playerQueue] invariant violation: Gapless-5 holds ${length} tracks, expected <= 2`,
    );
  }
}

/**
 * Rebuild Gapless-5's internal queue to hold the current track (index 0)
 * and optionally a preloaded next track (index 1).
 *
 * Gapless-5 is a controlled component: this helper is the single place
 * allowed to call removeAllTracks + addTrack in sequence. The Zustand
 * store holds the authoritative queue state; Gapless-5 merely mirrors
 * what the store tells it.
 */
export function syncPlayerQueue(
  player: Gapless5,
  { current, next, shouldPlay, pauseBeforeLoad }: SyncPlayerQueueOptions,
): void {
  if (pauseBeforeLoad) {
    player.pause();
  }
  player.removeAllTracks();
  player.addTrack(getTrackUrl(current.filePath));
  if (next) {
    player.addTrack(getTrackUrl(next.filePath));
  }
  if (shouldPlay) {
    player.play();
  }
  assertQueueInvariant(player);
}

/**
 * Preload a single next track into Gapless-5 at queue index 1.
 * Assumes index 0 already holds a currently-playing track.
 *
 * In `autoPlayNextTrack` this runs right after Gapless-5 auto-advanced,
 * so the finished track still lingers at index 0 and the queue
 * momentarily has length 3. `scheduleStaleCleanup` is the companion
 * call that drops that finished entry past the crossfade window.
 */
export function preloadNextInQueue(player: Gapless5, next: Track): void {
  player.addTrack(getTrackUrl(next.filePath));
  assertQueueInvariant(player);
}

/**
 * Schedule removal of the stale finished track that Gapless-5 leaves at
 * queue index 0 after an auto-advance. Deferred past the 25ms crossfade
 * window because removing the track mid-transition breaks Gapless-5's
 * internal state and causes the player to pause (see 45f4dab → d931896).
 *
 * Length-guarded at fire time so scheduling this without a stale track
 * pending is safe. Callers must store the returned handle in
 * `pendingStaleCleanupTimeout` and flush it via `flushStaleCleanup` on
 * pause or any queue-mutating user action.
 */
export function scheduleStaleCleanup(
  player: Gapless5,
): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    if (player.getTracks().length > 2) {
      player.removeTrack(0);
    }
  }, 50);
}

/**
 * Synchronously run the pending stale cleanup (if any) and cancel the
 * timer. Safe to call at any time once we're out of the auto-advance
 * crossfade window — pause and user-initiated queue mutations both
 * qualify.
 */
export function flushStaleCleanup(
  player: Gapless5,
  handle: ReturnType<typeof setTimeout> | null,
): void {
  if (handle === null) return;
  clearTimeout(handle);
  if (player.getTracks().length > 2) {
    player.removeTrack(0);
  }
}
