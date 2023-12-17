import * as React from 'react';
import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import { styled } from '@mui/material/styles';
import Typography from '@mui/material/Typography';

const TinyText = styled(Typography)({
  fontSize: '0.75rem',
  textAlign: 'center',
  opacity: 0.5,
  fontWeight: 500,
  letterSpacing: 0.2,
});

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
        <TinyText>{title}</TinyText>
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
        }}
      >
        <TinyText aria-label="current-time">{convertToMMSS(position)}</TinyText>
        <TinyText aria-label="current-artist">{artist}</TinyText>
        <TinyText aria-label="current-max-time">
          -{convertToMMSS(max - position)}
        </TinyText>
      </Box>
    </Box>
  );
}
