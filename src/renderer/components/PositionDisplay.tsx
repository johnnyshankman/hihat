import React, { useMemo } from 'react';
import { Box, Typography, Slider } from '@mui/material';
import { useSettingsAndPlaybackStore } from '../stores';
import { formatDuration } from '../utils/formatters';

interface PositionDisplayProps {
  isCompactLayout?: boolean;
  disabled?: boolean;
}

// Isolated component for position display and seeking
// This prevents the entire Player component from re-rendering when position updates
const PositionDisplay = React.memo(({ isCompactLayout = false, disabled = false }: PositionDisplayProps) => {
  // Subscribe only to position and duration to minimize re-renders
  const position = useSettingsAndPlaybackStore((state) => state.position);
  const duration = useSettingsAndPlaybackStore((state) => state.duration);
  const seekToPosition = useSettingsAndPlaybackStore((state) => state.seekToPosition);

  const formattedSeekPosition = useMemo(
    () => formatDuration(position),
    [position],
  );

  const formattedTimeLeft = useMemo(() => {
    const timeLeftMs = duration - position;
    if (timeLeftMs <= 0) return '-0:00';
    return `-${formatDuration(timeLeftMs)}`;
  }, [duration, position]);

  if (isCompactLayout) {
    // Compact layout - just the slider
    return (
      <Slider
        disabled={disabled}
        max={duration}
        onChange={(_, val) => {
          seekToPosition(val as number);
        }}
        size="small"
        sx={{
          width: '100%',
          color: (t) => t.palette.grey[500],
          '& .MuiSlider-thumb': {
            height: 6,
            width: 6,
          },
          '& .MuiSlider-track': {
            height: 2,
          },
          '& .MuiSlider-rail': {
            height: 2,
          },
        }}
        value={position}
      />
    );
  }

  // Normal layout with time labels and slider
  return (
    <Box
      sx={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        mt: 0.0,
        mb: 0.5,
        maxWidth: '500px',
      }}
    >
      <Typography
        color="textSecondary"
        sx={{
          mr: 1,
          minWidth: { xs: '30px', sm: '40px' },
          textAlign: 'right',
          fontSize: { xs: '0.65rem', sm: '0.75rem' },
          userSelect: 'none',
        }}
        variant="caption"
      >
        {formattedSeekPosition}
      </Typography>
      <Slider
        disabled={disabled}
        max={duration}
        onChange={(_, val) => {
          seekToPosition(val as number);
        }}
        size="small"
        sx={{
          mx: 0.5,
          color: (t) => t.palette.grey[500],
          '& .MuiSlider-thumb': {
            height: 8,
            width: 8,
          },
        }}
        value={position}
      />
      <Typography
        color="textSecondary"
        sx={{
          ml: 1,
          minWidth: { xs: '30px', sm: '40px' },
          fontSize: { xs: '0.65rem', sm: '0.75rem' },
          userSelect: 'none',
        }}
        variant="caption"
      >
        {formattedTimeLeft}
      </Typography>
    </Box>
  );
});

PositionDisplay.displayName = 'PositionDisplay';

export default PositionDisplay;