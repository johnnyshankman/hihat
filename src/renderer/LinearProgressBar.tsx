import * as React from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
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
}: {
  value: number;
  onManualChange: (value: number) => void;
  title: string;
}) {
  const duration = 200; // seconds
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
    <Box sx={{ width: '33%' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mb: '-3px',
        }}
      >
        <TinyText>{title}</TinyText>
      </Box>
      <Slider
        aria-label="time-indicator"
        size="small"
        value={position}
        min={0}
        step={1}
        max={duration}
        onChange={(_, val) => {
          setPosition(val as number);
          onManualChange(val as number);
        }}
        sx={{
          color: 'rgba(255, 255, 255, 0.5)',
          height: 4,
          '& .MuiSlider-thumb': {
            width: 8,
            height: 8,
            transition: '0.3s cubic-bezier(.47,1.64,.41,.8)',
            '&:before': {
              boxShadow: '0 2px 12px 0 rgba(0,0,0,0.4)',
            },
            '&:hover, &.Mui-focusVisible': {
              boxShadow: `0px 0px 0px 8px ${'rgb(0 0 0 / 16%)'}`,
            },
            '&.Mui-active': {
              width: 20,
              height: 20,
            },
          },
          '& .MuiSlider-rail': {
            opacity: 0.28,
          },
        }}
      />
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          mt: -2,
        }}
      >
        <TinyText>{convertToMMSS(position)}</TinyText>
        <TinyText>-{convertToMMSS(duration - position)}</TinyText>
      </Box>
    </Box>
  );
}
