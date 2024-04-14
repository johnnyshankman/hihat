import * as React from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import { LessOpaqueTinyText } from './SimpleStyledMaterialUIComponents';
import usePlayerStore from '../store/player';

export default function LinearProgressBar({
  value,
  onManualChange,
  title,
  artist,
  max,
}: {
  value: number;
  onManualChange: (value: number) => void;
  title: string;
  artist: string;
  max: number;
}) {
  const [position, setPosition] = React.useState(32);
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
        <LessOpaqueTinyText
          sx={{
            margin: 0,
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
          aria-label="current-title"
          onClick={() => {
            // find the index of this song in the library
            // @TODO: this really needs to be extracted into a helper function
            const library = usePlayerStore.getState().filteredLibrary;
            const libraryArray = Object.values(library);
            const index = libraryArray.findIndex(
              (song) =>
                song.common.title === title && song.common.artist === artist,
            );

            setOverrideScrollToIndex(index);
          }}
        >
          {title}
        </LessOpaqueTinyText>
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Slider
          color="primary"
          aria-label="time-indicator"
          size="small"
          value={position}
          min={0}
          step={1}
          max={max}
          onChange={(_, val) => {
            setPosition(val as number);
            onManualChange(val as number);
          }}
          sx={{
            color: 'rgba(133, 133, 133)',
            padding: '6px 0',
            '& .MuiSlider-thumb': {
              height: 8,
              width: 8,
            },
          }}
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
        <LessOpaqueTinyText
          sx={{
            margin: 0,
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            cursor: 'pointer',
          }}
          aria-label="current-artist"
          onClick={() => {
            // find the index of this song in the library
            // @TODO: this really needs to be extracted into a helper function
            const library = usePlayerStore.getState().filteredLibrary;
            const libraryArray = Object.values(library);
            const index = libraryArray.findIndex(
              (song) =>
                song.common.title === title && song.common.artist === artist,
            );

            setOverrideScrollToIndex(index);
          }}
        >
          {artist}
        </LessOpaqueTinyText>
        <LessOpaqueTinyText aria-label="current-max-time">
          -{convertToMMSS(max - position)}
        </LessOpaqueTinyText>
      </Box>
    </Box>
  );
}
