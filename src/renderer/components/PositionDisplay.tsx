import React, { useMemo } from 'react';
import { Box, Typography, Slider } from '@mui/material';
import { useSettingsAndPlaybackStore } from '../stores';
import { formatDuration } from '../utils/formatters';

interface PositionDisplayProps {
  disabled?: boolean;
}

// Isolated component for position display and seeking
// This prevents the entire Player component from re-rendering when position updates
const PositionDisplay = React.memo(
  ({ disabled = false }: PositionDisplayProps) => {
    // Subscribe only to position and duration to minimize re-renders
    const position = useSettingsAndPlaybackStore((state) => state.position);
    const duration = useSettingsAndPlaybackStore((state) => state.duration);
    const seekToPosition = useSettingsAndPlaybackStore(
      (state) => state.seekToPosition,
    );

    const formattedSeekPosition = useMemo(
      () => formatDuration(position),
      [position],
    );

    const formattedTimeLeft = useMemo(() => {
      const timeLeftMs = duration - position;
      if (timeLeftMs <= 0) return '-0:00';
      return `-${formatDuration(timeLeftMs)}`;
    }, [duration, position]);

    return (
      <Box
        sx={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          mt: 0.5,
        }}
      >
        <Typography
          color="textSecondary"
          data-testid="player-elapsed-time"
          sx={{
            mr: 1,
            minWidth: '36px',
            textAlign: 'right',
            fontSize: '11px',
            lineHeight: 1,
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
            mx: 0.25,
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
            minWidth: '36px',
            fontSize: '11px',
            lineHeight: 1,
            userSelect: 'none',
          }}
          variant="caption"
        >
          {formattedTimeLeft}
        </Typography>
      </Box>
    );
  },
);

PositionDisplay.displayName = 'PositionDisplay';

export default PositionDisplay;
