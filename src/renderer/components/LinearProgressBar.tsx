import * as React from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import { Tooltip } from '@mui/material';
import { LessOpaqueTinyText } from './SimpleStyledMaterialUIComponents';
import usePlayerStore from '../store/player';

export default function LinearProgressBar({
  value,
  onManualChange,
  max,
}: {
  value: number;
  onManualChange: (value: number) => void;
  max: number;
}) {
  const [position, setPosition] = React.useState(32);
  const filteredLibrary = usePlayerStore((state) => state.filteredLibrary);
  const currentSongMetadata = usePlayerStore(
    (state) => state.currentSongMetadata,
  );
  const setOverrideScrollToIndex = usePlayerStore(
    (store) => store.setOverrideScrollToIndex,
  );

  function convertToMMSS(timeInSeconds: number) {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    // Ensuring the format is two-digits both for minutes and seconds
    return `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  }

  React.useEffect(() => {
    setPosition(value);
  }, [value]);

  return (
    <Box
      className="sm:w-1/3 w-full sm:px-0 px-4"
      sx={{ display: 'flex', flexDirection: 'column' }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Tooltip arrow placement="top" title="Scroll to song">
          <LessOpaqueTinyText
            aria-label="current-title"
            onClick={() => {
              // find the index of this song in the library
              // @TODO: this really needs to be extracted into a helper function
              const libraryArray = Object.values(filteredLibrary);
              const index = libraryArray.findIndex(
                (song) =>
                  song.common.title === currentSongMetadata.common?.title &&
                  song.common.artist === currentSongMetadata.common?.artist &&
                  song.common.album === currentSongMetadata.common?.album,
              );

              // flip between undefined and the index very quickly
              setOverrideScrollToIndex(index);
            }}
            sx={{
              margin: 0,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              '&:hover': {
                opacity: 0.75,
              },
            }}
          >
            {currentSongMetadata.common?.title || 'No song selected'}
          </LessOpaqueTinyText>
        </Tooltip>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Slider
          aria-label="time-indicator"
          color="primary"
          max={max}
          min={0}
          onChange={(_, val) => {
            setPosition(val as number);
            onManualChange(val as number);
          }}
          size="small"
          step={1}
          sx={{
            color: 'rgba(133, 133, 133)',
            padding: '6px 0',
            '& .MuiSlider-thumb': {
              height: 8,
              width: 8,
            },
          }}
          value={position}
        />
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
        }}
      >
        <LessOpaqueTinyText aria-label="current-time">
          {convertToMMSS(position)}
        </LessOpaqueTinyText>

        <Tooltip arrow placement="top" title="Scroll to artist">
          <LessOpaqueTinyText
            aria-label="current-artist"
            onClick={() => {
              const libraryArray = Object.values(filteredLibrary);
              const index = libraryArray.findIndex(
                (song) =>
                  song.common.title === currentSongMetadata.common?.title &&
                  song.common.artist === currentSongMetadata.common?.artist &&
                  song.common.album === currentSongMetadata.common?.album,
              );

              setOverrideScrollToIndex(index);
            }}
            sx={{
              margin: 0,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              cursor: 'pointer',
              transition: 'opacity 0.2s',
              '&:hover': {
                opacity: 0.75,
              },
            }}
          >
            {currentSongMetadata.common?.artist || '--'}
          </LessOpaqueTinyText>
        </Tooltip>

        <LessOpaqueTinyText aria-label="current-max-time">
          -{convertToMMSS(max - position)}
        </LessOpaqueTinyText>
      </Box>
    </Box>
  );
}
