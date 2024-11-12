/* eslint-disable jsx-a11y/media-has-caption */
import React, { useState, useRef, useEffect } from 'react';
import { useResizeDetector } from 'react-resize-detector';
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
  const importNewSongsButtonRef = useRef<HTMLDivElement>(null);

  // Main store hooks
  const storeLibrary = useMainStore((store) => store.library);
  const setLibraryInStore = useMainStore((store) => store.setLibrary);
  const setLastPlayedSong = useMainStore((store) => store.setLastPlayedSong);
  const setInitialized = useMainStore((store) => store.setInitialized);

  // Player store hooks
  const player = usePlayerStore((store) => store.player);
  const paused = usePlayerStore((store) => store.paused);
  const autoPlayNextSong = usePlayerStore((store) => store.autoPlayNextSong);
  const shuffle = usePlayerStore((store) => store.shuffle);
  const repeating = usePlayerStore((store) => store.repeating);
  const currentSong = usePlayerStore((store) => store.currentSong);
  const shuffleHistory = usePlayerStore((store) => store.shuffleHistory);
  const setShuffleHistory = usePlayerStore((store) => store.setShuffleHistory);
  const selectSpecificSong = usePlayerStore(
    (store) => store.selectSpecificSong,
  );
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
  const playNextSong = usePlayerStore((store) => store.playNextSong);

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

  const playSpecificSong = async (song: string) => {
    selectSpecificSong(song, storeLibrary);
    // update internal store and user config to store the last played song
    // @note: putting it in the current store doesnt really do anything...
    setLastPlayedSong(song);
    window.electron.ipcRenderer.sendMessage('set-last-played-song', song);
  };

  const playPreviousSong = async () => {
    if (!filteredLibrary) return;

    const keys = Object.keys(filteredLibrary);
    const currentIndex = keys.indexOf(currentSong || '');

    // repeating case, start the song over
    if (repeating) {
      player.cue();
      return;
    }

    // if the song is less than 2 seconds in, start it over
    if (!paused && currentSongTime < 2) {
      player.cue();
      return;
    }

    // shuffle case
    if (shuffle && shuffleHistory.length > 0) {
      const previousSong = shuffleHistory[shuffleHistory.length - 1];
      await playSpecificSong(previousSong);
      setOverrideScrollToIndex(keys.indexOf(previousSong));
      setShuffleHistory(shuffleHistory.slice(0, -1));
      return;
    }

    const prevIndex = currentIndex - 1 < 0 ? keys.length - 1 : currentIndex - 1;
    const prevSong = keys[prevIndex];
    await playSpecificSong(prevSong);
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
          const songIndex = Object.keys(arg.library).findIndex(
            (song) => song === arg.lastPlayedSong,
          );
          selectSpecificSong(arg.lastPlayedSong, arg.library);
          setOverrideScrollToIndex(songIndex);
        }

        /**
         * @important throttle this to once every 500ms
         * to keep from updating the store too often causing
         * react to re-render too much.
         * @todo: this could be moved to the static player component
         */
        player.ontimeupdate = (() => {
          let lastUpdate = 0;
          return (currentTrackTime: number, _currentTrackIndex: number) => {
            const now = Date.now();
            if (now - lastUpdate >= 500) {
              setCurrentSongTime(currentTrackTime / 1000);
              lastUpdate = now;
            }
          };
        })();

        // todo: untested
        player.onfinishedtrack = autoPlayNextSong;
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
              playSong={async (song) => {
                playSpecificSong(song);
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
