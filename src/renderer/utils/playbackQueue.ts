import type { BrowserFilter } from '../stores/types';

/**
 * Pure helpers for the materialized playback queue. The queue is the single
 * source of truth for what plays next: past + current + future are all
 * represented as one ordered array of track IDs with a pointer.
 *
 * No store access lives here — call sites in the playback store wrap these
 * helpers with their own side effects (Gapless5 queue updates, MediaSession,
 * play count tracking, etc).
 */

export interface QueueSourceSnapshot {
  kind: 'library' | 'playlist';
  playlistId: string | null;
  filter: BrowserFilter | null;
}

export interface QueueState {
  trackIds: string[];
  currentIndex: number;
  source: QueueSourceSnapshot | null;
}

export type RepeatMode = 'off' | 'track' | 'all';

export interface QueueOpResult {
  state: QueueState;
  changed: boolean;
}

/**
 * Two snapshots refer to the same playback context (same source / filter)
 * if they would produce identical filtered+sorted source track lists. Used
 * by selectSpecificSong to decide whether to rebuild the queue or just
 * re-pin the index.
 */
export function snapshotsEqual(
  a: QueueSourceSnapshot | null,
  b: QueueSourceSnapshot | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (a.kind !== b.kind) return false;
  if (a.playlistId !== b.playlistId) return false;
  const aArtist = a.filter?.artist ?? null;
  const bArtist = b.filter?.artist ?? null;
  const aAlbum = a.filter?.album ?? null;
  const bAlbum = b.filter?.album ?? null;
  return aArtist === bArtist && aAlbum === bAlbum;
}

