import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import VolumeDown from '@mui/icons-material/VolumeDown';
import VolumeUp from '@mui/icons-material/VolumeUp';

export default function ContinuousSlider({
  onChange,
}: {
  onChange: (event: Event, newValue: number | number[]) => void;
}) {
  const [value, setValue] = React.useState<number>(100);

  const handleChange = (event: Event, newValue: number | number[]) => {
    setValue(newValue as number);
    onChange(event, newValue);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 200 }}>
      <Stack spacing={1} direction="row" sx={{ mb: 1 }} alignItems="center">
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
