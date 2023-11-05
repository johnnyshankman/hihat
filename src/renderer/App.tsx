/* eslint-disable jsx-a11y/media-has-caption */
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { IPicture } from 'music-metadata';
import { useState, useRef, useEffect } from 'react';
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
import SearchIcon from '@mui/icons-material/Search';
import ContinuousSlider from './ContinuousSlider';
import LinearProgressBar from './LinearProgressBar';

// @TODO: add js-search for filtering library https://github.com/bvaughn/js-search

// @TODO: doesn't respect nesting/scss like it should
import './App.scss';

type SongSkeletonStructure = {
  common: {
    artist?: string;
    album?: string;
    title?: string;
    track?: {
      no: number | null;
      of: number | null;
    };
    picture?: IPicture[];
    lyrics?: string[];
  };
  format: {
    duration?: number;
  };
};

type Playlist = {
  name: string;
  songs: string[];
};

// @TODO: put this somewhere common between renderer and main process
type StoreStructure = {
  library: {
    [key: string]: SongSkeletonStructure;
  };
  playlists: Playlist[];
};

const TinyText = styled(Typography)({
  fontSize: '0.75rem',
  opacity: 0.38,
  fontWeight: 500,
  letterSpacing: 0.2,
});

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.common.white, 0.15),
  '&:hover': {
    backgroundColor: alpha(theme.palette.common.white, 0.25),
  },
  marginLeft: 0,
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(1),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: 'inherit',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1, 1, 1, 0),
    // vertical padding + font size from searchIcon
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
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
  const [library, setLibrary] = useState<StoreStructure['library']>();

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

  /**
   * @dev update the current song and metadata then let the song play.
   *      in the bg request and set the album art from main process.
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

    // request the album art for the file from the main process
    window.electron.ipcRenderer.sendMessage('get-album-art', {
      path: song,
    });

    // set the current song data url when the main process responds
    window.electron.ipcRenderer.once('get-album-art', async (event) => {
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
    });

    // play the song regardless of when the main process responds
    setPaused(false);
  };

  const playNextSong = async () => {
    if (!library) return;
    const keys = Object.keys(library);
    const currentSongIndex = keys.indexOf(currentSong || '');
    const nextSongIndex = currentSongIndex + 1;
    if (nextSongIndex >= keys.length) {
      return;
    }
    const nextSong = keys[nextSongIndex];
    const nextSongMeta = library[nextSong];
    await playSong(nextSong, nextSongMeta);
  };

  const playPreviousSong = async () => {
    if (!library) return;
    const keys = Object.keys(library);
    const currentSongIndex = keys.indexOf(currentSong || '');
    const previousSongIndex = currentSongIndex - 1;
    if (previousSongIndex < 0) {
      return;
    }
    const previousSong = keys[previousSongIndex];
    const previousSongMeta = library[previousSong];
    await playSong(previousSong, previousSongMeta);
  };

  /**
   * @dev allow user to select a directory and import all songs within it
   */
  const importSongs = async () => {
    setShowImportingProgress(true);
    window.electron.ipcRenderer.on('song-imported', (args) => {
      setSongsImported((args as any).songsImported);
      setTotalSongs((args as any).totalSongs);
    });

    window.electron.ipcRenderer.once('select-dirs', (arg) => {
      const typedArg = arg as StoreStructure;
      setLibrary(typedArg.library);
      setShowImportingProgress(false);
    });
    window.electron.ipcRenderer.sendMessage('select-dirs');
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
    if (!library) return null;

    const song = Object.keys(library)[index];

    return (
      <div
        key={key}
        style={style}
        onDoubleClick={async () => {
          await playSong(song, library[song]);
        }}
        data-state={song === currentSong ? 'selected' : undefined}
        className="flex w-full items-center border-b border-neutral-800 transition-colors hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 py-1 divide-neutral-50"
      >
        <div className="whitespace-nowrap	overflow-hidden flex-1 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {library?.[song].common.title}
        </div>
        <div className="whitespace-nowrap	overflow-hidden flex-1 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {library?.[song].common.artist}
        </div>
        <div className="whitespace-nowrap	overflow-hidden flex-1 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {library?.[song].common.album}
        </div>
        <div className="w-14 py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
          {convertToMMSS(library?.[song].format.duration || 0)}
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
      setRowContainerHeight(
        height - playerHeight - artContainerHeight - rowHeight,
      );
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

      const artContainerHeight =
        document.querySelector('.art')?.clientHeight || 0;
      const playerHeight = document.querySelector('.player')?.clientHeight || 0;

      if (height) {
        setRowContainerHeight(
          height - playerHeight - artContainerHeight - rowHeight,
        );
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
          className="nodrag absolute top-6 right-4 items-center justify-center
          rounded-md font-medium ring-offset-background transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 disabled:pointer-events-none
          disabled:opacity-50 border border-neutral-800 bg-background
          hover:bg-white hover:text-black
          px-4 py-2.5"
        >
          <LibraryAddOutlined />
        </button>

        <Search>
          <SearchIconWrapper>
            <SearchIcon />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="Search…"
            inputProps={{ 'aria-label': 'search' }}
          />
        </Search>
      </div>

      <div className="w-full overflow-auto">
        <div className="w-full text-[11px]">
          <div className="sticky top-0 z-50 bg-[#0d0d0d] outline outline-offset-0 outline-1 outline-neutral-800">
            <div className="flex transition-colors divide-neutral-50">
              <div className="py-1 flex-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0">
                Song
              </div>
              <div className="py-1 flex-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0">
                Artist
              </div>
              <div className="py-1 flex-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0">
                Album
              </div>
              {/**
               * @dev slightly diff size to accomodate the lack of scroll bar
               * next to it, unlike a normal row.
               */}
              <div
                aria-label="duration"
                className="py-1 w-14 text-center px-4 mr-2 align-middle font-medium hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
              >
                <AccessTimeIcon fontSize="inherit" />
              </div>
            </div>
          </div>
          {/**
           * @dev since the list could be 1000s of songs long we must virtualize it
           */}
          <List
            width={width || 0}
            height={rowContainerHeight}
            rowRenderer={renderSongRow}
            rowCount={Object.keys(library || {}).length}
            rowHeight={rowHeight}
          />
        </div>
      </div>

      <div className="player drag gap-4 fixed inset-x-0 border-t border-neutral-800 bottom-0 bg-[#0d0d0d] shadow-md px-4 py-3 flex items-center justify-between">
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
            color="inherit"
          >
            <FastRewindRounded fontSize="medium" />
          </IconButton>
          <IconButton
            aria-label={paused ? 'play' : 'pause'}
            color="inherit"
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
        <div className="flex justify-end flex-1 mt-2">
          <ContinuousSlider
            onChange={(event, value) => {
              audioTagRef.current!.volume = (value as number) / 100;
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
