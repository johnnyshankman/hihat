/* eslint-disable jsx-a11y/media-has-caption */
import React, { useState, useRef, useEffect } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import { Gapless5 } from '@regosen/gapless-5';
import { LightweightAudioMetadata } from '../../common/common';
import useMainStore from '../store/main';
import usePlayerStore from '../store/player';
import LibraryList from './LibraryList';
import StaticPlayer from './StaticPlayer';
import BackupConfirmationDialog from './Dialog/BackupConfirmationDialog';
import ConfirmDedupingDialog from './Dialog/ConfirmDedupingDialog';
import BackingUpLibraryDialog from './Dialog/BackingUpLibraryDialog';
import DedupingProgressDialog from './Dialog/DedupingProgressDialog';
import ImportProgressDialog from './Dialog/ImportProgressDialog';
import AlbumArt from './AlbumArt';
import ImportNewSongsButton from './ImportNewSongsButtons';
import SearchBar from './SearchBar';
import Browser from './Browser';
import { WindowDimensionsProvider } from '../hooks/useWindowDimensions';
import { Channels, ResponseArgs } from '../../main/preload';

type AlbumArtMenuState = { mouseX: number; mouseY: number } | undefined;

export default function Main() {
  const { width, height, ref } = useResizeDetector();
  const audioTagRef = useRef<HTMLAudioElement>(null);
  const importNewSongsButtonRef = useRef<HTMLDivElement>(null);

  // Main store hooks
  const storeLibrary = useMainStore((store) => store.library);
  const setLibraryInStore = useMainStore((store) => store.setLibrary);
  const setLastPlayedSong = useMainStore((store) => store.setLastPlayedSong);
  const setInitialized = useMainStore((store) => store.setInitialized);

  // Player store hooks
  const player = usePlayerStore((store) => store.player);
  const paused = usePlayerStore((store) => store.paused);
  const setPaused = usePlayerStore((store) => store.setPaused);
  const shuffle = usePlayerStore((store) => store.shuffle);
  const repeating = usePlayerStore((store) => store.repeating);
  const currentSong = usePlayerStore((store) => store.currentSong);
  const shuffleHistory = usePlayerStore((store) => store.shuffleHistory);
  const setShuffleHistory = usePlayerStore((store) => store.setShuffleHistory);
  const currentSongMetadata = usePlayerStore(
    (store) => store.currentSongMetadata,
  );
  const setCurrentSong = usePlayerStore((store) => store.setCurrentSong);
  const filteredLibrary = usePlayerStore((store) => store.filteredLibrary);
  const setFilteredLibrary = usePlayerStore(
    (store) => store.setFilteredLibrary,
  );
  const currentSongTime = usePlayerStore((store) => store.currentSongTime);
  const setCurrentSongTime = usePlayerStore(
    (store) => store.setCurrentSongTime,
  );
  const setOverrideScrollToIndex = usePlayerStore(
    (store) => store.setOverrideScrollToIndex,
  );

  // Component state
  const [dialogState, setDialogState] = useState({
    showImportingProgress: false,
    showDedupingProgress: false,
    showConfirmDedupeAndDelete: false,
    showBackupConfirmation: false,
    showBackingUpLibrary: false,
    showBrowser: false,
  });
  const [importState, setImportState] = useState({
    songsImported: 0,
    totalSongs: 0,
    estimatedTimeRemainingString: '',
  });
  const [showAlbumArtMenu, setShowAlbumArtMenu] = useState<AlbumArtMenuState>();

  const playSong = async (song: string, meta: LightweightAudioMetadata) => {
    const mediaData = {
      title: meta.common.title,
      artist: meta.common.artist,
      album: meta.common.album,
    };

    if (navigator.mediaSession.metadata) {
      Object.assign(navigator.mediaSession.metadata, mediaData);
    } else {
      navigator.mediaSession.metadata = new MediaMetadata(mediaData);
    }

    setCurrentSong(song, storeLibrary);
    setLastPlayedSong(song);
    setPaused(false);
    player.play();

    window.electron.ipcRenderer.once('set-last-played-song', (args) => {
      const newLibrary = { ...storeLibrary, [args.song]: args.songData };
      setLibraryInStore(newLibrary);
      setFilteredLibrary({ ...filteredLibrary, [args.song]: args.songData });
    });

    console.log('tracks', player.getTracks());

    window.electron.ipcRenderer.sendMessage('set-last-played-song', song);

    if (!filteredLibrary) return;

    const keys = Object.keys(filteredLibrary);
    const currentIndex = keys.indexOf(currentSong || '');

    if (repeating && currentSong && currentSongMetadata) {
      player.addTrack(`my-magic-protocol://getMediaFile/${currentSong}`);
      return;
    }

    if (shuffle) {
      const randomIndex = Math.floor(Math.random() * keys.length);
      const randomSong = keys[randomIndex];
      setOverrideScrollToIndex(randomIndex);
      setShuffleHistory([...shuffleHistory, currentSong]);
      player.addTrack(`my-magic-protocol://getMediaFile/${randomSong}`);
      return;
    }

    const nextIndex = currentIndex + 1 >= keys.length ? 0 : currentIndex + 1;
    const nextSong = keys[nextIndex];
    player.addTrack(`my-magic-protocol://getMediaFile/${nextSong}`);

    // @note: if the user updates the repeating, shuffle, or updates
    // the current filters, we need to clear the 1st (not 0th) track
    // in the queue and replace it with the next song
    // i have not done this yet
  };

  const startCurrentSongOver = () =>
    // eslint-disable-next-line consistent-return
    new Promise((resolve, reject) => {
      // eslint-disable-next-line no-promise-executor-return
      if (!currentSong || !currentSongMetadata) return reject();
      setCurrentSong('', filteredLibrary);
      setTimeout(() => {
        playSong(currentSong, currentSongMetadata);
        resolve(null);
      }, 10);
    });

  const playNextSong = async () => {
    player.next(0, 0, 0);
    player.removeTrack(0);
    console.log(player.getTracks());
    // queue up the next song
    // logically im fucked rn bc what i should do is when
    // the user selects a song, we queue up the next song
    // using add track
    // that way this actually doesn't need to do any of the next song
    // handling besides next, and remove track calls
    // the logic for putting the next song in the queue should be
    // earlier
  };

  const playPreviousSong = async () => {
    if (!filteredLibrary) return;

    if (!paused && currentSong && currentSongMetadata && currentSongTime > 2) {
      await startCurrentSongOver();
      return;
    }

    const keys = Object.keys(filteredLibrary);
    const currentIndex = keys.indexOf(currentSong || '');

    if (repeating && currentSong && currentSongMetadata) {
      await startCurrentSongOver();
      return;
    }

    if (shuffle && shuffleHistory.length > 0) {
      const previousSong = shuffleHistory[shuffleHistory.length - 1];
      await playSong(previousSong, filteredLibrary[previousSong]);
      setOverrideScrollToIndex(keys.indexOf(previousSong));
      setShuffleHistory(shuffleHistory.slice(0, -1));
      return;
    }

    const prevIndex = currentIndex - 1 < 0 ? keys.length - 1 : currentIndex - 1;
    const prevSong = keys[prevIndex];
    await playSong(prevSong, filteredLibrary[prevSong]);
  };

  const importNewLibrary = async (rescan = false) => {
    setDialogState((prev) => ({ ...prev, showImportingProgress: true }));

    window.electron.ipcRenderer.sendMessage('select-library', {
      rescan,
    });

    window.electron.ipcRenderer.on('song-imported', (args) => {
      setImportState((prev) => ({
        ...prev,
        songsImported: args.songsImported,
        totalSongs: args.totalSongs,
      }));

      // Calculate estimated time remaining
      const timePerSong = 0.1; // seconds per song (approximate)
      const remainingSongs = args.totalSongs - args.songsImported;
      const estimatedSeconds = remainingSongs * timePerSong;
      const minutes = Math.floor(estimatedSeconds / 60);
      const seconds = Math.floor(estimatedSeconds % 60);

      setImportState((prev) => ({
        ...prev,
        estimatedTimeRemainingString: `${minutes}:${seconds
          .toString()
          .padStart(2, '0')}`,
      }));
    });

    window.electron.ipcRenderer.once('select-library', (store) => {
      // @TODO: not sure i still need this?
      setInitialized(true);

      if (store) {
        setLibraryInStore(store.library);
        setFilteredLibrary(store.library);
      }
      setDialogState((prev) => ({ ...prev, showImportingProgress: false }));
    });
  };

  useEffect(() => {
    const handlers = {
      initialize: (arg: ResponseArgs['initialize']) => {
        setInitialized(true);
        setLibraryInStore(arg.library);
        setFilteredLibrary(arg.library);
        if (arg.lastPlayedSong) {
          setCurrentSong(arg.lastPlayedSong, arg.library);
          const songIndex = Object.keys(arg.library).findIndex(
            (song) => song === arg.lastPlayedSong,
          );
          setOverrideScrollToIndex(songIndex);
        }
      },
      'update-store': (arg: ResponseArgs['update-store']) => {
        setInitialized(true);
        setDialogState((prev) => ({ ...prev, showDedupingProgress: false }));
        setLibraryInStore(arg.store.library);
        setFilteredLibrary(arg.store.library);
        if (arg.scrollToIndex) {
          setOverrideScrollToIndex(arg.scrollToIndex);
        }
      },
      'menu-toggle-browser': () => {
        setDialogState((prev) => ({ ...prev, showBrowser: true }));
      },
      'menu-select-library': () => {
        importNewLibrary();
      },
      'menu-rescan-library': () => {
        importNewLibrary(true);
      },
      'menu-add-songs': () => {
        (
          importNewSongsButtonRef.current?.firstChild as HTMLButtonElement
        )?.click();
      },
      'menu-backup-library': () => {
        setDialogState((prev) => ({ ...prev, showBackupConfirmation: true }));
      },
      'menu-delete-dupes': () => {
        setDialogState((prev) => ({
          ...prev,
          showConfirmDedupeAndDelete: true,
        }));
      },
      'menu-hide-dupes': () => {
        setDialogState((prev) => ({
          ...prev,
          showConfirmDedupeAndDelete: false,
          showDedupingProgress: true,
        }));
        window.electron.ipcRenderer.sendMessage('menu-hide-dupes');
      },
      'backup-library-success': () => {
        setDialogState((prev) => ({
          ...prev,
          showBackingUpLibrary: false,
          showBackupConfirmation: false,
        }));
      },
      'menu-reset-library': () => {
        window.electron.ipcRenderer.sendMessage('menu-reset-library');
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      window.electron.ipcRenderer.on(event as Channels, handler as any);
    });

    window.addEventListener('toggle-browser-view', () => {
      setDialogState((prev) => ({ ...prev, showBrowser: true }));
    });

    navigator.mediaSession.setActionHandler('previoustrack', playPreviousSong);
    navigator.mediaSession.setActionHandler('nexttrack', playNextSong);

    return () => {
      // Cleanup handlers if needed in the future here
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // todo: this goes off a lot
  player.ontimeupdate = (
    currentTrackTime: number,
    _currentTrackIndex: number,
  ) => {
    setCurrentSongTime(currentTrackTime / 1000);
  };

  player.onfinishedtrack = playNextSong;

  /**
   * player is the thing that:
   * - plays the song, pauses the song
   * - updates the global song time in our store
   * - holds the current song and the next song in "tracks" for gapless playback
   */

  return (
    <div ref={ref} className="h-full flex flex-col dark">
      {width && height && (
        <WindowDimensionsProvider height={height} width={width}>
          {/* Dialogs */}
          <ImportProgressDialog
            estimatedTimeRemainingString={
              importState.estimatedTimeRemainingString
            }
            open={dialogState.showImportingProgress}
            songsImported={importState.songsImported}
            totalSongs={importState.totalSongs}
          />
          <DedupingProgressDialog open={dialogState.showDedupingProgress} />
          <BackupConfirmationDialog
            onBackup={() => {
              setDialogState((prev) => ({
                ...prev,
                showBackupConfirmation: false,
                showBackingUpLibrary: true,
              }));
              window.electron.ipcRenderer.sendMessage('menu-backup-library');
            }}
            onClose={() =>
              setDialogState((prev) => ({
                ...prev,
                showBackupConfirmation: false,
              }))
            }
            open={dialogState.showBackupConfirmation}
          />
          <BackingUpLibraryDialog open={dialogState.showBackingUpLibrary} />
          <ConfirmDedupingDialog
            onClose={() =>
              setDialogState((prev) => ({
                ...prev,
                showConfirmDedupeAndDelete: false,
              }))
            }
            onConfirm={() => {
              setDialogState((prev) => ({
                ...prev,
                showConfirmDedupeAndDelete: false,
                showDedupingProgress: true,
              }));
              window.electron.ipcRenderer.sendMessage('menu-delete-dupes');
            }}
            open={dialogState.showConfirmDedupeAndDelete}
          />

          {/* Main Content */}
          <div className="flex art drag justify-center p-4 space-x-4 md:flex-row">
            <AlbumArt
              setShowAlbumArtMenu={setShowAlbumArtMenu}
              showAlbumArtMenu={showAlbumArtMenu}
            />
            <div ref={importNewSongsButtonRef}>
              <ImportNewSongsButton
                setEstimatedTimeRemainingString={(str) =>
                  setImportState((prev) => ({
                    ...prev,
                    estimatedTimeRemainingString: str,
                  }))
                }
                setShowImportingProgress={(show) =>
                  setDialogState((prev) => ({
                    ...prev,
                    showImportingProgress: show,
                  }))
                }
                setSongsImported={(num) =>
                  setImportState((prev) => ({ ...prev, songsImported: num }))
                }
                setTotalSongs={(num) =>
                  setImportState((prev) => ({ ...prev, totalSongs: num }))
                }
              />
            </div>
            <SearchBar className="absolute h-[45px] top-4 md:top-4 md:right-[4.5rem] right-4 w-auto text-white" />
          </div>

          {dialogState.showBrowser && (
            <Browser
              onClose={() =>
                setDialogState((prev) => ({ ...prev, showBrowser: false }))
              }
            />
          )}

          {width && (
            <LibraryList
              onImportLibrary={importNewLibrary}
              playSong={async (song, meta) => {
                await (currentSong === song
                  ? player.cue()
                  : playSong(song, meta));
              }}
            />
          )}

          <StaticPlayer
            playNextSong={playNextSong}
            playPreviousSong={playPreviousSong}
          />
        </WindowDimensionsProvider>
      )}
    </div>
  );
}
