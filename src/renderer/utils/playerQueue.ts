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
 * KNOWN LEAK: after each `autoPlayNextTrack` the queue actually holds
 * three or more entries — the finished track at index N-1, the now-playing
 * track at index N, and the new preload at index N+1. The obvious fix
 * (remove index 0 after Gapless-5 auto-advances) was attempted and
 * reverted in 45f4dab / d931896: removing a track mid-transition
 * triggers a Gapless-5 bug where the player pauses instead of
 * continuing auto-play. Until the upstream library is patched we
 * accept the leak. Functional impact is nil — Gapless-5 tracks its
 * own index and plays the right song — but this assertion will spam
 * the console in dev. loadLimit:3 caps actually-decoded audio memory;
 * only the URL list grows unbounded.
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
 * In `autoPlayNextTrack` this helper is invoked after Gapless-5 has
 * already auto-advanced past a finished track, so the finished track
 * still lingers at index 0 and we end up at length 3. See the leak
 * note on `assertQueueInvariant` — we intentionally leave the stale
 * track in place because removing it during a transition breaks
 * Gapless-5's auto-play.
 */
export function preloadNextInQueue(player: Gapless5, next: Track): void {
  player.addTrack(getTrackUrl(next.filePath));
  assertQueueInvariant(player);
}
