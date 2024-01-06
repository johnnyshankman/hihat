/* eslint-disable jsx-a11y/media-has-caption */
import { IPicture } from 'music-metadata';
import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import FastForwardRounded from '@mui/icons-material/FastForwardRounded';
import FastRewindRounded from '@mui/icons-material/FastRewindRounded';
import PauseRounded from '@mui/icons-material/PauseRounded';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import Tooltip from '@mui/material/Tooltip';
import { IconButton } from '@mui/material';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import ShuffleOnIcon from '@mui/icons-material/ShuffleOn';
import RepeatIcon from '@mui/icons-material/Repeat';
import Stack from '@mui/material/Stack';
import RepeatOnIcon from '@mui/icons-material/RepeatOn';
import { styled, alpha } from '@mui/material/styles';
import { useResizeDetector } from 'react-resize-detector';
import LinearProgress from '@mui/material/LinearProgress';
import LibraryAddOutlined from '@mui/icons-material/LibraryAddOutlined';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';
import ContinuousSlider from './ContinuousSlider';
import LinearProgressBar from './LinearProgressBar';
import { StoreStructure, SongSkeletonStructure } from '../../common/common';
import AlbumArtMenu from './AlbumArtMenu';
import useMainStore from '../store/main';
import { bufferToDataUrl } from '../utils/utils';
import usePlayerStore from '../store/player';
import LibraryList from './LibraryList';

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 1.5),
  height: '100%',
  position: 'absolute',
  top: 0,
  right: 0,
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  border: '1px solid rgb(40, 40, 40)',
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  background: 'black',

  marginLeft: 0,
  width: '104px',
  [theme.breakpoints.up('sm')]: {
    width: 'auto',
  },
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  fontSize: '12px',
  padding: '4px 0',
  '& .MuiInputBase-input': {
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(0.5)})`,
    paddingRight: `calc(1em + ${theme.spacing(2.5)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('sm')]: {
      width: '12ch',
      '&:focus': {
        width: '20ch',
      },
    },
  },
}));

const TinyText = styled(Typography)({
  fontSize: '0.75rem',
  opacity: 0.38,
  fontWeight: 500,
  letterSpacing: 0.2,
});

type AlbumArtMenuState =
  | {
      mouseX: number;
      mouseY: number;
    }
  | undefined;

