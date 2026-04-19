import { Gapless5 } from '@regosen/gapless-5';
import { Track } from '../../types/dbTypes';
import { getTrackUrl } from './trackSelectionUtils';

/**
 * Gapless-5's crossfade duration (milliseconds). Passed to the
 * `Gapless5` constructor as the `crossfade` option. During this window
 * the library is mid-transition between tracks and `removeTrack(0)`
 * causes the player to pause instead of continuing (see 45f4dab →
 * d931896). Any deferred cleanup must wait past this window.
 */
export const GAPLESS5_CROSSFADE_MS = 25;

/**
 * How long to wait after an auto-advance before removing the finished
 * track at queue index 0. Two crossfade durations is a comfortable
 * margin — the library's internal transition has fully settled.
 */
export const STALE_CLEANUP_DELAY_MS = GAPLESS5_CROSSFADE_MS * 2;

/**
 * Queue invariant (temporal):
 *   Steady state — Gapless-5's queue holds at most two tracks:
 *     [current, preloaded-next]
 *   Transient state — between an `autoPlayNextTrack` call and its
 *   scheduled cleanup firing (~STALE_CLEANUP_DELAY_MS later, past the
 *   GAPLESS5_CROSSFADE_MS crossfade) the queue momentarily holds three:
 *     [finished (stale), current, preloaded-next]
 *
 * The stale entry is removed by either:
 *   - the scheduled cleanup firing, OR
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

// Module-private timer handle for the pending post-crossfade cleanup.
// Lives here (not in Zustand) because it's a mutable side-effectful
// resource, not plain data. The module acts as a singleton manager:
// there is exactly one Gapless-5 player per renderer, so one handle
// suffices. Callers schedule/flush via the exported functions and
// never touch this directly.
let pendingCleanupHandle: ReturnType<typeof setTimeout> | null = null;

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
 * queue index 0 after an auto-advance. Deferred past the crossfade
 * window because removing the track mid-transition breaks Gapless-5's
 * internal state and causes the player to pause.
 *
 * Replaces any previously scheduled cleanup. Length-guarded at fire
 * time so scheduling this without a stale track pending is safe.
 */
export function scheduleStaleCleanup(player: Gapless5): void {
  if (pendingCleanupHandle !== null) {
    clearTimeout(pendingCleanupHandle);
  }
  pendingCleanupHandle = setTimeout(() => {
    pendingCleanupHandle = null;
    if (player.getTracks().length > 2) {
      player.removeTrack(0);
    }
  }, STALE_CLEANUP_DELAY_MS);
}

/**
 * Synchronously run the pending stale cleanup (if any) and cancel the
 * timer. Safe to call at any time once we're out of the auto-advance
 * crossfade window — pause and user-initiated queue mutations both
 * qualify.
 */
export function flushStaleCleanup(player: Gapless5): void {
  if (pendingCleanupHandle === null) return;
  clearTimeout(pendingCleanupHandle);
  pendingCleanupHandle = null;
  if (player.getTracks().length > 2) {
    player.removeTrack(0);
  }
}
