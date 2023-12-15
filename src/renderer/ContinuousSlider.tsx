import * as React from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Slider from '@mui/material/Slider';
import VolumeDown from '@mui/icons-material/VolumeDown';
import VolumeUp from '@mui/icons-material/VolumeUp';
import { IconButton } from '@mui/material';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import ShuffleOnIcon from '@mui/icons-material/ShuffleOn';
import RepeatIcon from '@mui/icons-material/Repeat';
import RepeatOnIcon from '@mui/icons-material/RepeatOn';

export default function ContinuousSlider({
  onChange,
  onShuffleChange,
  onRepeatingChange,
}: {
  onChange: (event: Event, newValue: number | number[]) => void;
  onShuffleChange: (isShuffled: boolean) => void;
  onRepeatingChange: (isRepeating: boolean) => void;
}) {
  const [value, setValue] = React.useState<number>(100);
  const [isShuffled, setIsShuffled] = React.useState<boolean>(false);
  const [isRepeating, setIsRepeating] = React.useState<boolean>(false);

  const handleChange = (event: Event, newValue: number | number[]) => {
    setValue(newValue as number);
    onChange(event, newValue);
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 180 }}>
      <Stack
        spacing={1.5}
        direction="row"
        alignItems="center"
        justifyContent="center"
        justifyItems="start"
      >
        <Stack
          spacing={0}
          direction="row"
          alignItems="center"
          justifyContent="center"
          justifyItems="center"
        >
          <IconButton
            sx={{
              fontSize: '1rem',

              position: {
                xs: 'absolute',
                sm: 'relative',
              },
              left: { xs: 0, sm: 'auto' },
              color: 'rgb(133,133,133)',
            }}
            onClick={() => {
              const newValue = !isRepeating;
              setIsRepeating(newValue);
              onRepeatingChange(newValue);
            }}
          >
            {isRepeating ? (
              <RepeatOnIcon fontSize="inherit" />
            ) : (
              <RepeatIcon fontSize="inherit" />
            )}
          </IconButton>
          <IconButton
            sx={{
              fontSize: '1rem',
              position: {
                // @dev on small sized screens make it absolute
                xs: 'absolute',
                sm: 'relative',
              },
              left: { xs: '1.5rem', sm: 'auto' },
              color: 'rgb(133,133,133)',
            }}
            onClick={() => {
              const newValue = !isShuffled;
              setIsShuffled(newValue);
              onShuffleChange(newValue);
            }}
          >
            {isShuffled ? (
              <ShuffleOnIcon fontSize="inherit" />
            ) : (
              <ShuffleIcon fontSize="inherit" />
            )}
          </IconButton>
        </Stack>
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
