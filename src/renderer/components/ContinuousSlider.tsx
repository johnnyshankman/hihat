import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import VolumeDown from '@mui/icons-material/VolumeDown';
import VolumeUp from '@mui/icons-material/VolumeUp';

export default function ContinuousSlider({
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
        spacing={1.5}
        direction="row"
        alignItems="center"
        justifyContent="center"
        justifyItems="start"
      >
        <VolumeDown fontSize="small" />
        <Slider
          size="small"
          color="secondary"
          aria-label="Volume"
          value={value}
          onChange={handleChange}
          sx={{ color: 'rgb(133,133,133)' }}
        />
        <VolumeUp fontSize="small" />
      </Stack>
    </Box>
  );
}
