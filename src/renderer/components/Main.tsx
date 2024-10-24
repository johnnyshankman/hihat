/* eslint-disable jsx-a11y/media-has-caption */
import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useResizeDetector } from 'react-resize-detector';
import SearchIcon from '@mui/icons-material/Search';
import { LibraryAdd, LibraryMusic } from '@mui/icons-material';
import { StoreStructure, LightweightAudioMetadata } from '../../common/common';
import useMainStore from '../store/main';
import { bufferToDataUrl } from '../utils/utils';
import usePlayerStore from '../store/player';
import LibraryList from './LibraryList';
import StaticPlayer from './StaticPlayer';
import {
  Search,
  SearchIconWrapper,
  StyledInputBase,
} from './SimpleStyledMaterialUIComponents';
import BackupConfirmationDialog from './Dialog/BackupConfirmationDialog';
import ConfirmDedupingDialog from './Dialog/ConfirmDedupingDialog';
import BackingUpLibraryDialog from './Dialog/BackingUpLibraryDialog';
import DedupingProgressDialog from './Dialog/DedupingProgressDialog';
import ImportProgressDialog from './Dialog/ImportProgressDialog';
import AlbumArt from './AlbumArt';

type AlbumArtMenuState =
  | {
      mouseX: number;
      mouseY: number;
    }
  | undefined;

