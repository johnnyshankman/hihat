import { Box } from '@mui/material';
import { fadeIn } from '../styles/motion';

// Enough rows to fill a tall window; the scroll container clips the rest.
const ROW_COUNT = 48;

// Relative column widths, roughly matching the default library columns
// (title, artist, album, album artist, genre, duration).
const COLUMN_FLEX = [28, 18, 20, 16, 10, 6];

// Deterministic per-row bar lengths so the placeholder reads as varied
// text without re-randomizing on every render.
const BAR_FILL = [72, 54, 86, 63, 45, 92, 58, 77, 66, 49, 81, 60];

/**
 * Placeholder rows shown in the table body while the tracks query is on
 * its initial fetch. Fades in after a short delay so fast loads go
 * straight to real rows without flashing the skeleton.
 */
export default function TableSkeleton() {
  return (
    <Box
      aria-busy="true"
      aria-label="Loading library"
      data-testid="table-skeleton"
      role="status"
      sx={{
        animation: fadeIn('base', '150ms'),
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          alignItems: 'center',
          height: 26,
          px: 1,
          borderBottom: '1px solid var(--vt-divider)',
          backgroundColor: 'var(--vt-bg-paper)',
        }}
      >
        {COLUMN_FLEX.map((flex) => (
          <Box key={flex} sx={{ flex }}>
            <Box className="skeleton-bar" sx={{ width: 48, height: 7 }} />
          </Box>
        ))}
      </Box>
      {Array.from({ length: ROW_COUNT }, (_, row) => (
        <Box
          // eslint-disable-next-line react/no-array-index-key
          key={row}
          sx={{
            display: 'flex',
            gap: 2,
            alignItems: 'center',
            height: 22,
            px: 1,
            backgroundColor:
              row % 2 === 1 ? 'var(--vt-bg-even)' : 'transparent',
          }}
        >
          {COLUMN_FLEX.map((flex, col) => (
            <Box key={flex} sx={{ flex }}>
              <Box
                className="skeleton-bar"
                sx={{
                  width: `${BAR_FILL[(row * 5 + col * 7) % BAR_FILL.length]}%`,
                  height: 7,
                  // Ripple the pulse down the table rather than blinking
                  // every bar in unison.
                  animationDelay: `${(row % 12) * 60}ms`,
                }}
              />
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
}
