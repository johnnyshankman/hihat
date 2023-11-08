/* eslint-disable jsx-a11y/media-has-caption */
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { IPicture } from 'music-metadata';
import React, { useState, useRef, useEffect } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import FastForwardRounded from '@mui/icons-material/FastForwardRounded';
import FastRewindRounded from '@mui/icons-material/FastRewindRounded';
import PauseRounded from '@mui/icons-material/PauseRounded';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import FilterListIcon from '@mui/icons-material/FilterList';
import {
  styled,
  ThemeProvider,
  createTheme,
  alpha,
} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { List } from 'react-virtualized';
import { useResizeDetector } from 'react-resize-detector';
import LinearProgress from '@mui/material/LinearProgress';
import LibraryAddOutlined from '@mui/icons-material/LibraryAddOutlined';
import InputBase from '@mui/material/InputBase';
import ContinuousSlider from './ContinuousSlider';
import LinearProgressBar from './LinearProgressBar';
import { StoreStructure, SongSkeletonStructure } from '../common/common';

// @TODO: doesn't respect nesting/scss like it should
import './App.scss';

const TinyText = styled(Typography)({
  fontSize: '0.75rem',
  opacity: 0.38,
  fontWeight: 500,
  letterSpacing: 0.2,
});

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  border: '1px solid rgb(40, 40, 40)',
  backgroundColor: '#0D0D0D',
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginLeft: 0,
  width: '100px',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(1),
    width: 'auto',
  },
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 0.5, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(0em + ${theme.spacing(2)})`,
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

function MainDash() {
  const audioTagRef = useRef<HTMLAudioElement>(null);
  const rowHeight = 25.5;
  const { width, height, ref } = useResizeDetector();

  const [rowContainerHeight, setRowContainerHeight] = useState(0);
  const [currentSongTime, setCurrentSongTime] = useState(0);
  const [paused, setPaused] = useState(true);
  const [currentSong, setCurrentSong] = useState<string>();
  const [showImportingProgress, setShowImportingProgress] = useState(false);
  const [currentSongDataURL, setCurrentSongDataURL] = useState<string>();
  const [songsImported, setSongsImported] = useState(0);
  const [totalSongs, setTotalSongs] = useState(0);
  const [currentSongMetadata, setCurrentSongMetadata] =
    useState<SongSkeletonStructure>();
  // the constant source of truth for the library, invisible to the UX
  const [library, setLibrary] = useState<StoreStructure['library']>();
  // the UX layer for the `library`, filtered by search
  const [filteredLibrary, setFilteredLibrary] =
    useState<StoreStructure['library']>();
  const [filterType, setFilterType] = useState<'title' | 'artist' | 'album'>(
    'artist',
  );
  const [filterDirection, setFilterDirection] = useState<'asc' | 'desc'>(
    'desc',
  );
  const [shuffle, setShuffle] = useState(false);
  const [initialScrollIndex, setInitialScrollIndex] = useState(0);

  const bufferToDataUrl = async (
    buffer: Buffer,
    format: string,
  ): Promise<string> => {
    const blob = new Blob([buffer], { type: format });
    const reader = new FileReader();
    reader.readAsDataURL(blob);

    const res = (await new Promise((resolve) => {
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
    })) as string;

    return res;
  };

  /**
   * @dev self explanatory, converts to '00:00' format a la itunes
   */
  const convertToMMSS = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  const onGetAlbumArtResponse = async (event) => {
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
    // this will also set the `lastPlayedSong` in the userConfig
    window.electron.ipcRenderer.sendMessage('get-album-art', {
      path: song,
    });

    // set the current song data url when the main process responds
    window.electron.ipcRenderer.once('get-album-art', onGetAlbumArtResponse);
  };

  const handleSearch = (event: React.ChangeEvent<HTMLInputElement>) => {
    const query = event.target.value;
    if (!library) return;
    const filtered = Object.keys(library).filter((song) => {
      const meta = library[song];
      return (
        meta.common.title?.toLowerCase().includes(query.toLowerCase()) ||
        meta.common.artist?.toLowerCase().includes(query.toLowerCase()) ||
        meta.common.album?.toLowerCase().includes(query.toLowerCase())
      );
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = library[song];
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

    // play the song regardless of when the main process responds
    setPaused(false);
  };

  const playNextSong = async () => {
    if (!filteredLibrary) return;
    const keys = Object.keys(filteredLibrary);
    const currentSongIndex = keys.indexOf(currentSong || '');
    const nextSongIndex = currentSongIndex + 1;
    if (nextSongIndex >= keys.length) {
      return;
    }
    const nextSong = keys[nextSongIndex];
    const nextSongMeta = filteredLibrary[nextSong];

    // @dev: if shuffle is on, pick a random song
    if (shuffle) {
      const randomIndex = Math.floor(Math.random() * keys.length);
      const randomSong = keys[randomIndex];
      const randomSongMeta = filteredLibrary[randomSong];
      await playSong(randomSong, randomSongMeta);
      return;
    }

    await playSong(nextSong, nextSongMeta);
  };

  const playPreviousSong = async () => {
    if (!filteredLibrary) return;
    const keys = Object.keys(filteredLibrary);
    const currentSongIndex = keys.indexOf(currentSong || '');
    const previousSongIndex = currentSongIndex - 1;
    if (previousSongIndex < 0) {
      return;
    }
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
    });
    // once the import is complete, update the store/data
    window.electron.ipcRenderer.once('select-library', (arg) => {
      const typedArg = arg as StoreStructure;

      // reset the library, the filtered library, the current song, and pause.
      setLibrary(typedArg.library);
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
    });
    // request that the user selects a directory and that main process processes
    window.electron.ipcRenderer.sendMessage('select-library');
  };

  const filterByTitle = () => {
    if (!library) return;
    if (!filteredLibrary) return;

    // flip the filter direction
    setFilterDirection(filterDirection === 'asc' ? 'desc' : 'asc');

    const filtered = Object.keys(filteredLibrary).sort((a, b) => {
      const aTitle = filteredLibrary[a].common.title?.toLowerCase() || '';
      const bTitle = filteredLibrary[b].common.title?.toLowerCase() || '';
      const val = aTitle.localeCompare(bTitle);
      if (filterDirection === 'desc') {
        return val * -1;
      }
      return val;
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = library[song];
    });

    setFilteredLibrary(filteredLib);
    setFilterType('title');
  };

  const filterByArtist = () => {
    if (!library) return;
    if (!filteredLibrary) return;

    // flip the filter direction
    setFilterDirection(filterDirection === 'asc' ? 'desc' : 'asc');

    const filtered = Object.keys(filteredLibrary).sort((a, b) => {
      const artistA = filteredLibrary[a].common?.artist?.toLowerCase();
      const artistB = filteredLibrary[b].common?.artist?.toLowerCase();
      const albumA = filteredLibrary[a].common?.album?.toLowerCase();
      const albumB = filteredLibrary[b].common?.album?.toLowerCase();
      const trackA = filteredLibrary[a].common?.track?.no;
      const trackB = filteredLibrary[b].common?.track?.no;
      // handle null cases
      if (!artistA) return filterDirection === 'asc' ? -1 : 1;
      if (!artistB) return filterDirection === 'asc' ? 1 : -1;

      if (!albumA) return -1;
      if (!albumB) return 1;
      if (!trackA) return -1;
      if (!trackB) return 1;

      if (artistA < artistB) return filterDirection === 'asc' ? -1 : 1;
      if (artistA > artistB) return filterDirection === 'asc' ? 1 : -1;

      if (albumA < albumB) return -1;
      if (albumA > albumB) return 1;
      if (trackA < trackB) return -1;
      if (trackA > trackB) return 1;
      return 0;
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = library[song];
    });

    setFilteredLibrary(filteredLib);
    setFilterType('artist');
  };

  const filterByAlbum = () => {
    if (!library) return;
    if (!filteredLibrary) return;

    // flip the filter direction
    setFilterDirection(filterDirection === 'asc' ? 'desc' : 'asc');

    const filtered = Object.keys(filteredLibrary).sort((a, b) => {
      // sort by album, then track number
      const albumA = filteredLibrary[a].common?.album?.toLowerCase();
      const albumB = filteredLibrary[b].common?.album?.toLowerCase();
      const trackA = filteredLibrary[a].common?.track?.no;
      const trackB = filteredLibrary[b].common?.track?.no;
      // handle null cases
      if (!albumA) return filterDirection === 'asc' ? -1 : 1;
      if (!albumB) return filterDirection === 'asc' ? 1 : -1;
      if (!trackA) return -1;
      if (!trackB) return 1;

      if (albumA < albumB) return filterDirection === 'asc' ? -1 : 1;
      if (albumA > albumB) return filterDirection === 'asc' ? 1 : -1;

      if (trackA < trackB) return -1;
      if (trackA > trackB) return 1;

      return 0;
    });

    const filteredLib: StoreStructure['library'] = {};
    filtered.forEach((song) => {
      filteredLib[song] = library[song];
    });

    setFilteredLibrary(filteredLib);
    setFilterType('album');
  };

  /**
   * @dev render the row for the virtualized table, reps a single song
   */
  const renderSongRow = ({
    index,
    key,
    style,
  }: {
    index: number;
    key: string;
    style: any;
  }) => {
    if (!filteredLibrary) return null;
    const song = Object.keys(filteredLibrary)[index];
    return (
      <div
        key={key}
        style={style}
        onDoubleClick={async () => {
          await playSong(song, filteredLibrary[song]);
        }}
        data-state={song === currentSong ? 'selected' : undefined}
        className="flex w-full items-center border-b border-neutral-800 transition-colors hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 py-1 divide-neutral-50"
      >
        <div className="select-none whitespace-nowrap	overflow-hidden flex-1 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {filteredLibrary?.[song].common.title}
        </div>
        <div className="select-none whitespace-nowrap	overflow-hidden flex-1 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {filteredLibrary?.[song].common.artist}
        </div>
        <div className="select-none whitespace-nowrap	overflow-hidden flex-1 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {filteredLibrary?.[song].common.album}
        </div>
        <div className="select-none w-14 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {convertToMMSS(filteredLibrary?.[song].format.duration || 0)}
        </div>
      </div>
    );
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
      setRowContainerHeight(height - playerHeight - artContainerHeight);
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
      setLibrary(typedArg.library);
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
      <Dialog
        className="flex flex-col items-center justify-center content-center p-10"
        open={showImportingProgress}
      >
        <div className="flex flex-col items-center px-20">
          <DialogTitle>Importing</DialogTitle>
          <Box sx={{ width: '100%', marginBottom: '12px' }}>
            <LinearProgress
              variant="determinate"
              color="inherit"
              value={(songsImported / totalSongs) * 100}
            />
          </Box>
          <div className="flex w-full justify-center p-2 mb-2">
            <TinyText>{`${songsImported} / ${totalSongs}`}</TinyText>
          </div>
        </div>
      </Dialog>
      <div className="flex art drag justify-center p-4 pb-8 space-x-4 md:flex-row">
        {/**
         * @dev either show the animated placeholder, or the album art
         */}
        {!currentSongDataURL && (
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
        )}
        {currentSongDataURL && (
          <img
            src={currentSongDataURL}
            alt="Album Art"
            className="object-cover rounded-lg shadow-md max-w-[280px] w-1/3"
            style={{
              aspectRatio: '200/200',
              objectFit: 'cover',
            }}
          />
        )}
        <button
          onClick={importSongs}
          type="button"
          aria-label="import library"
          className="nodrag absolute top-4 right-4 items-center justify-center
          rounded-md text-[18px] ring-offset-background transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 disabled:pointer-events-none
          disabled:opacity-50 border border-neutral-800 bg-background
          hover:bg-white hover:text-black
          px-4 py-2"
        >
          <LibraryAddOutlined
            fontSize="inherit"
            sx={{
              position: 'relative',
              bottom: '2px',
            }}
          />
        </button>

        <Box className="absolute top-[70px] md:top-4 md:right-20 right-4 w-auto text-white">
          <Search
            sx={{
              borderRadius: '0.375rem',
            }}
          >
            <StyledInputBase
              placeholder="Search…"
              inputProps={{ 'aria-label': 'search' }}
              onChange={handleSearch}
              sx={{
                fontSize: '14px',
                padding: '4px 0',
              }}
            />
          </Search>
        </Box>
      </div>

      <div className="w-full overflow-auto">
        <div className="w-full text-[11px]">
          <div className="sticky top-0 z-50 bg-[#0d0d0d] outline outline-offset-0 outline-1 outline-neutral-800">
            <div className="flex transition-colors divide-neutral-800 divide-x">
              <button
                onClick={filterByTitle}
                type="button"
                className="select-none flex leading-[1em] items-center py-1.5 flex-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
              >
                Song
                {/* if this is the selected filter add an up or down arrow represending the filter direction */}
                {filterType === 'title' && (
                  <span
                    className={`${
                      filterDirection === 'asc'
                        ? 'rotate-180'
                        : 'relative bottom-[2px]'
                    } inline-block ml-2`}
                  >
                    <FilterListIcon fontSize="inherit" />
                  </span>
                )}
              </button>
              <button
                onClick={filterByArtist}
                type="button"
                className="select-none flex leading-[1em] items-center py-1.5 flex-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
              >
                Artist
                {filterType === 'artist' && (
                  <span
                    className={`${
                      filterDirection === 'asc'
                        ? 'rotate-180'
                        : 'relative bottom-[2px]'
                    } inline-block ml-2`}
                  >
                    <FilterListIcon fontSize="inherit" />
                  </span>
                )}
              </button>
              <button
                onClick={filterByAlbum}
                type="button"
                className="select-none flex leading-[1em] items-center py-1.5 flex-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
              >
                Album
                {filterType === 'album' && (
                  <span
                    className={`${
                      filterDirection === 'asc'
                        ? 'rotate-180'
                        : 'relative bottom-[2px]'
                    } inline-block ml-2`}
                  >
                    <FilterListIcon fontSize="inherit" />
                  </span>
                )}
              </button>
              {/**
               * @dev slightly diff size to accomodate the lack of scroll bar
               * next to it, unlike a normal row.
               */}
              <button
                type="button"
                aria-label="duration"
                className="select-none flex leading-[1em] items-center py-1.5 w-14 text-center px-4 mr-2 align-middle font-medium hover:bg-neutral-800/50 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
              >
                <AccessTimeIcon fontSize="inherit" />
              </button>
            </div>
          </div>
          {/**
           * @dev since the list could be 1000s of songs long we must virtualize it
           */}
          <List
            width={width || 0}
            height={rowContainerHeight}
            rowRenderer={renderSongRow}
            rowCount={Object.keys(filteredLibrary || {}).length}
            rowHeight={rowHeight}
            scrollToAlignment="center"
            scrollToIndex={
              initialScrollIndex > 0 ? initialScrollIndex : undefined
            }
          />
        </div>
      </div>

      <div
        className="player flex flex-col sm:flex-row items-center
      justify-between drag gap-1 sm:gap-4 fixed inset-x-0 border-t
      border-neutral-800 bottom-0 bg-[#0d0d0d] shadow-md px-4 py-1 sm:py-3
      "
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'start',
            flex: 1,
          }}
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
        </Box>
        <LinearProgressBar
          value={currentSongTime}
          max={currentSongMetadata?.format.duration || 0}
          title={currentSongMetadata?.common.title || 'No song selected'}
          artist={currentSongMetadata?.common.artist || '--'}
          onManualChange={(e: number) => {
            setCurrentSongTime(e);
            if (audioTagRef?.current) {
              audioTagRef.current.currentTime = e;
            }
          }}
        />
        <div className="flex relative sm:justify-end justify-center flex-1 mt-2 mb-1 sm:w-auto w-full">
          <ContinuousSlider
            onChange={(event, value) => {
              audioTagRef.current!.volume = (value as number) / 100;
            }}
            onShuffleChange={(value) => {
              setShuffle(value);
            }}
          />
        </div>
      </div>

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
    </div>
  );
}

/**
 * @dev forces all google material ui components to use the dark theme
 */
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
  },
});

export default function App() {
  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={
            <div className="shell">
              {/**
               * @dev themeprovder and cssbaseline are used to render
               * all google material ui components in dark mode
               */}
              <ThemeProvider theme={darkTheme}>
                <CssBaseline />
                <MainDash />
              </ThemeProvider>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}