export default function Main() {
  /**
   * @dev external hooks
   */
  const { width, height, ref } = useResizeDetector();

  /**
   * @dev global store hooks
   */
  const storeLibrary = useMainStore((store) => store.library);
  const setLibraryInStore = useMainStore((store) => store.setLibrary);
  const setLastPlayedSong = useMainStore((store) => store.setLastPlayedSong);
  const paused = usePlayerStore((store) => store.paused);
  const setPaused = usePlayerStore((store) => store.setPaused);
  const shuffle = usePlayerStore((store) => store.shuffle);
  const repeating = usePlayerStore((store) => store.repeating);
  const currentSong = usePlayerStore((store) => store.currentSong);
  const setCurrentSong = usePlayerStore((store) => store.setCurrentSong);
  const setInitialized = useMainStore((store) => store.setInitialized);
  const setCurrentSongDataURL = usePlayerStore(
    (store) => store.setCurrentSongDataURL,
  );
  const currentSongMetadata = usePlayerStore(
    (store) => store.currentSongMetadata,
  );
  const setCurrentSongMetadata = usePlayerStore(
    (store) => store.setCurrentSongMetadata,
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

  /**
   * @dev JSX refs
   */
  const audioTagRef = useRef<HTMLAudioElement>(null);

  /**
   * @dev component state
   */
  const [rowContainerHeight, setRowContainerHeight] = useState(0);
  const [showImportingProgress, setShowImportingProgress] = useState(false);
  const [songsImported, setSongsImported] = useState(0);
  const [totalSongs, setTotalSongs] = useState(0);
  const [estimatedTimeRemainingString, setEstimatedTimeRemainingString] =
    useState('');
  const [initialScrollIndex, setInitialScrollIndex] = useState<
    number | undefined
  >(undefined);
  const [showAlbumArtMenu, setShowAlbumArtMenu] =
    useState<AlbumArtMenuState>(undefined);
  const [showDedupingProgress, setShowDedupingProgress] = useState(false);
  const [
    showConfirmDedupeAndDeleteDialog,
    setShowConfirmDedupeAndDeleteDialog,
  ] = useState(false);
  const [showBackupConfirmationDialog, setShowBackupConfirmationDialog] =
    useState(false);
  const [showBackingUpLibraryDialog, setShowBackingUpLibraryDialog] =
    useState(false);
  const [albumArtMaxWidth, setAlbumArtMaxWidth] = useState(320);

  /**
   * @def functions
   */

  /**
   * It takes the IPicture and converts it to a data url.
   * It then sets the current song data url in the player store.
   * It also sets the album art in the navigator media session metadata (if it exists).
   * @param event an IPicture
   */
  const requestAndSetAlbumArtForSong = (song: string) => {
    window.electron.ipcRenderer.sendMessage('get-album-art', song);
    window.electron.ipcRenderer.once('get-album-art', async (event) => {
      let url = '';
      // @important: handle no image metadata for file
      if (event.data) {
        url = await bufferToDataUrl(event.data, event.format);
      }

      setCurrentSongDataURL(url);
      if (navigator.mediaSession.metadata?.artwork) {
        navigator.mediaSession.metadata.artwork = [
          {
            src: url,
            sizes: '192x192',
            type: event.format,
          },
        ];
      }
    });
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    if (!storeLibrary) return;
    const filtered = Object.keys(storeLibrary).filter((song) => {
      const meta = storeLibrary[song];
      return (
        meta.common.title?.toLowerCase().includes(query.toLowerCase()) ||
        meta.common.artist?.toLowerCase().includes(query.toLowerCase()) ||
        meta.common.album?.toLowerCase().includes(query.toLowerCase())
      );
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = storeLibrary[song];
    });

    setFilteredLibrary(filteredLib);
  };

  /**
   * @dev update the current song and metadata then let the song play.
   *      in the bg request and set the album art from main process.
   *      the main process handler for the album art also saves the
   *      last played song into the userConfig for persistence.
   */
  const playSong = async (song: string, meta: LightweightAudioMetadata) => {
    if (
      navigator.mediaSession.metadata?.title &&
      meta.common.title &&
      navigator.mediaSession.metadata?.artist &&
      meta.common.artist &&
      navigator.mediaSession.metadata?.album &&
      meta.common.album
    ) {
      navigator.mediaSession.metadata.title = meta.common.title;
      navigator.mediaSession.metadata.artist = meta.common.artist;
      navigator.mediaSession.metadata.album = meta.common.album;
    } else {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: meta.common.title,
        artist: meta.common.artist,
        album: meta.common.album,
      });
    }

    setCurrentSong(song);
    setCurrentSongMetadata(meta);
    requestAndSetAlbumArtForSong(song);

    // @dev: send message that syncs the BE with the FE
    // that way on next boot we can restore the last played song
    setLastPlayedSong(song);
    window.electron.ipcRenderer.once('set-last-played-song', (args) => {
      const newLibrary = { ...storeLibrary };
      newLibrary[args.song] = args.songData;
      setLibraryInStore(newLibrary);

      const newFilteredLibrary = { ...filteredLibrary };
      newFilteredLibrary[args.song] = args.songData;
      setFilteredLibrary(newFilteredLibrary);
    });
    window.electron.ipcRenderer.sendMessage('set-last-played-song', song);

    // play the song regardless of when the main process responds
    setPaused(false);
  };

  /**
   * @dev plays a blank song THEN plays the real song
   * exactly 10ms later in order to start it over
   * from the start
   */
  const startCurrentSongOver = async () => {
    return new Promise((resolve, reject) => {
      if (currentSong && currentSongMetadata) {
        setCurrentSong('');
        window.setTimeout(() => {
          playSong(currentSong, currentSongMetadata);
          resolve(null);
        }, 10);
      } else {
        reject();
      }
    });
  };

  const playNextSong = async () => {
    if (!filteredLibrary) return;

    const keys = Object.keys(filteredLibrary);
    const currentSongIndex = keys.indexOf(currentSong || '');
    const nextSongIndex = currentSongIndex + 1;

    // @dev: if user has reached the end of their library, play 0th song
    if (nextSongIndex >= keys.length) {
      const song = keys[0];
      const songMeta = filteredLibrary[song];
      await playSong(song, songMeta);
      return;
    }

    const nextSong = keys[nextSongIndex];
    const nextSongMeta = filteredLibrary[nextSong];

    // @dev: if repeating is on, repeat the same song and return early
    if (repeating && currentSong && currentSongMetadata) {
      await startCurrentSongOver();
      return;
    }

    // @dev: if shuffle is on, pick a random song, scroll to it, and return early
    if (shuffle) {
      const randomIndex = Math.floor(Math.random() * keys.length);
      const randomSong = keys[randomIndex];
      const randomSongMeta = filteredLibrary[randomSong];
      await playSong(randomSong, randomSongMeta);
      setOverrideScrollToIndex(randomIndex);
      return;
    }

    // @dev: if neither shuffle nor repeating is on, play next song in library
    await playSong(nextSong, nextSongMeta);
  };

  const playPreviousSong = async () => {
    if (!filteredLibrary) return;

    // @dev: if the song is > 2s into playtime, just start it over.
    if (!paused && currentSong && currentSongMetadata && currentSongTime > 2) {
      await startCurrentSongOver();
      return;
    }

    const keys = Object.keys(filteredLibrary);
    const currentSongIndex = keys.indexOf(currentSong || '');
    const previousSongIndex = currentSongIndex - 1;

    // @dev: if the user has reached the beginning of their library, wrap to the end
    if (previousSongIndex < 0) {
      const lastSong = keys[keys.length - 1];
      const lastSongMeta = filteredLibrary[lastSong];
      await playSong(lastSong, lastSongMeta);
      return;
    }

    // @dev: if repeating is on, repeat the same song and return early
    if (repeating && currentSong && currentSongMetadata) {
      await startCurrentSongOver();
      return;
    }

    // @TODO: previous during shuffle does not work bc we don't hold a history of songs

    const previousSong = keys[previousSongIndex];
    const previousSongMeta = filteredLibrary[previousSong];
    await playSong(previousSong, previousSongMeta);
  };

  /**
   * @dev allow user to select a directory and import all songs within it
   */
  const importNewLibrary = async (rescan = false) => {
    // fires when one song is imported
    // used for the importing UX with progress
    window.electron.ipcRenderer.on('song-imported', (args) => {
      setShowImportingProgress(true);
      setSongsImported(args.songsImported);
      setTotalSongs(args.totalSongs);

      // @note: completion time is roughly 5ms/song
      const estimatedTimeRemaining = Math.floor(
        (args.totalSongs - args.songsImported) * 5,
      );

      // convert the estimated time from ms to a human readable format
      const minutes = Math.floor(estimatedTimeRemaining / 60000);
      const seconds = Math.floor(estimatedTimeRemaining / 1000);
      const timeRemainingString =
        // eslint-disable-next-line no-nested-ternary
        minutes < 1
          ? seconds === 0
            ? 'Processing...'
            : `${seconds}s left`
          : `${minutes}mins left`;
      setEstimatedTimeRemainingString(timeRemainingString);
    });

    // fires once the import is complete
    window.electron.ipcRenderer.once('select-library', (arg) => {
      // exit early if the user canceled or the args are malformed
      if (!arg || !arg.library) {
        setShowImportingProgress(false);
        return;
      }

      // reset the library, the filtered library
      setLibraryInStore(arg.library);
      setFilteredLibrary(arg.library);

      // set current song to the first song in the library
      const firstSong = Object.keys(arg.library)[0];
      const firstSongMeta = arg.library[firstSong];
      setCurrentSong(firstSong);
      setCurrentSongMetadata(firstSongMeta);
      requestAndSetAlbumArtForSong(firstSong);

      setPaused(true);
      setInitialScrollIndex(2);
      setShowImportingProgress(false);

      // reset the internal ux of the progress bar for next time its used
      // do it way after the importing progress dialog is closed
      // so that the ux update does not get batched together
      window.setTimeout(() => {
        setSongsImported(0);
        setTotalSongs(0);
      }, 100);
    });

    // request that the user selects a directory and that main process processes
    window.electron.ipcRenderer.sendMessage('select-library', {
      rescan,
    });
  };

  /**
   * @dev allow user to select some files and import them into the library
   */
  const importNewSongs = async () => {
    /**
     * @dev fires when one song is imported, that way we can update
     * our progress bar in the UI and the EstimatedTimeRemainingString
     */
    window.electron.ipcRenderer.on('song-imported', (args) => {
      setShowImportingProgress(true);
      setSongsImported(args.songsImported);
      setTotalSongs(args.totalSongs);

      // completion time is roughly 5ms per song
      const estimatedTimeRemaining = Math.floor(
        (args.totalSongs - args.songsImported) * 5,
      );

      // convert the estimated time from ms to a human readable format
      const minutes = Math.floor(estimatedTimeRemaining / 60000);
      const seconds = Math.floor(estimatedTimeRemaining / 1000);
      const timeRemainingString =
        // eslint-disable-next-line no-nested-ternary
        minutes < 1
          ? seconds === 0
            ? 'Processing Metadata...'
            : `${seconds}s left`
          : `${minutes}mins left`;
      setEstimatedTimeRemainingString(timeRemainingString);
    });

    /**
     * @dev fires when adding songs to the library is complete.
     * Is given the new store/library and the index of the song to scroll to
     */
    window.electron.ipcRenderer.once('add-to-library', (arg) => {
      // exit early if the user cancels the import or the args are malformed
      if (!arg || !arg.library) {
        setShowImportingProgress(false);
        return;
      }

      // update the library, the filtered library, the current song, and pause.
      setLibraryInStore(arg.library);
      setFilteredLibrary(arg.library);

      // scroll one of the new songs into view
      setInitialScrollIndex(arg.scrollToIndex);

      // hide the dialog
      setShowImportingProgress(false);

      // reset the internal ux of the progress bar for next time its used
      // do it way after the importing progress dialog is closed
      // so that the ux update does not get batched together
      window.setTimeout(() => {
        setSongsImported(0);
        setTotalSongs(0);
      }, 100);
    });

    /**
     * ask the user what songs to add to the library.
     * will respond with add-to-library and song-imported events
     */
    window.electron.ipcRenderer.sendMessage('add-to-library');
  };

  /**
   * @dev useEffect to update the row container height when
   * the window is resized in any way. that way our virtualized table
   * always has the right size and right amount of rows visible.
   */
  useEffect(() => {
    const artContainerHeight =
      document.querySelector('.art')?.clientHeight || 0;
    const playerHeight = document.querySelector('.player')?.clientHeight || 0;

    if (height) {
      setRowContainerHeight(height - playerHeight - artContainerHeight - 26);
    }

    if (width && albumArtMaxWidth) {
      // set
    }
  }, [height, width, albumArtMaxWidth]);

  /**
   * @dev useEffect to initialize the app and set up the internal store
   * for the library etc. also sets the current song and album art.
   * also sets the row container height for the library list.
   * also sets the initial scroll index to the last played song.
   * also sets up the menu callbacks for the main process.
   */
  useEffect(() => {
    window.electron.ipcRenderer.once('initialize', (arg) => {
      setInitialized(true);
      setLibraryInStore(arg.library);
      setFilteredLibrary(arg.library);

      const artContainerHeight =
        document.querySelector('.art')?.clientHeight || 0;

      if (height) {
        // since the player has no actual height, we use 120 to implicitly set the height
        setRowContainerHeight(height - 120 - artContainerHeight);
      }

      if (arg.lastPlayedSong) {
        setCurrentSong(arg.lastPlayedSong);
        setCurrentSongMetadata(arg.library[arg.lastPlayedSong]);
        requestAndSetAlbumArtForSong(arg.lastPlayedSong);

        // now find the index of the song within the library
        const songIndex = Object.keys(arg.library).findIndex(
          (song) => song === arg.lastPlayedSong,
        );
        setInitialScrollIndex(songIndex);
      }
    });

    window.electron.ipcRenderer.on('update-store', (arg) => {
      setInitialized(true);
      setShowDedupingProgress(false);
      setLibraryInStore(arg.library);
      setFilteredLibrary(arg.library);
    });

    window.electron.ipcRenderer.on('menu-select-library', () => {
      importNewLibrary();
    });

    window.electron.ipcRenderer.on('menu-rescan-library', () => {
      importNewLibrary(true);
    });

    window.electron.ipcRenderer.on('menu-add-songs', () => {
      importNewSongs();
    });

    window.electron.ipcRenderer.on('menu-reset-library', () => {
      window.electron.ipcRenderer.sendMessage('menu-reset-library');
    });

    window.electron.ipcRenderer.on('menu-hide-dupes', () => {
      setShowDedupingProgress(true);
      // responds with 'update-store' on completion
      window.electron.ipcRenderer.sendMessage('menu-hide-dupes');
    });

    window.electron.ipcRenderer.on('menu-delete-dupes', () => {
      // open the confirmation dialog, which handles the other ipc calls
      setShowConfirmDedupeAndDeleteDialog(true);
      // eventually this will respond with 'update-store' on completion
    });

    window.electron.ipcRenderer.on('menu-backup-library', () => {
      // open the confirmation dialog, which handles the other ipc calls
      setShowBackupConfirmationDialog(true);
    });

    window.electron.ipcRenderer.once('backup-library-success', () => {
      // close the dialogs
      setShowBackingUpLibraryDialog(false);
      setShowBackupConfirmationDialog(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * @dev anytime initial scroll index changes, set a timeout to
   * reset it to undefined after 10ms. this is to prevent the
   * library list from scrolling to the wrong index when the
   * library is updated.
   */
  useEffect(() => {
    if (initialScrollIndex !== undefined) {
      setTimeout(() => {
        setInitialScrollIndex(undefined);
      }, 10);
    }
  }, [initialScrollIndex]);

  navigator.mediaSession.setActionHandler('previoustrack', () => {
    playPreviousSong();
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    playNextSong();
  });

  return (
    <div ref={ref} className="h-full flex flex-col dark">
      {/**
       * @important This is the hidden audio tag that plays the song.
       * We use it to hook into the current time, pause, and play states.
       */}
      <audio
        ref={audioTagRef}
        autoPlay={!paused}
        className="hidden"
        onEnded={playNextSong}
        onPause={() => {
          setPaused(true);
        }}
        onPlay={() => {
          setPaused(false);
        }}
        onTimeUpdate={(e) => {
          setCurrentSongTime(e.currentTarget.currentTime);
        }}
        src={`my-magic-protocol://getMediaFile/${currentSong}`}
      />

      <ImportProgressDialog
        estimatedTimeRemainingString={estimatedTimeRemainingString}
        open={showImportingProgress}
        songsImported={songsImported}
        totalSongs={totalSongs}
      />

      <DedupingProgressDialog open={showDedupingProgress} />

      <BackupConfirmationDialog
        onBackup={() => {
          setShowBackupConfirmationDialog(false);
          setShowBackingUpLibraryDialog(true);
          window.electron.ipcRenderer.sendMessage('menu-backup-library');
        }}
        onClose={() => setShowBackupConfirmationDialog(false)}
        open={showBackupConfirmationDialog}
      />

      <BackingUpLibraryDialog open={showBackingUpLibraryDialog} />

      <ConfirmDedupingDialog
        onClose={() => setShowConfirmDedupeAndDeleteDialog(false)}
        onConfirm={() => {
          setShowConfirmDedupeAndDeleteDialog(false);
          setShowDedupingProgress(true);
          // @note: responds with update-store
          window.electron.ipcRenderer.sendMessage('menu-delete-dupes');
        }}
        open={showConfirmDedupeAndDeleteDialog}
      />

      {/**
       * @dev top third of the screen with
       *  -- the artwork
       *  -- import button
       *  -- search bar etc
       */}
      <div className="flex art drag justify-center p-4 space-x-4 md:flex-row ">
        <AlbumArt
          albumArtMaxWidth={albumArtMaxWidth}
          setAlbumArtMaxWidth={setAlbumArtMaxWidth}
          setShowAlbumArtMenu={setShowAlbumArtMenu}
          showAlbumArtMenu={showAlbumArtMenu}
          width={width || null}
        />

        {/**
         * @dev IMPORT LIBRARY BUTTON
         */}
        {!storeLibrary ? (
          <Tooltip title="Import Library From Folder">
            <button
              aria-label="select library folder"
              className="nodrag absolute top-[60px] md:top-4 right-4 items-center justify-center
          rounded-md text-[18px] ring-offset-background transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 disabled:pointer-events-none
          disabled:opacity-50 border border-neutral-800 bg-black
          hover:bg-white hover:text-black
          px-4 py-[7px] text-sm"
              onClick={() => importNewLibrary()}
              type="button"
            >
              <LibraryMusic
                fontSize="inherit"
                sx={{
                  position: 'relative',
                  bottom: '1px',
                }}
              />
            </button>
          </Tooltip>
        ) : (
          <Tooltip title="Import New Songs">
            <button
              aria-label="import to songs"
              className="nodrag absolute top-[60px] md:top-4 right-4 items-center justify-center
          rounded-md text-[18px] ring-offset-background transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 disabled:pointer-events-none
          disabled:opacity-50 border border-neutral-800 bg-black
          hover:bg-white hover:text-black
          px-4 py-[7px] text-sm"
              onClick={importNewSongs}
              type="button"
            >
              <LibraryAdd
                fontSize="inherit"
                sx={{
                  position: 'relative',
                  bottom: '1px',
                }}
              />
            </button>
          </Tooltip>
        )}

        {/**
         * @dev SEARCH BAR
         */}
        <Box className="absolute h-[45px] top-4 md:top-4 md:right-[4.5rem] right-4 w-auto text-white">
          <Search
            sx={{
              borderRadius: '0.375rem',
            }}
          >
            <StyledInputBase
              inputProps={{ 'aria-label': 'search' }}
              onChange={handleSearch}
              placeholder="Search"
            />
            <SearchIconWrapper className="text-[16px]">
              <SearchIcon fontSize="inherit" />
            </SearchIconWrapper>
          </Search>
        </Box>
      </div>

      {width && (
        <LibraryList
          initialScrollIndex={initialScrollIndex}
          onImportLibrary={importNewLibrary}
          playSong={async (song, meta) => {
            // if the user clicks on the currently playing song, start it over
            if (currentSong === song) {
              await startCurrentSongOver();
            } else {
              await playSong(song, meta);
            }
          }}
          rowContainerHeight={rowContainerHeight}
          width={width}
        />
      )}

      <StaticPlayer
        audioTagRef={audioTagRef}
        playNextSong={playNextSong}
        playPreviousSong={playPreviousSong}
      />
    </div>
  );
}