function fisherYates<T>(input: readonly T[]): T[] {
  const out = [...input];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface BuildQueueOptions {
  sourceTrackIds: string[];
  startTrackId: string;
  shuffle: boolean;
  source: QueueSourceSnapshot;
}

/**
 * Build a fresh queue from a source track list.
 * - Non-shuffle: trackIds = sourceTrackIds (untouched). currentIndex points
 *   at startTrackId. If startTrackId isn't in the source (orphan track or
 *   filter mismatch), the queue contains just startTrackId.
 * - Shuffle: shuffle the source, then put startTrackId at index 0 so the
 *   user starts on the track they clicked. Past = empty, future = the rest.
 */
export function buildQueue(opts: BuildQueueOptions): QueueState {
  const { sourceTrackIds, startTrackId, shuffle, source } = opts;

  if (sourceTrackIds.length === 0) {
    return { trackIds: [startTrackId], currentIndex: 0, source };
  }

  if (!shuffle) {
    const idx = sourceTrackIds.indexOf(startTrackId);
    if (idx === -1) {
      return { trackIds: [startTrackId], currentIndex: 0, source };
    }
    return { trackIds: [...sourceTrackIds], currentIndex: idx, source };
  }

  const others = sourceTrackIds.filter((id) => id !== startTrackId);
  const shuffled = fisherYates(others);
  return {
    trackIds: [startTrackId, ...shuffled],
    currentIndex: 0,
    source,
  };
}

/**
 * Move the queue pointer forward by one. Behavior at end-of-queue:
 *   repeat='off':                 no-op (changed=false)
 *   repeat='all', shuffle=off:    wrap pointer to 0
 *   repeat='all', shuffle=on:     materialize a freshly-shuffled pass and
 *                                 append it; pointer lands on the first
 *                                 track of the new pass
 *   repeat='track':               no-op (caller handles via Gapless singleMode)
 *
 * `refreshSourceTrackIds` is invoked only on the shuffle-wrap path. Caller
 * should pass a closure that re-queries getFilteredAndSortedTrackIds for
 * the snapshot in state.source.
 */
export function advance(
  state: QueueState,
  repeatMode: RepeatMode,
  shuffleMode: boolean,
  refreshSourceTrackIds: () => string[],
): QueueOpResult {
  const { trackIds, currentIndex } = state;

  if (currentIndex < 0 || trackIds.length === 0) {
    return { state, changed: false };
  }

  if (currentIndex < trackIds.length - 1) {
    return {
      state: { ...state, currentIndex: currentIndex + 1 },
      changed: true,
    };
  }

  if (repeatMode === 'off' || repeatMode === 'track') {
    return { state, changed: false };
  }

  if (!shuffleMode) {
    return { state: { ...state, currentIndex: 0 }, changed: true };
  }

  const sourceIds = refreshSourceTrackIds();
  if (sourceIds.length === 0) return { state, changed: false };

  const freshPass = fisherYates(sourceIds);
  return {
    state: {
      ...state,
      trackIds: [...trackIds, ...freshPass],
      currentIndex: trackIds.length,
    },
    changed: true,
  };
}

/**
 * Move the queue pointer backward by one. Behavior at start-of-queue:
 *   repeat='off':                 no-op (changed=false). Caller should
 *                                 typically restart the current track.
 *   repeat='all':                 wrap pointer to last index
 *   repeat='track':               no-op
 */
export function retreat(
  state: QueueState,
  repeatMode: RepeatMode,
): QueueOpResult {
  const { trackIds, currentIndex } = state;

  if (trackIds.length === 0) return { state, changed: false };

  if (currentIndex > 0) {
    return {
      state: { ...state, currentIndex: currentIndex - 1 },
      changed: true,
    };
  }

  if (repeatMode === 'all') {
    return {
      state: { ...state, currentIndex: trackIds.length - 1 },
      changed: true,
    };
  }

  return { state, changed: false };
}

/**
 * Set currentIndex to targetIndex. Out-of-range targets are no-ops. Used by
 * the PlaybackQueue view's double-click handler.
 */
export function jumpTo(state: QueueState, targetIndex: number): QueueState {
  if (targetIndex < 0 || targetIndex >= state.trackIds.length) return state;
  if (targetIndex === state.currentIndex) return state;
  return { ...state, currentIndex: targetIndex };
}

/**
 * Reshuffle everything strictly after currentIndex. Past + current stay
 * intact (history is immutable). Used when toggling shuffle ON mid-playback.
 */
export function reshuffleFuture(state: QueueState): QueueState {
  const { trackIds, currentIndex } = state;
  if (currentIndex < 0 || currentIndex >= trackIds.length - 1) return state;

  const past = trackIds.slice(0, currentIndex + 1);
  const future = trackIds.slice(currentIndex + 1);
  return { ...state, trackIds: [...past, ...fisherYates(future)] };
}

/**
 * Re-sort everything strictly after currentIndex into source order. Past +
 * current stay intact. Used when toggling shuffle OFF mid-playback.
 *
 * Tracks that are in the queue's future but not in sourceOrder are dropped
 * (e.g. source list changed). Tracks in sourceOrder but not yet in the
 * queue are added so the user can keep navigating the rest of the source.
 * Past tracks are kept as-is regardless.
 */
export function unshuffleFuture(
  state: QueueState,
  sourceOrder: string[],
): QueueState {
  const { trackIds, currentIndex } = state;
  if (currentIndex < 0) return state;

  const past = trackIds.slice(0, currentIndex + 1);
  const pastSet = new Set(past);
  const future = sourceOrder.filter((id) => !pastSet.has(id));
  return { ...state, trackIds: [...past, ...future] };
}

/**
 * Drop track IDs that no longer exist in the library. Re-pin currentIndex.
 *
 * - currentTrack survives → index adjusted to its new position.
 * - currentTrack was deleted → index advances to the next surviving track
 *   (forward search first, then backward fallback). Caller is responsible
 *   for restarting Gapless from the new current track.
 * - Whole queue is wiped → returns { trackIds: [], currentIndex: -1 }.
 */
export function syncWithLibrary(
  state: QueueState,
  validIds: ReadonlySet<string>,
): QueueState {
  const { trackIds, currentIndex } = state;
  if (trackIds.length === 0) return state;

  const indexMap: number[] = new Array(trackIds.length);
  const survived: string[] = [];
  for (let i = 0; i < trackIds.length; i += 1) {
    if (validIds.has(trackIds[i])) {
      indexMap[i] = survived.length;
      survived.push(trackIds[i]);
    } else {
      indexMap[i] = -1;
    }
  }

  if (survived.length === 0) {
    return { ...state, trackIds: [], currentIndex: -1 };
  }

  let newCurrentIndex = -1;
  if (currentIndex >= 0 && currentIndex < trackIds.length) {
    if (indexMap[currentIndex] !== -1) {
      newCurrentIndex = indexMap[currentIndex];
    } else {
      for (let i = currentIndex + 1; i < trackIds.length; i += 1) {
        if (indexMap[i] !== -1) {
          newCurrentIndex = indexMap[i];
          break;
        }
      }
      if (newCurrentIndex === -1) {
        for (let i = currentIndex - 1; i >= 0; i -= 1) {
          if (indexMap[i] !== -1) {
            newCurrentIndex = indexMap[i];
            break;
          }
        }
      }
    }
  }

  if (newCurrentIndex === -1) newCurrentIndex = 0;

  return { ...state, trackIds: survived, currentIndex: newCurrentIndex };
}

/**
 * Remove the track at the given index. Used by the PlaybackQueue view's
 * "Remove from Queue" action.
 *
 *   index < currentIndex:  decrement currentIndex (past entry gone).
 *   index === currentIndex: index stays put — it now points at what was
 *     index+1, which is the natural skip-next behavior. Caller should
 *     restart playback from the new current track. If the removed track
 *     was the last in the queue, currentIndex moves backward to keep
 *     pointing at a valid entry.
 *   index > currentIndex:  no pointer change.
 */
export function removeAt(state: QueueState, index: number): QueueState {
  const { trackIds, currentIndex } = state;
  if (index < 0 || index >= trackIds.length) return state;

  const newTrackIds = [
    ...trackIds.slice(0, index),
    ...trackIds.slice(index + 1),
  ];

  let newCurrentIndex = currentIndex;
  if (index < currentIndex) {
    newCurrentIndex = currentIndex - 1;
  } else if (index === currentIndex && currentIndex >= newTrackIds.length) {
    newCurrentIndex = newTrackIds.length - 1;
  }

  return { ...state, trackIds: newTrackIds, currentIndex: newCurrentIndex };
}

/**
 * Returns the track ID that would play immediately after the current one,
 * without mutating queue state. Used to pre-load Gapless5's +1 slot for
 * gapless transitions.
 *
 * Returns null when:
 *   - queue is empty / not started
 *   - end-of-queue with repeat='off'
 *   - end-of-queue with repeat='all' + shuffle (the wrap is non-deterministic
 *     so we don't pre-load; autoPlayNextTrack materializes it on demand,
 *     accepting a tiny load delay between wrap passes)
 */
export function peekNext(
  state: QueueState,
  repeatMode: RepeatMode,
  shuffleMode: boolean,
): string | null {
  const { trackIds, currentIndex } = state;
  if (currentIndex < 0 || trackIds.length === 0) return null;

  if (repeatMode === 'track') return trackIds[currentIndex];

  if (currentIndex < trackIds.length - 1) {
    return trackIds[currentIndex + 1];
  }

  if (repeatMode === 'all' && !shuffleMode) {
    return trackIds[0];
  }

  return null;
}
