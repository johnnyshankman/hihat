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
  const [value, setValue] = React.useState<number>(30);

  const handleChange = (event: Event, newValue: number | number[]) => {
    setValue(newValue as number);
    onChange(event, newValue);
  };

  return (
    <Box sx={{ width: 200 }}>
      <Stack spacing={2} direction="row" sx={{ mb: 1 }} alignItems="center">
        <VolumeDown />
        <Slider
          size="small"
          color="secondary"
          aria-label="Volume"
          value={value}
          onChange={handleChange}
        />
        <VolumeUp />
      </Stack>
    </Box>
  );
}
