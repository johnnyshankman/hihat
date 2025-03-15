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
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
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
      fontWeight: 600,
    },
    body1: {
      fontSize: '0.875rem',
    },
    body2: {
      fontSize: '0.75rem',
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
      main: '#757575', // Medium gray (replacing green)
      light: '#9E9E9E', // Lighter gray
      dark: '#616161', // Darker gray
    },
    secondary: {
      main: '#666666', // Muted text
    },
    background: {
      default: '#121212', // Very dark background (almost black) from the screenshot
      paper: '#1E1E1E', // Slightly lighter for cards/dialogs
    },
    text: {
      primary: '#FFFFFF',
      secondary: '#AAAAAA',
    },
    divider: '#2A2A2A', // Subtle divider color
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
  components: {
    ...baseThemeOptions.components,
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          scrollbarColor: '#2A2A2A #121212',
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.05)', // Subtle hover effect
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: '1px solid #1A1A1A', // Very subtle table cell borders
          padding: '8px 16px',
        },
        head: {
          fontWeight: 600,
          backgroundColor: '#1A1A1A', // Slightly lighter header background
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: '#121212', // Match the main background color
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none', // Remove default paper background image
        },
      },
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
