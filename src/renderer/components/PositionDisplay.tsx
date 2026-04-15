import { Box, Typography, Slider } from '@mui/material';
import { useSettingsAndPlaybackStore } from '../stores';
import { formatDuration } from '../utils/formatters';
import { playerSliderSx } from '../styles/sliderStyles';

interface PositionDisplayProps {
  disabled?: boolean;
}

// Usage of useMemo and React.memo here is questionable given this component should genuinely update every second
// One possible solution is making the Slider a child component passed in as a child to PositionDisplay so that
// the two components are better isolated for re-renders.

// Isolated component for position display and seeking
// This prevents the entire Player component from re-rendering when position updates
export default function PositionDisplay({
  disabled = false,
}: PositionDisplayProps) {
  // Subscribe only to position and duration to minimize re-renders
  const position = useSettingsAndPlaybackStore((state) => state.position);
  const duration = useSettingsAndPlaybackStore((state) => state.duration);
  const seekToPosition = useSettingsAndPlaybackStore(
    (state) => state.seekToPosition,
  );

  const formattedSeekPosition = formatDuration(position);
  const timeLeftMs = duration - position;
  const formattedTimeLeft =
    timeLeftMs <= 0 ? '-0:00' : `-${formatDuration(timeLeftMs)}`;

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
          fontSize: '12px',
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
          ...playerSliderSx,
        }}
        value={position}
      />
      <Typography
        color="textSecondary"
        sx={{
          ml: 1,
          minWidth: '36px',
          fontSize: '12px',
          lineHeight: 1,
          userSelect: 'none',
        }}
        variant="caption"
      >
        {formattedTimeLeft}
      </Typography>
    </Box>
  );
}
