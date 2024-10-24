import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import VolumeDown from '@mui/icons-material/VolumeDown';
import VolumeUp from '@mui/icons-material/VolumeUp';

export default function VolumeSliderStack({
  onChange,
  value,
}: {
  onChange: (event: Event, newValue: number | number[]) => void;
  value: number;
}) {
  const handleChange = (event: Event, newValue: number | number[]) => {
    onChange(event, newValue);
  };

  return (
    <Box sx={{ width: '75%', maxWidth: 180, minWidth: 80 }}>
      <Stack
        alignItems="center"
        direction="row"
        justifyContent="center"
        justifyItems="start"
        spacing={1.5}
      >
        <VolumeDown fontSize="small" />
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
        <VolumeUp fontSize="small" />
      </Stack>
    </Box>
  );
}
