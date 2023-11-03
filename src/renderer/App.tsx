/* eslint-disable jsx-a11y/media-has-caption */
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { IAudioMetadata } from 'music-metadata';
import { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import FastForwardRounded from '@mui/icons-material/FastForwardRounded';
import FastRewindRounded from '@mui/icons-material/FastRewindRounded';
import PauseRounded from '@mui/icons-material/PauseRounded';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CircularProgress from '@mui/material/CircularProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import Typography from '@mui/material/Typography';
import { styled, ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import ContinuousSlider from './ContinuousSlider';
import LinearProgressBar from './LinearProgressBar';

import './App.scss';

const TinyText = styled(Typography)({
  fontSize: '0.75rem',
  opacity: 0.38,
  fontWeight: 500,
  letterSpacing: 0.2,
});

function MainDash() {
  const audioTagRef = useRef<HTMLAudioElement>(null);

  const [currentSongTime, setCurrentSongTime] = useState(0);
  const [paused, setPaused] = useState(true);
  const [currentSong, setCurrentSong] = useState<string>();
  const [showImportingProgress, setShowImportingProgress] = useState(false);
  const [currentSongDataURL, setCurrentSongDataURL] = useState<string>();
  const [songsImported, setSongsImported] = useState(0);
  const [totalSongs, setTotalSongs] = useState(0);
  const [currentSongMetadata, setCurrentSongMetadata] =
    useState<IAudioMetadata>();
  const [songMapping, setSongMapping] = useState<{
    [key: string]: IAudioMetadata;
  }>();

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

  const convertToMMSS = (timeInSeconds: number) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    // Ensuring the format is two-digits both for minutes and seconds
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  const playSong = async (song: string, meta: IAudioMetadata) => {
    setCurrentSong(song);
    setCurrentSongMetadata(meta);

    window.electron.ipcRenderer.send('get-album-art', {
      path: song,
    });

    // set the current song data url using the meta data, base64 encoded
    setCurrentSongDataURL(
      await bufferToDataUrl(
        meta.common.picture[0].data,
        meta.common.picture[0].format,
      ),
    );

    setPaused(false);
  };

  const playNextSong = async () => {
    if (!songMapping) return;
    const keys = Object.keys(songMapping);
    const currentSongIndex = keys.indexOf(currentSong || '');
    const nextSongIndex = currentSongIndex + 1;
    if (nextSongIndex >= keys.length) {
      return;
    }
    const nextSong = keys[nextSongIndex];
    const nextSongMeta = songMapping[nextSong];
    await playSong(nextSong, nextSongMeta);
  };

  const playPreviousSong = async () => {
    if (!songMapping) return;
    const keys = Object.keys(songMapping);
    const currentSongIndex = keys.indexOf(currentSong || '');
    const previousSongIndex = currentSongIndex - 1;
    if (previousSongIndex < 0) {
      return;
    }
    const previousSong = keys[previousSongIndex];
    const previousSongMeta = songMapping[previousSong];
    await playSong(previousSong, previousSongMeta);
  };

  const importSongs = async () => {
    // todo: add a progress response
    setShowImportingProgress(true);
    window.electron.ipcRenderer.on('song-imported', (args) => {
      setSongsImported(args.songsImported);
      setTotalSongs(args.totalSongs);
    });

    window.electron.ipcRenderer.once('select-dirs', (arg) => {
      // eslint-disable-next-line no-console
      console.log('finished', arg);
      // @ts-ignore
      setSongMapping(arg);
      setShowImportingProgress(false);
    });
    window.electron.ipcRenderer.sendMessage('select-dirs');
  };

  return (
    <div className="h-full flex flex-col dark">
      <Dialog
        className="flex flex-col items-center justify-center content-center p-10"
        open={showImportingProgress}
      >
        <div className="flex flex-col items-center px-20">
          <DialogTitle>Importing</DialogTitle>
          <CircularProgress
            size={40}
            className="mx-auto mt-2 mb-6"
            color="inherit"
          />
          <div className="flex w-full justify-center p-2 mb-2">
            <TinyText>{`${songsImported} / ${totalSongs}`}</TinyText>
          </div>
        </div>
      </Dialog>
      <div className="flex justify-center p-4 pb-8 space-x-4 md:flex-row">
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
          aria-label="play"
          className="absolute top-6 right-4 items-center justify-center
          rounded-md text-sm font-medium ring-offset-background transition-colors
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 disabled:pointer-events-none
          disabled:opacity-50 border border-neutral-800 bg-background
          hover:bg-white hover:text-black
          h-10 px-4 py-2"
        >
          <svg
            key="0"
            className=" h-5 w-5"
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
        </button>
      </div>

      <div className="w-full overflow-auto">
        <table className="w-full max-h-full caption-bottom text-[11px] p-1 overflow-auto">
          <thead className="sticky top-0 z-50 bg-[#0d0d0d] outline outline-offset-0 outline-1 outline-neutral-800">
            <tr className="transition-colors divide-neutral-50">
              <th className="py-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0">
                Song
              </th>
              <th className="py-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0">
                Artist
              </th>
              <th className="py-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0">
                Album
              </th>
              <th
                aria-label="duration"
                className="py-1 px-4 text-left align-middle font-medium hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 text-neutral-500 [&amp;:has([role=checkbox])]:pr-0"
              >
                <AccessTimeIcon fontSize="inherit" />
              </th>
            </tr>
          </thead>
          <tbody className="[&amp;_tr:last-child]:border-0">
            {Object.keys(songMapping || {}).map((song) => (
              <tr
                key={song}
                onDoubleClick={async () => {
                  // eslint-disable-next-line no-console
                  console.log('double click');
                  await playSong(song, songMapping[song]);
                }}
                className="border-b border-neutral-800 transition-colors hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 py-1 divide-neutral-50"
              >
                <td className="py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
                  {songMapping?.[song].common.title}
                </td>
                <td className="py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
                  {songMapping?.[song].common.artist}
                </td>
                <td className="py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
                  {songMapping?.[song].common.album}
                </td>
                <td className="py-1 px-4 align-middle [&amp;:has([role=checkbox])]:pr-0">
                  {convertToMMSS(songMapping?.[song].format.duration || 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="fixed inset-x-0 border-t border-neutral-800 bottom-0 bg-[#0d0d0d] shadow-md px-4 py-2 flex items-center justify-between">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'start',
            width: '33%',
            flex: 1,
            mt: -1,
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
              4;

              setPaused(!paused);
              // eslint-disable-next-line no-unused-expressions
              audioTagRef.current!.paused
                ? audioTagRef.current!.play()
                : audioTagRef.current!.pause();
            }}
          >
            {paused ? (
              <PlayArrowRounded sx={{ fontSize: '2rem' }} />
            ) : (
              <PauseRounded sx={{ fontSize: '2rem' }} />
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
        <div className="flex justify-end flex-1">
          <ContinuousSlider
            onChange={(event, value) => {
              audioTagRef.current!.volume = (value as number) / 100;
            }}
          />
        </div>
      </div>
      <audio
        className="hidden"
        src={`file://${currentSong}`}
        autoPlay={!paused}
        onEnded={playNextSong}
        onTimeUpdate={(e) => {
          setCurrentSongTime(e.currentTarget.currentTime);
        }}
        ref={audioTagRef}
      />
    </div>
  );
}

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
