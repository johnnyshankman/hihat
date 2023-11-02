/* eslint-disable jsx-a11y/media-has-caption */
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { IAudioMetadata } from 'music-metadata';
import { useState, useRef, useEffect } from 'react';
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

import ContinuousSlider from './ContinuousSlider';
import LinearProgressBar from './LinearProgressBar';

import placeholder from '../../assets/placeholder.svg';
import './App.css';

function MainDash() {
  const audioTagRef = useRef<HTMLAudioElement>(null);

  const [songMapping, setSongMapping] = useState<{
    [key: string]: IAudioMetadata;
  }>();
  const [currentSongTime, setCurrentSongTime] = useState(0);
  const [paused, setPaused] = useState(false);
  const [currentSong, setCurrentSong] = useState<string>();
  const [showImportingProgress, setShowImportingProgress] = useState(false);
  const [currentSongMetadata, setCurrentSongMetadata] =
    useState<IAudioMetadata>();
  const [currentSongDataURL, setCurrentSongDataURL] = useState<string>();

  // some day i'd like to get this working again but my library config breaks the heap size
  useEffect(() => {
    window.electron.ipcRenderer.once('initialize', (arg) => {
      // eslint-disable-next-line no-console
      console.log('start up', arg);
      // @ts-ignore
      setSongMapping(arg);
    });
  }, []);

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

  function convertToMMSS(timeInSeconds: number) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    // Ensuring the format is two-digits both for minutes and seconds
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  const playSong = async (song: string, meta: IAudioMetadata) => {
    setCurrentSong(song);
    setCurrentSongMetadata(meta);

    if (meta.common.picture?.length) {
      // set the current song data url using the meta data, base64 encoded
      setCurrentSongDataURL(
        await bufferToDataUrl(
          meta.common.picture[0].data,
          meta.common.picture[0].format,
        ),
      );
    }
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

  return (
    <div className="h-full flex flex-col">
      <Dialog
        className="flex flex-col items-center justify-center content-center"
        onClose={() => {
          setShowImportingProgress(false);
        }}
        open={showImportingProgress}
      >
        <DialogTitle>Importing</DialogTitle>
        <CircularProgress
          size={30}
          className="mx-auto mt-2 mb-6"
          color="inherit"
        />
      </Dialog>
      <div className="flex justify-center p-4 pb-8 space-x-4 md:flex-row">
        <img
          src={currentSongDataURL || placeholder}
          height="200"
          width="200"
          alt="Album Art"
          className="object-cover rounded-lg shadow-md"
          style={{
            aspectRatio: '200/200',
            objectFit: 'cover',
          }}
        />
        <button
          onClick={async () => {
            // todo: add a progress response
            setShowImportingProgress(true);
            window.electron.ipcRenderer.once('select-dirs', (arg) => {
              // eslint-disable-next-line no-console
              console.log('finished', arg);
              // @ts-ignore
              setSongMapping(arg);
              setShowImportingProgress(false);
            });
            window.electron.ipcRenderer.sendMessage('select-dirs');
          }}
          type="button"
          aria-label="play"
          className="absolute top-4 right-4 items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2"
        >
          <svg
            key="0"
            className=" h-5 w-5 text-black dark:text-white"
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
        <table className="w-full max-h-full caption-bottom text-[10px] p-1 overflow-auto">
          <thead className="sticky top-0 z-50 bg-white outline outline-offset-0 outline-1 outline-slate-100">
            <tr className="transition-colors divide-slate-50">
              <th className="py-1 px-4 text-left align-middle font-medium hover:bg-muted/50 data-[state=selected]:bg-muted text-muted-foreground [&amp;:has([role=checkbox])]:pr-0">
                Song
              </th>
              <th className="py-1 px-4 text-left align-middle font-medium hover:bg-muted/50 data-[state=selected]:bg-muted text-muted-foreground [&amp;:has([role=checkbox])]:pr-0">
                Artist
              </th>
              <th className="py-1 px-4 text-left align-middle font-medium hover:bg-muted/50 data-[state=selected]:bg-muted text-muted-foreground [&amp;:has([role=checkbox])]:pr-0">
                Album
              </th>
              <th
                aria-label="duration"
                className="py-1 px-4 text-left align-middle font-medium hover:bg-muted/50 data-[state=selected]:bg-muted text-muted-foreground [&amp;:has([role=checkbox])]:pr-0"
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
                className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted py-1 divide-slate-50"
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

      <div className="fixed inset-x-0 border-t bottom-0 bg-white shadow-md p-4 flex items-center justify-between">
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mt: -1,
          }}
        >
          <IconButton aria-label="previous song" onClick={playPreviousSong}>
            <FastRewindRounded fontSize="medium" htmlColor="#000" />
          </IconButton>
          <IconButton
            aria-label={paused ? 'play' : 'pause'}
            onClick={() => {
              setPaused(!paused);
              // eslint-disable-next-line no-unused-expressions
              audioTagRef.current!.paused
                ? audioTagRef.current!.play()
                : audioTagRef.current!.pause();
            }}
          >
            {paused ? (
              <PlayArrowRounded sx={{ fontSize: '2rem' }} htmlColor="#000" />
            ) : (
              <PauseRounded sx={{ fontSize: '2rem' }} htmlColor="#000" />
            )}
          </IconButton>
          <IconButton aria-label="next song" onClick={playNextSong}>
            <FastForwardRounded fontSize="medium" htmlColor="#000" />
          </IconButton>
        </Box>
        <LinearProgressBar
          value={currentSongTime}
          onManualChange={(e: number) => {
            setCurrentSongTime(e);
            if (audioTagRef?.current) {
              audioTagRef.current.currentTime = e;
            }
          }}
        />
        <div className="flex items-center">
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
        onTimeUpdate={(e) => {
          setCurrentSongTime(e.currentTarget.currentTime);
        }}
        ref={audioTagRef}
      />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<MainDash />} />
      </Routes>
    </Router>
  );
}
