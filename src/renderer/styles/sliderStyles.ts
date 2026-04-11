import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Shared baseline for the player's progress and volume sliders so they
 * match in color, thumb size, rail opacity, and the hover/active halo.
 */
export const playerSliderSx: SxProps<Theme> = {
  color: (t) => t.palette.primary.main,
  '& .MuiSlider-thumb': {
    height: 9,
    width: 9,
    '&:hover, &.Mui-focusVisible': {
      boxShadow: '0 0 0 4px rgba(255, 255, 255, 0.08)',
    },
    '&.Mui-active': {
      boxShadow: '0 0 0 6px rgba(255, 255, 255, 0.12)',
    },
  },
  '& .MuiSlider-rail': {
    opacity: 0.35,
  },
};
