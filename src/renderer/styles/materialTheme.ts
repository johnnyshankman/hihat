/**
 * Material UI Theme Configuration
 *
 * This file defines the light and dark themes for the application using Material UI's theming system.
 * It provides consistent styling across the application and supports theme switching.
 */

import { createTheme, ThemeOptions } from '@mui/material/styles';

// Base theme options shared between light and dark modes
const baseThemeOptions: ThemeOptions = {
  typography: {
    // use apple ux font aka san francisco
    fontFamily: [
      '-apple-system',
      'DM Sans',
      'Roboto',
      'Helvetica Neue',
      'sans-serif',
    ].join(','),
    h1: {
      fontSize: '1.5rem',
      fontWeight: 600,
    },
    h2: {
      fontSize: '1.25rem',
      fontWeight: 600,
    },
    h3: {
      fontSize: '1.125rem',
      fontWeight: 500,
    },
    body1: {
      fontSize: '16px',
      fontWeight: 500,
    },
    body2: {
      fontSize: '13px',
      fontWeight: 400,
      letterSpacing: '-0.1px',
    },
  },
  shape: {
    borderRadius: 4,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
        },
      },
    },
  },
};

// Dark theme (default)
export const darkTheme = createTheme({
  ...baseThemeOptions,
  palette: {
    mode: 'dark',
    primary: {
      main: '#FFFFFF', // White
    },
    secondary: {
      main: '#666666', // Muted text
    },
    background: {
      default: '#0d0d0d', // Very dark background (almost black) from the screenshot
      paper: '#1d1d1d', // Slightly lighter for cards/dialogs
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#AAAAAA',
    },
    divider: '#1A1A1A', // Subtle divider color
    action: {
      active: '#FFFFFF',
      hover: 'rgba(255, 255, 255, 0.08)',
      selected: 'rgba(255, 255, 255, 0.16)',
      disabled: 'rgba(255, 255, 255, 0.3)',
      disabledBackground: 'rgba(255, 255, 255, 0.12)',
    },
    // Additional colors observed in the screenshot
    grey: {
      50: '#fafafa',
      100: '#f5f5f5',
      200: '#eeeeee',
      300: '#e0e0e0',
      400: '#bdbdbd',
      500: '#9e9e9e',
      600: '#757575',
      700: '#616161',
      800: '#424242',
      900: '#212121',
      A100: '#d5d5d5',
      A200: '#aaaaaa',
      A400: '#303030',
      A700: '#1E1E1E',
    },
  },
});

// Light theme
export const lightTheme = createTheme({
  ...baseThemeOptions,
  palette: {
    mode: 'light',
    primary: {
      main: '#3478DA', // Blue accent
    },
    secondary: {
      main: '#666666', // Muted text
    },
    background: {
      default: '#FFFFFF', // Light background
      paper: '#F5F5F5', // Slightly darker for cards/dialogs
    },
    text: {
      primary: '#000000',
      secondary: '#666666',
    },
  },
});

export default darkTheme; // Export dark theme as default
