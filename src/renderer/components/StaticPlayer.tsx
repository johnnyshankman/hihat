import React from 'react';
import Box from '@mui/material/Box';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import FastForwardRounded from '@mui/icons-material/FastForwardRounded';
import FastRewindRounded from '@mui/icons-material/FastRewindRounded';
import PauseRounded from '@mui/icons-material/PauseRounded';
import { IconButton } from '@mui/material';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import ShuffleOnIcon from '@mui/icons-material/ShuffleOn';
import RepeatIcon from '@mui/icons-material/Repeat';
import Stack from '@mui/material/Stack';
import RepeatOnIcon from '@mui/icons-material/RepeatOn';
import ContinuousSlider from './ContinuousSlider';
import LinearProgressBar from './LinearProgressBar';
import usePlayerStore from '../store/player';

type StaticPlayerProps = {
  audioTagRef: React.RefObject<HTMLAudioElement>;
  playNextSong: () => void;
  playPreviousSong: () => void;
};

export default function StaticPlayer({
  audioTagRef,
  playNextSong,
  playPreviousSong,
}: StaticPlayerProps) {
  /**
   * @dev store
   */
  const repeating = usePlayerStore((state) => state.repeating);
  const setRepeating = usePlayerStore((state) => state.setRepeating);
  const shuffle = usePlayerStore((state) => state.shuffle);
  const setShuffle = usePlayerStore((state) => state.setShuffle);
  const paused = usePlayerStore((state) => state.paused);
  const setPaused = usePlayerStore((state) => state.setPaused);
  const currentSongMetadata = usePlayerStore(
    (state) => state.currentSongMetadata,
  );
  const volume = usePlayerStore((state) => state.volume);
  const setVolume = usePlayerStore((state) => state.setVolume);
  const currentSongTime = usePlayerStore((state) => state.currentSongTime);
  const setCurrentSongTime = usePlayerStore(
    (state) => state.setCurrentSongTime,
  );
  return (
    <div
      className="player flex flex-col sm:flex-row items-center
       justify-between drag gap-1 sm:gap-10 inset-x-0 border-t
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
            onClick={() => {
              const newValue = !repeating;
              setRepeating(newValue);
            }}
            sx={{
              fontSize: '1rem',
              color: 'rgb(133,133,133)',
            }}
          >
            {repeating ? (
              <RepeatOnIcon fontSize="inherit" />
            ) : (
              <RepeatIcon fontSize="inherit" />
            )}
          </IconButton>
          <IconButton
            onClick={() => {
              const newValue = !shuffle;
              setShuffle(newValue);
            }}
            sx={{
              fontSize: '1rem',
              color: 'rgb(133,133,133)',
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
          alignItems="center"
          direction="row"
          justifyContent="center"
          justifyItems="center"
          spacing={0}
        >
          <IconButton
            aria-label="previous song"
            color="inherit"
            disabled={!currentSongMetadata}
            onClick={playPreviousSong}
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
            color="inherit"
            disabled={!currentSongMetadata}
            onClick={playNextSong}
          >
            <FastForwardRounded fontSize="medium" />
          </IconButton>
        </Stack>

        {/**
         * @dev this is the volume slider on mobile and desktop
         */}
        <div className="flex sm:hidden justify-end flex-1 mt-1 mb-1">
          <ContinuousSlider
            onChange={(event, value) => {
              audioTagRef.current!.volume = (value as number) / 100;
              setVolume(value as number);
            }}
            value={volume}
          />
        </div>
      </Box>

      {/**
       * @dev this is song progress bar on mobile and desktop
       */}
      <LinearProgressBar
        max={currentSongMetadata?.format?.duration || 0}
        onManualChange={(e: number) => {
          setCurrentSongTime(e);
          if (audioTagRef?.current) {
            audioTagRef.current.currentTime = e;
          }
        }}
        value={currentSongTime}
      />

      {/**
       * @dev this is the desktop version of the shuffle, repeat, play button
       */}
      <div className="sm:flex hidden gap-2 relative justify-end flex-1 mt-2 mb-1 w-full">
        <div className="flex flex-row relative bottom-0.5">
          <IconButton
            onClick={() => {
              const newValue = !repeating;
              setRepeating(newValue);
            }}
            sx={{
              fontSize: '1rem',
              color: 'rgb(133,133,133)',
            }}
          >
            {repeating ? (
              <RepeatOnIcon fontSize="inherit" />
            ) : (
              <RepeatIcon fontSize="inherit" />
            )}
          </IconButton>
          <IconButton
            onClick={() => {
              const newValue = !shuffle;
              setShuffle(newValue);
            }}
            sx={{
              fontSize: '1rem',
              color: 'rgb(133,133,133)',
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
          onChange={(event, value) => {
            audioTagRef.current!.volume = (value as number) / 100;
            setVolume(value as number);
          }}
          value={volume}
        />
      </div>
    </div>
  );
}
