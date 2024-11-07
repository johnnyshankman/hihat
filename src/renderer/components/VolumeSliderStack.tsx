import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import VolumeDown from '@mui/icons-material/VolumeDown';
import VolumeUp from '@mui/icons-material/VolumeUp';
import IconButton from '@mui/material/IconButton';
import usePlayerStore from '../store/player';

export default function VolumeSliderStack({
  onChange,
  value,
}: {
  onChange: (event: Event, newValue: number | number[]) => void;
  value: number;
}) {
  const setVolume = usePlayerStore((store) => store.setVolume);
  const handleChange = (event: Event, newValue: number | number[]) => {
    onChange(event, newValue);
  };

  return (
    <Box sx={{ width: '75%', maxWidth: 220, minWidth: 80 }}>
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="center"
        justifyItems="start"
        spacing={0.5}
      >
        <IconButton
          onClick={() => {
            setVolume(0);
          }}
          size="small"
        >
          <VolumeDown fontSize="small" />
        </IconButton>
        <Slider
          aria-label="Volume"
          color="secondary"
          onChange={handleChange}
          size="small"
          sx={{
            color: 'rgb(133,133,133)',
            '.MuiSlider-thumb': { height: 10, width: 10 },
          }}
          value={value}
        />
        <IconButton
          onClick={() => {
            setVolume(100);
          }}
          size="small"
        >
          <VolumeUp fontSize="small" />
        </IconButton>
      </Stack>
    </Box>
  );
}
