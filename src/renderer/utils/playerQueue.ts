import { Gapless5 } from '@regosen/gapless-5';
import { Track } from '../../types/dbTypes';
import { getTrackUrl } from './trackSelectionUtils';

/**
 * Queue invariant (temporal):
 *   Steady state — Gapless-5's queue holds at most two tracks:
 *     [current, preloaded-next]
 *   Transient state — between an `autoPlayNextTrack` call and its
 *   scheduled cleanup firing (~50ms later, past the 25ms crossfade)
 *   the queue momentarily holds three tracks:
 *     [finished (stale), current, preloaded-next]
 *
 * The stale entry is removed by either:
 *   - `scheduleStaleCleanup` firing ~50ms after the auto-advance, OR
 *   - `flushStaleCleanup` running synchronously on pause or on any
 *     user-initiated queue mutation (skip next/prev, selectSpecificSong).
 *
 * We intentionally do NOT assert length <= 2 synchronously: the
 * transient 3-track window is expected after every auto-advance, so a
 * sync assertion would spam the console without signal. The scheduled
 * cleanup's own `length > 2` guard is the only runtime check; beyond
 * that we rely on the regression spec
 * (`e2e/playback-autoplay-skip.spec.ts`) to verify that queue length
 * returns to 2 after an autoplay settles.
 */

export interface SyncPlayerQueueOptions {
  current: Track;
  next: Track | null | undefined;
  shouldPlay: boolean;
  pauseBeforeLoad?: boolean;
}

/**
 * Rebuild Gapless-5's internal queue to hold the current track (index 0)
 * and optionally a preloaded next track (index 1). Post-state is
 * length 1 or 2.
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
}

/**
 * Preload a single next track into Gapless-5 at queue index 1.
 * Assumes index 0 already holds a currently-playing track.
 *
 * In `autoPlayNextTrack` this runs right after Gapless-5 auto-advanced,
 * so the finished track still lingers at index 0 and the queue
 * momentarily has length 3. `scheduleStaleCleanup` is the companion
 * call that drops that finished entry past the crossfade window.
 *
 * In `skipToNextTrack`'s fast path, cleanup is already flushed before
 * this runs, so post-state is length 2.
 */
export function preloadNextInQueue(player: Gapless5, next: Track): void {
  player.addTrack(getTrackUrl(next.filePath));
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
