/**
 * @jest-environment jsdom
 */

import type { Gapless5 } from '@regosen/gapless-5';
import useSettingsAndPlaybackStore from '../renderer/stores/settingsAndPlaybackStore';
import useLibraryStore from '../renderer/stores/libraryStore';
import { queryClient } from '../renderer/queries/client';
import { queryKeys } from '../renderer/queries/keys';
import { buildIndexes } from '../renderer/utils/trackIndexes';
import {
  clearPlayerQueue,
  preloadNextInQueue,
  removePreloadedTrack,
} from '../renderer/utils/playerQueue';
import { Track } from '../types/dbTypes';

// The Gapless-5 queue is driven through these helpers; assert on them
// rather than on a real audio engine.
jest.mock('../renderer/utils/playerQueue', () => ({
  clearPlayerQueue: jest.fn(),
  preloadNextInQueue: jest.fn(),
  removePreloadedTrack: jest.fn(),
  syncPlayerQueue: jest.fn(),
}));

const makeTrack = (id: string): Track => ({
  id,
  filePath: `/songs/${id}.mp3`,
  title: id,
  artist: '',
  album: '',
  albumArtist: '',
  genre: '',
  duration: 10,
  playCount: 0,
  dateAdded: '2025-01-01T00:00:00.000Z',
  lastPlayed: null,
  lyrics: null,
  trackNumber: null,
  totalTracks: null,
  discNumber: null,
  totalDiscs: null,
  year: null,
  bpm: null,
  composer: null,
  comment: null,
});

const setLibrary = (ids: string[]) => {
  const tracks = ids.map(makeTrack);
  queryClient.setQueryData(queryKeys.tracks, {
    tracks,
    indexes: buildIndexes(tracks),
  });
};

const player = {} as Gapless5;
const initialPlaybackState = useSettingsAndPlaybackStore.getState();
const initialLibraryState = useLibraryStore.getState();

beforeEach(() => {
  jest.clearAllMocks();
  (window as unknown as { electron: unknown }).electron = {
    settings: { update: jest.fn().mockResolvedValue(undefined) },
  };
  // Library view sorted by title so "next" is alphabetical.
  useLibraryStore.setState({
    libraryViewState: {
      sorting: [{ id: 'title', desc: false }],
      filtering: '',
    },
  } as Partial<ReturnType<typeof useLibraryStore.getState>>);
});

afterEach(() => {
  useSettingsAndPlaybackStore.setState(initialPlaybackState, true);
  useLibraryStore.setState(initialLibraryState, true);
  queryClient.removeQueries({ queryKey: queryKeys.tracks });
});

const playing = (current: string, preloaded: string | null) => {
  useSettingsAndPlaybackStore.setState({
    player,
    currentTrack: makeTrack(current),
    preloadedTrack: preloaded ? makeTrack(preloaded) : null,
    paused: false,
    playbackSource: 'library',
  });
};

describe('reconcileWithLibrary', () => {
  test('stops to the empty state when the current song is gone', () => {
    setLibrary(['a', 'c']);
    playing('b', 'c');

    useSettingsAndPlaybackStore.getState().reconcileWithLibrary();

    const state = useSettingsAndPlaybackStore.getState();
    expect(state.currentTrack).toBeNull();
    expect(state.preloadedTrack).toBeNull();
    expect(state.paused).toBe(true);
    expect(clearPlayerQueue).toHaveBeenCalledWith(player);
    expect(window.electron.settings.update).toHaveBeenCalledWith({
      lastPlayedSongId: null,
    });
  });

  test('re-preloads when a new song now sorts right after the current one', () => {
    setLibrary(['a', 'b', 'c']);
    playing('a', 'c');

    useSettingsAndPlaybackStore.getState().reconcileWithLibrary();

    expect(removePreloadedTrack).toHaveBeenCalledWith(player);
    expect(preloadNextInQueue).toHaveBeenCalledWith(
      player,
      expect.objectContaining({ id: 'b' }),
    );
    expect(useSettingsAndPlaybackStore.getState().preloadedTrack?.id).toBe('b');
  });

  test('preloads a next song when the current one used to be last', () => {
    setLibrary(['a', 'b']);
    playing('a', null);

    useSettingsAndPlaybackStore.getState().reconcileWithLibrary();

    expect(removePreloadedTrack).not.toHaveBeenCalled();
    expect(preloadNextInQueue).toHaveBeenCalledWith(
      player,
      expect.objectContaining({ id: 'b' }),
    );
  });

  test('leaves the queue alone when next-up is unchanged', () => {
    setLibrary(['a', 'b', 'c']);
    playing('a', 'b');

    useSettingsAndPlaybackStore.getState().reconcileWithLibrary();

    expect(removePreloadedTrack).not.toHaveBeenCalled();
    expect(preloadNextInQueue).not.toHaveBeenCalled();
    expect(clearPlayerQueue).not.toHaveBeenCalled();
    expect(useSettingsAndPlaybackStore.getState().currentTrack?.id).toBe('a');
  });

  test('in shuffle, keeps a still-present preload instead of re-rolling', () => {
    setLibrary(['a', 'b', 'c', 'd']);
    playing('a', 'c');
    useSettingsAndPlaybackStore.setState({ shuffleMode: true });

    useSettingsAndPlaybackStore.getState().reconcileWithLibrary();

    expect(preloadNextInQueue).not.toHaveBeenCalled();
    expect(useSettingsAndPlaybackStore.getState().preloadedTrack?.id).toBe('c');
  });

  test('in shuffle, replaces a preload that was removed', () => {
    setLibrary(['a', 'b']);
    playing('a', 'c');
    useSettingsAndPlaybackStore.setState({ shuffleMode: true });

    useSettingsAndPlaybackStore.getState().reconcileWithLibrary();

    expect(removePreloadedTrack).toHaveBeenCalledWith(player);
    expect(preloadNextInQueue).toHaveBeenCalledWith(
      player,
      expect.objectContaining({ id: 'b' }),
    );
  });

  test('prunes removed songs from shuffle history', () => {
    setLibrary(['a', 'b']);
    playing('a', 'b');
    useSettingsAndPlaybackStore.setState({
      shuffleHistory: [makeTrack('gone'), makeTrack('a')],
      shuffleHistoryPosition: 1,
    });

    useSettingsAndPlaybackStore.getState().reconcileWithLibrary();

    const state = useSettingsAndPlaybackStore.getState();
    expect(state.shuffleHistory.map((t) => t.id)).toEqual(['a']);
    expect(state.shuffleHistoryPosition).toBe(0);
  });
});
