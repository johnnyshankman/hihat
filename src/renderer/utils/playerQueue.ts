import { Gapless5 } from '@regosen/gapless-5';
import { Track } from '../../types/dbTypes';
import { getTrackUrl } from './trackSelectionUtils';

export interface SyncPlayerQueueOptions {
  current: Track;
  next: Track | null | undefined;
  shouldPlay: boolean;
  pauseBeforeLoad?: boolean;
}

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
 */
export function preloadNextInQueue(player: Gapless5, next: Track): void {
  player.addTrack(getTrackUrl(next.filePath));
  assertQueueInvariant(player);
}