export default function MainDash() {
  /**
   * @dev external hookds
   */
  const { width, height, ref } = useResizeDetector();

  /**
   * @dev store hooks
   */
  const storeLibrary = useMainStore((store) => store.library);
  const setLibraryInStore = useMainStore((store) => store.setLibrary);
  const setLastPlayedSongInStoreAndOnServer = useMainStore(
    (store) => store.setLastPlayedSong,
  );
  const volume = usePlayerStore((store) => store.volume);
  const setVolume = usePlayerStore((store) => store.setVolume);
  const paused = usePlayerStore((store) => store.paused);
  const setPaused = usePlayerStore((store) => store.setPaused);
  const shuffle = usePlayerStore((store) => store.shuffle);
  const setShuffle = usePlayerStore((store) => store.setShuffle);
  const repeating = usePlayerStore((store) => store.repeating);
  const setRepeating = usePlayerStore((store) => store.setRepeating);
  const currentSong = usePlayerStore((store) => store.currentSong);
  const setCurrentSong = usePlayerStore((store) => store.setCurrentSong);
  const currentSongDataURL = usePlayerStore(
    (store) => store.currentSongDataURL,
  );
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

  /**
   * @dev refs
   */
  const audioTagRef = useRef<HTMLAudioElement>(null);

  /**
   * @dev state
   */
  const [rowContainerHeight, setRowContainerHeight] = useState(0);
  const [currentSongTime, setCurrentSongTime] = useState(0);

  const [showImportingProgress, setShowImportingProgress] = useState(false);
  const [songsImported, setSongsImported] = useState(0);
  const [totalSongs, setTotalSongs] = useState(0);
  const [estimatedTimeRemainingString, setEstimatedTimeRemainingString] =
    useState('');

  const [initialScrollIndex, setInitialScrollIndex] = useState(0);
  const [showAlbumArtMenu, setShowAlbumArtMenu] =
    useState<AlbumArtMenuState>(undefined);

  const onGetAlbumArtResponse = async (event: unknown) => {
    const pic = event as IPicture;
    const url = await bufferToDataUrl(pic.data, pic.format);
    setCurrentSongDataURL(url);
    if (navigator.mediaSession.metadata?.artwork) {
      navigator.mediaSession.metadata.artwork = [
        {
          src: url,
          sizes: '192x192',
          type: pic.format,
        },
      ];
    }
  };

  const requestAndSetAlbumArtForSong = (song: string) => {
    // request the album art for the file from the main process
    window.electron.ipcRenderer.sendMessage('get-album-art', song);

    // set the current song data url when the main process responds
    window.electron.ipcRenderer.once('get-album-art', onGetAlbumArtResponse);
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
  const playSong = async (song: string, meta: SongSkeletonStructure) => {
    // update the navigator
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
    setLastPlayedSongInStoreAndOnServer(song);

    // play the song regardless of when the main process responds
    setPaused(false);
  };

  // @dev: hack, play blank song then play the song again to start it over
  const startCurrentSongOver = async () => {
    return new Promise((resolve, reject) => {
      if (currentSong && currentSongMetadata) {
        setCurrentSong('');
        window.setTimeout(() => {
          playSong(currentSong, currentSongMetadata);
          resolve(null);
        }, 100);
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

    // @dev: if shuffle is on, pick a random song and return early
    if (shuffle) {
      const randomIndex = Math.floor(Math.random() * keys.length);
      const randomSong = keys[randomIndex];
      const randomSongMeta = filteredLibrary[randomSong];
      await playSong(randomSong, randomSongMeta);
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
  const importSongs = async () => {
    setShowImportingProgress(true);

    // updates the UX with the progress of the import
    window.electron.ipcRenderer.on('song-imported', (args) => {
      setSongsImported((args as any).songsImported);
      setTotalSongs((args as any).totalSongs);
      // completion time is roughly 5ms per song
      const estimatedTimeRemaining = Math.floor(
        ((args as any).totalSongs - (args as any).songsImported) * 5,
      );

      // convert the estimated time remaining in ms to a human readable format
      const minutes = Math.floor(estimatedTimeRemaining / 60000);
      // if it is less than one minute say `less than a minute`
      const seconds =
        minutes < 1 ? 'Time Left: < 1min' : `Time Left: ${minutes}mins...`;
      setEstimatedTimeRemainingString(seconds);
    });

    // once the import is complete, update the store/data
    window.electron.ipcRenderer.once('select-library', (arg) => {
      // exit early if the user cancels the import or the args are malformed
      if (!arg || !(arg as any)?.library) {
        setShowImportingProgress(false);
        return;
      }

      const typedArg = arg as StoreStructure;

      // reset the library, the filtered library, the current song, and pause.
      setLibraryInStore(typedArg.library);
      setFilteredLibrary(typedArg.library);
      setShowImportingProgress(false);
      // set current song to the first song in the library
      const firstSong = Object.keys(typedArg.library)[0];
      const firstSongMeta = typedArg.library[firstSong];

      setCurrentSong(firstSong);
      setCurrentSongMetadata(firstSongMeta);
      requestAndSetAlbumArtForSong(firstSong);
      setPaused(true);
      setInitialScrollIndex(2);

      window.setTimeout(() => {
        setSongsImported(0);
        setTotalSongs(0);
      }, 1000);
    });

    // request that the user selects a directory and that main process processes
    window.electron.ipcRenderer.sendMessage('select-library');
  };

  /**
   * @dev allow user to select a directory and import all songs within it
   */
  const importNewSongs = async () => {
    setShowImportingProgress(true);

    // updates the UX with the progress of the import
    window.electron.ipcRenderer.on('song-imported', (args) => {
      setSongsImported((args as any).songsImported);
      setTotalSongs((args as any).totalSongs);
      // completion time is roughly 5ms per song
      const estimatedTimeRemaining = Math.floor(
        ((args as any).totalSongs - (args as any).songsImported) * 5,
      );

      // convert the estimated time remaining in ms to a human readable format
      const minutes = Math.floor(estimatedTimeRemaining / 60000);
      // if it is less than one minute say `less than a minute`
      const seconds =
        minutes < 1 ? 'Time Left: < 1min' : `Time Left: ${minutes}mins...`;
      setEstimatedTimeRemainingString(seconds);
    });

    // once the import is complete, update the store/data
    window.electron.ipcRenderer.once('add-to-library', (arg) => {
      // exit early if the user cancels the import or the args are malformed
      if (!arg || !(arg as any)?.library) {
        setShowImportingProgress(false);
        return;
      }

      const typedArg = arg as StoreStructure & { scrollToIndex: number };

      // reset the library, the filtered library, the current song, and pause.
      setLibraryInStore(typedArg.library);
      setFilteredLibrary(typedArg.library);
      setShowImportingProgress(false);
      // scroll one of the new songs into view
      setInitialScrollIndex(typedArg.scrollToIndex);

      window.setTimeout(() => {
        setSongsImported(0);
        setTotalSongs(0);
      }, 1000);
    });

    // request that the user selects a directory and that main process processes
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
      setRowContainerHeight(height - playerHeight - artContainerHeight - 1);
    }
  }, [height, width]);

  /**
   * @dev useEffect as a single mount callback
   * to initialize the song mapping and set the row container height
   * to the correct initial value.
   */
  useEffect(() => {
    window.electron.ipcRenderer.once('initialize', (arg: unknown) => {
      const typedArg = arg as StoreStructure;
      setLibraryInStore(typedArg.library);
      setFilteredLibrary(typedArg.library);

      const artContainerHeight =
        document.querySelector('.art')?.clientHeight || 0;
      const playerHeight = document.querySelector('.player')?.clientHeight || 0;

      if (height) {
        setRowContainerHeight(height - playerHeight - artContainerHeight);
      }

      if (typedArg.lastPlayedSong) {
        setCurrentSong(typedArg.lastPlayedSong);
        setCurrentSongMetadata(typedArg.library[typedArg.lastPlayedSong]);
        requestAndSetAlbumArtForSong(typedArg.lastPlayedSong);

        // now find the index of the song within the library
        const songIndex = Object.keys(typedArg.library).findIndex(
          (song) => song === typedArg.lastPlayedSong,
        );
        setInitialScrollIndex(songIndex);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  navigator.mediaSession.setActionHandler('previoustrack', () => {
    playPreviousSong();
  });
  navigator.mediaSession.setActionHandler('nexttrack', () => {
    playNextSong();
  });

  return (
    <div className="h-full flex flex-col dark" ref={ref}>
      {/**
       * @dev this is the audio tag that plays the song.
       * it is hidden and only used to play the song, as well as
       * hook into the current time, pause, and play states.
       * never let the user click on this directly.
       * */}
      <audio
        className="hidden"
        src={`my-magic-protocol://getMediaFile/${currentSong}`}
        autoPlay={!paused}
        onEnded={playNextSong}
        onTimeUpdate={(e) => {
          setCurrentSongTime(e.currentTarget.currentTime);
        }}
        ref={audioTagRef}
        onPause={() => {
          setPaused(true);
        }}
        onPlay={() => {
          setPaused(false);
        }}
      />

      {/**
       * @dev this is the import progress dialog/modal
       */}
      <Dialog
        className="flex flex-col items-center justify-center content-center p-10"
        open={showImportingProgress}
      >
        <div className="flex flex-col items-center px-20 pb-6">
          <DialogTitle>Importing Songs</DialogTitle>
          <Box sx={{ width: '100%', marginBottom: '12px' }}>
            <LinearProgress
              variant="determinate"
              color="inherit"
              value={(songsImported / totalSongs) * 100}
            />
          </Box>
          <div className="flex w-full justify-center mt-1 px-2 ">
            <TinyText>{`${songsImported} / ${totalSongs}`}</TinyText>
          </div>
          <div className="flex w-full justify-center px-2">
            <TinyText>{`[${
              estimatedTimeRemainingString || 'Calculating...'
            }]`}</TinyText>
          </div>
        </div>
      </Dialog>

      {/**
       * @dev this is the top third of the screen with the artwork and import buttons
       *      and search bar etc
       */}
      <div className="flex art drag justify-center p-4 pb-8 space-x-4 md:flex-row">
        {/**
         * @dev either show the animated placeholder, or the album art
         */}
        {!currentSongDataURL ? (
          <div
            style={{
              aspectRatio: '1/1',
            }}
            className="relative max-w-[280px] w-1/3 bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-600 border-2 border-neutral-700 shadow-2xl rounded-lg transition-all duration-500"
          >
            <div className="inset-0 h-full w-full flex items-center justify-center">
              <svg
                className=" text-neutral-300 w-1/5 h-1/5 animate-bounce"
                fill="none"
                height="24"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
              <TinyText className="absolute bottom-3 left-3">hihat</TinyText>
            </div>
          </div>
        ) : (
          <>
            <img
              src={currentSongDataURL}
              alt="Album Art"
              className="album-art object-cover rounded-lg shadow-md max-w-[280px] w-1/3"
              style={{
                aspectRatio: '200/200',
                objectFit: 'cover',
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setShowAlbumArtMenu({
                  mouseX: e.clientX - 2,
                  mouseY: e.clientY - 4,
                });
              }}
            />
            {showAlbumArtMenu && currentSong && (
              <AlbumArtMenu
                anchorEl={document.querySelector('.album-art')}
                mouseX={showAlbumArtMenu.mouseX}
                mouseY={showAlbumArtMenu.mouseY}
                onClose={() => {
                  setShowAlbumArtMenu(undefined);
                }}
                song={currentSong}
              />
            )}
          </>
        )}

        <Tooltip title="Import Library">
          <button
            onClick={importSongs}
            type="button"
            aria-label="import library"
            className="nodrag absolute top-[60px] md:top-4 right-4 items-center justify-center
          rounded-md text-[18px] ring-offset-background transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 disabled:pointer-events-none
          disabled:opacity-50 border border-neutral-800 bg-black
          hover:bg-white hover:text-black
          px-4 py-[7px] text-sm"
          >
            <LibraryAddOutlined
              fontSize="inherit"
              sx={{
                position: 'relative',
                bottom: '1px',
              }}
            />
          </button>
        </Tooltip>

        <Tooltip title="Add Songs To Library">
          <button
            onClick={importNewSongs}
            type="button"
            aria-label="import new songs"
            className="nodrag absolute top-[60px] md:top-4 right-[4.5rem] items-center justify-center
          rounded-md text-[18px] ring-offset-background transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 disabled:pointer-events-none
          disabled:opacity-50 border border-neutral-800 bg-black
          hover:bg-white hover:text-black
          px-4 py-[7px] text-sm"
          >
            <AddIcon
              fontSize="inherit"
              sx={{
                position: 'relative',
                bottom: '1px',
              }}
            />
          </button>
        </Tooltip>

        <Box className="absolute h-[45px] top-4 md:top-4 md:right-[8rem] right-4 w-auto text-white">
          <Search
            sx={{
              borderRadius: '0.375rem',
            }}
          >
            <StyledInputBase
              placeholder="Search"
              inputProps={{ 'aria-label': 'search' }}
              onChange={handleSearch}
            />
            <SearchIconWrapper className="text-[16px]">
              <SearchIcon fontSize="inherit" />
            </SearchIconWrapper>
          </Search>
        </Box>
      </div>

      {/**
       * @dev this is the middle third of the screen with the song list
       */}
      <LibraryList
        width={width || 0}
        rowContainerHeight={rowContainerHeight}
        initialScrollIndex={initialScrollIndex}
        playSong={playSong}
      />

      {/**
       * this the bottom third of the screen with the static player
       */}
      <div
        className="player flex flex-col sm:flex-row items-center
        justify-between drag gap-1 sm:gap-10 fixed inset-x-0 border-t
        border-neutral-800 bottom-0 bg-[#0d0d0d] shadow-md px-4 pb-4 pt-0 sm:pb-2 sm:pt-2
        "
      >
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'flex-center',
            flex: 1,
          }}
        >
          {/**
           * @dev this is the mobile version of the shuffle, repeat, play button, and volume slider
           */}
          <div className="flex sm:hidden flex-row first-letter:align-start justify-start items-center">
            <IconButton
              sx={{
                fontSize: '1rem',
                color: 'rgb(133,133,133)',
              }}
              onClick={() => {
                const newValue = !repeating;
                setRepeating(newValue);
              }}
            >
              {repeating ? (
                <RepeatOnIcon fontSize="inherit" />
              ) : (
                <RepeatIcon fontSize="inherit" />
              )}
            </IconButton>
            <IconButton
              sx={{
                fontSize: '1rem',
                color: 'rgb(133,133,133)',
              }}
              onClick={() => {
                const newValue = !shuffle;
                setShuffle(newValue);
              }}
            >
              {shuffle ? (
                <ShuffleOnIcon fontSize="inherit" />
              ) : (
                <ShuffleIcon fontSize="inherit" />
              )}
            </IconButton>
          </div>

          {/**
           * @dev this is the play button on all sizes
           */}
          <Stack
            spacing={0}
            direction="row"
            alignItems="center"
            justifyContent="center"
            justifyItems="center"
          >
            <IconButton
              aria-label="previous song"
              onClick={playPreviousSong}
              disabled={!currentSongMetadata}
              color="inherit"
            >
              <FastRewindRounded fontSize="medium" />
            </IconButton>
            <IconButton
              aria-label={paused ? 'play' : 'pause'}
              color="inherit"
              disabled={!currentSongMetadata}
              onClick={() => {
                setPaused(!paused);
                // eslint-disable-next-line no-unused-expressions
                audioTagRef.current!.paused
                  ? audioTagRef.current!.play()
                  : audioTagRef.current!.pause();
              }}
            >
              {paused ? (
                <PlayArrowRounded sx={{ fontSize: '3rem' }} />
              ) : (
                <PauseRounded sx={{ fontSize: '3rem' }} />
              )}
            </IconButton>
            <IconButton
              aria-label="next song"
              onClick={playNextSong}
              disabled={!currentSongMetadata}
              color="inherit"
            >
              <FastForwardRounded fontSize="medium" />
            </IconButton>
          </Stack>

          {/**
           * @dev this is the volume slider on mobile and desktop
           */}
          <div className="flex sm:hidden justify-end flex-1 mt-1 mb-1">
            <ContinuousSlider
              value={volume}
              onChange={(event, value) => {
                audioTagRef.current!.volume = (value as number) / 100;
                setVolume(value as number);
              }}
            />
          </div>
        </Box>

        {/**
         * @dev this is song progress bar on mobile and desktop
         */}
        <LinearProgressBar
          value={currentSongTime}
          max={currentSongMetadata?.format?.duration || 0}
          title={currentSongMetadata?.common?.title || 'No song selected'}
          artist={currentSongMetadata?.common?.artist || '--'}
          onManualChange={(e: number) => {
            setCurrentSongTime(e);
            if (audioTagRef?.current) {
              audioTagRef.current.currentTime = e;
            }
          }}
        />

        {/**
         * @dev this is the desktop version of the shuffle, repeat, play button
         */}
        <div className="sm:flex hidden gap-2 relative justify-end flex-1 mt-2 mb-1 w-full">
          <div className="flex flex-row relative bottom-0.5">
            <IconButton
              sx={{
                fontSize: '1rem',
                color: 'rgb(133,133,133)',
              }}
              onClick={() => {
                const newValue = !repeating;
                setRepeating(newValue);
              }}
            >
              {repeating ? (
                <RepeatOnIcon fontSize="inherit" />
              ) : (
                <RepeatIcon fontSize="inherit" />
              )}
            </IconButton>
            <IconButton
              sx={{
                fontSize: '1rem',
                color: 'rgb(133,133,133)',
              }}
              onClick={() => {
                const newValue = !shuffle;
                setShuffle(newValue);
              }}
            >
              {shuffle ? (
                <ShuffleOnIcon fontSize="inherit" />
              ) : (
                <ShuffleIcon fontSize="inherit" />
              )}
            </IconButton>
          </div>
          <ContinuousSlider
            value={volume}
            onChange={(event, value) => {
              audioTagRef.current!.volume = (value as number) / 100;
              setVolume(value as number);
            }}
          />
        </div>
      </div>
    </div>
  );
}
