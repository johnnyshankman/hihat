import React from 'react';
import Box from '@mui/material/Box';
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded';
import FastForwardRounded from '@mui/icons-material/FastForwardRounded';
import FastRewindRounded from '@mui/icons-material/FastRewindRounded';
import PauseRounded from '@mui/icons-material/PauseRounded';
import { IconButton, Tooltip } from '@mui/material';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import ShuffleOnIcon from '@mui/icons-material/ShuffleOn';
import RepeatIcon from '@mui/icons-material/Repeat';
import Stack from '@mui/material/Stack';
import RepeatOnIcon from '@mui/icons-material/RepeatOn';
import VolumeSliderStack from './VolumeSliderStack';
import SongProgressAndSongDisplay from './SongProgressAndSongDisplay';
import useMainStore from '../store/main';

type StaticPlayerProps = {
  playNextSong: () => void;
  playPreviousSong: () => void;
};

export default function StaticPlayer({
  playNextSong,
  playPreviousSong,
}: StaticPlayerProps) {
  /**
   * @dev store
   */
  const player = useMainStore((state) => state.player);
  const repeating = useMainStore((state) => state.repeating);
  const setRepeating = useMainStore((state) => state.setRepeating);
  const setCurrentSongTime = useMainStore((state) => state.setCurrentSongTime);
  const shuffle = useMainStore((state) => state.shuffle);
  const setShuffle = useMainStore((state) => state.setShuffle);
  const paused = useMainStore((state) => state.paused);
  const setPaused = useMainStore((state) => state.setPaused);
  const currentSongMetadata = useMainStore(
    (state) => state.currentSongMetadata,
  );
  const volume = useMainStore((state) => state.volume);
  const setVolume = useMainStore((state) => state.setVolume);
  const currentSongTime = useMainStore((state) => state.currentSongTime);

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
          <Tooltip title="Song Repeat">
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
          </Tooltip>
          <Tooltip title="Shuffle">
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
          </Tooltip>
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
          <VolumeSliderStack
            onChange={(event, value) => {
              setVolume(value as number);
            }}
            value={volume}
          />
        </div>
      </Box>

      {/**
       * @dev this is song progress bar on mobile and desktop
       */}
      <SongProgressAndSongDisplay
        max={currentSongMetadata?.format?.duration || 0}
        onManualChange={(e: number) => {
          // manually update the player's time BUT ALSO the internal state
          // to ensure that the UX feels snappy. otherwise the UX wouldn't update
          // until the next ontimeupdate event fired.
          setCurrentSongTime(e);
          player.setPosition(e * 1000);
        }}
        value={currentSongTime}
      />

      {/**
       * @dev this is the desktop version of the shuffle, repeat, play button
       */}
      <div className="sm:flex hidden gap-2 relative justify-end flex-1 mt-2 mb-1 w-full">
        <div className="flex flex-row relative bottom-0.5">
          <Tooltip title="Repeat Song">
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
          </Tooltip>
          <Tooltip title="Shuffle">
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
          </Tooltip>
        </div>
        <VolumeSliderStack
          onChange={(event, value) => {
            setVolume(value as number);
          }}
          value={volume}
        />
      </div>
    </div>
  );
}
