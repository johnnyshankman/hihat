/* eslint-disable jsx-a11y/media-has-caption */
import React, { useState, useRef, useEffect } from 'react';
import { useResizeDetector } from 'react-resize-detector';
import useMainStore from '../store/main';
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
  /**
   * @dev external hooks
   */
  const { width, height, ref } = useResizeDetector();

  /**
   * @dev main store hooks
   */
  const setLibraryInStore = useMainStore((store) => store.setLibrary);
  const setInitialized = useMainStore((store) => store.setInitialized);
  const currentSong = useMainStore((store) => store.currentSong);
  const player = useMainStore((store) => store.player);
  const setPaused = useMainStore((store) => store.setPaused);
  const paused = useMainStore((store) => store.paused);
  const autoPlayNextSong = useMainStore((store) => store.autoPlayNextSong);
  const playPreviousSong = useMainStore((store) => store.playPreviousSong);
  const setFilteredLibrary = useMainStore((store) => store.setFilteredLibrary);
  const selectSpecificSong = useMainStore((store) => store.selectSpecificSong);
  const setCurrentSongTime = useMainStore((store) => store.setCurrentSongTime);
  const setOverrideScrollToIndex = useMainStore(
    (store) => store.setOverrideScrollToIndex,
  );
  const skipToNextSong = useMainStore((store) => store.skipToNextSong);
  const setVolume = useMainStore((store) => store.setVolume);
  const increasePlayCountOfSong = useMainStore(
    (store) => store.increasePlayCountOfSong,
  );
  const setHasIncreasedPlayCount = useMainStore(
    (store) => store.setHasIncreasedPlayCount,
  );
  const hasIncreasedPlayCount = useMainStore(
    (store) => store.hasIncreasedPlayCount,
  );

  /**
   * @dev component state
   */
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
    totalSongs: 1,
    estimatedTimeRemainingString: '',
  });
  const [showAlbumArtMenu, setShowAlbumArtMenu] = useState<AlbumArtMenuState>();

  /**
   * @dev components refs
   */
  const importNewSongsButtonRef = useRef<HTMLDivElement>(null);

  const importNewLibrary = async (rescan = false) => {
    setDialogState((prev) => ({ ...prev, showImportingProgress: true }));

    setImportState((prev) => ({
      ...prev,
      songsImported: 0,
      totalSongs: 1,
    }));

    window.electron.ipcRenderer.sendMessage('select-library', {
      rescan,
    });

    window.electron.ipcRenderer.on('song-imported', (args) => {
      setImportState((prev) => ({
        ...prev,
        songsImported: args.songsImported,
        totalSongs: args.totalSongs,
      }));

      // Average time per song based on testing:
      // - ~3ms for metadata parsing
      // - ~6ms for file copy (if needed)
      // - ~1ms overhead
      const avgTimePerSong = 10; // milliseconds
      const estimatedTimeRemaining = Math.floor(
        (args.totalSongs - args.songsImported) * avgTimePerSong,
      );

      const minutes = Math.floor(estimatedTimeRemaining / 60000);
      const seconds = Math.floor((estimatedTimeRemaining % 60000) / 1000);

      const timeRemainingString =
        // eslint-disable-next-line no-nested-ternary
        minutes < 1
          ? seconds === 0
            ? 'Processing Metadata...'
            : `${seconds}s left`
          : `${minutes}m ${seconds}s left`;

      setImportState((prev) => ({
        ...prev,
        estimatedTimeRemainingString: timeRemainingString,
      }));
    });

    window.electron.ipcRenderer.once('select-library', (store) => {
      if (store) {
        setLibraryInStore(store.library);
        setFilteredLibrary(store.library);
      }
      setDialogState((prev) => ({ ...prev, showImportingProgress: false }));
    });
  };

  /**
   * Set up event listeners for the main process to communicate with the renderer
   * process. Also set up window event listeners for custom events from the
   * renderer process.
   */
  useEffect(() => {
    const handlers = {
      initialize: (arg: ResponseArgs['initialize']) => {
        setInitialized(true);
        setLibraryInStore(arg.library);
        setFilteredLibrary(arg.library);
        if (arg.lastPlayedSong) {
          const songIndex = Object.keys(arg.library).findIndex(
            (song) => song === arg.lastPlayedSong,
          );
          selectSpecificSong(arg.lastPlayedSong, arg.library);
          setOverrideScrollToIndex(songIndex);
        }

        player.onfinishedtrack = autoPlayNextSong;
        // /**
        //  * @important throttle this to once every 500ms
        //  * to keep from updating the store too often causing
        //  * react to re-render too much.
        //  * @todo: this could be moved to the static player component
        //  */
        // player.ontimeupdate = (() => {
        //   let lastUpdate = 0;
        //   return (currentTrackTime: number, _currentTrackIndex: number) => {
        //     const now = Date.now();
        //     if (now - lastUpdate >= 500) {
        //       setCurrentSongTime(currentTrackTime / 1000);
        //       lastUpdate = now;
        //     }
        //   };
        // })();

        setPaused(true);
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
      'menu-quiet-mode': () => {
        setVolume(2);
      },
    };

    Object.entries(handlers).forEach(([event, handler]) => {
      window.electron.ipcRenderer.on(event as Channels, handler as any);
    });

    window.addEventListener('toggle-browser-view', () => {
      setDialogState((prev) => ({ ...prev, showBrowser: true }));
    });

    return () => {
      // Cleanup handlers if needed in the future here
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * @dev Since we are using Gapless5, we need to handle the media session
   * manually and ensure that the audio plays + pauses as expected.
   * We loop a blank audio file to keep the media session alive indefinitely.
   * We play and pause the blank audio file in time with the gapless5 player
   * so that all the smoke and mirrors are in sync. The only caveat is that
   * scrubbing through the song from the media session will do nothing.
   */
  useEffect(() => {
    navigator.mediaSession.setActionHandler('previoustrack', playPreviousSong);
    navigator.mediaSession.setActionHandler('nexttrack', skipToNextSong);
    navigator.mediaSession.setActionHandler('play', () => {
      setPaused(false);
      document.querySelector('audio')?.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      setPaused(true);
      document.querySelector('audio')?.pause();
    });
    navigator.mediaSession.setPositionState({
      duration: 0,
      playbackRate: 1,
      position: 0,
    });
  }, [paused, skipToNextSong, playPreviousSong, setPaused]);

  /**
   * @important this handles the play count incrementing.
   * if the song has ever played passed the 10 second mark,
   * we increment the play count.
   * @caveat this means that if the user skips to the 20s mark and then
   * plays the song for 1s, it will increment the play count.
   * @note this is based on an avg of spotiy vs apple music vs old itunes.
   * old itunes did it instantly on start, spotify requires 30 seconds of playing, and
   * apple music works like my algorithm but with a 20s threshold (0 to 19s = skip)
   * @important we manually unset the hasIncreasedPlayCount flag
   * from the store when the user hits next, selects a new song, etc.
   */
  useEffect(() => {
    let lastUpdate = 0;

    player.ontimeupdate = (
      currentTrackTime: number,
      _currentTrackIndex: number,
    ) => {
      const now = Date.now();
      if (now - lastUpdate >= 500) {
        setCurrentSongTime(currentTrackTime / 1000);

        // Increase play count once when song passes 10 second mark
        if (
          !hasIncreasedPlayCount &&
          currentTrackTime >= 10000 &&
          currentSong &&
          !paused
        ) {
          increasePlayCountOfSong(currentSong);
          setHasIncreasedPlayCount(true);
        }

        lastUpdate = now;
      }
    };
  }, [
    currentSong,
    increasePlayCountOfSong,
    player,
    setCurrentSongTime,
    setHasIncreasedPlayCount,
    hasIncreasedPlayCount,
    paused,
  ]);

  return (
    <div ref={ref} className="h-full flex flex-col dark">
      <audio
        autoPlay={!paused && !!currentSong}
        loop
        src="https://github.com/anars/blank-audio/raw/refs/heads/master/2-minutes-and-30-seconds-of-silence.mp3"
      />
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

          {width && <LibraryList onImportLibrary={importNewLibrary} />}

          <StaticPlayer
            playNextSong={skipToNextSong}
            playPreviousSong={playPreviousSong}
          />
        </WindowDimensionsProvider>
      )}
    </div>
  );
}
