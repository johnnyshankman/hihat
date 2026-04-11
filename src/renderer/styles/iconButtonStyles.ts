import type { SxProps, Theme } from '@mui/material/styles';

/**
 * Baseline style for every non-primary IconButton in the app.
 * Muted by default, brightens on hover. Used by stateless buttons.
 */
export const mutedIconButtonSx: SxProps<Theme> = {
  color: 'text.secondary',
  '&:hover': {
    color: 'text.primary',
  },
};

/**
 * Style for IconButtons that represent a toggle. When `active` is true
 * the button sits at primary.main (highlighted); when false it sits at
 * text.secondary (muted). Hover always moves one step toward primary.
 */
export const toggleIconButtonSx = (active: boolean): SxProps<Theme> => ({
  color: active ? 'primary.main' : 'text.secondary',
  '&:hover': {
    color: active ? 'primary.dark' : 'text.primary',
  },
});
