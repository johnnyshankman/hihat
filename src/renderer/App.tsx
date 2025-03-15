import React, { useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import MainLayout from './components/MainLayout';
import MiniPlayer from './components/MiniPlayer';
import { lightTheme, darkTheme } from './styles/materialTheme';
import { usePlaybackStore, useSettingsStore, useUIStore } from './stores';
import './App.css';

// Check if this is a mini player window
const isMiniPlayerWindow =
  new URLSearchParams(window.location.search).get('miniPlayer') === 'true';

// Mini player specific app that only renders the mini player
function MiniPlayerApp() {
  const settings = useSettingsStore((state) => state.settings);
  const previewTheme = useUIStore((state) => state.theme);

  // Use the preview theme if available, otherwise use the theme from settings
  const themeToUse = previewTheme || settings?.theme || 'dark';
  const theme = themeToUse === 'light' ? lightTheme : darkTheme;

  // Set data attribute on body for mini player specific styling
  useEffect(() => {
    document.body.setAttribute('data-mini-player', 'true');
    // Set the entire app as draggable by default
    document.body.classList.add('draggable');
    return () => {
      document.body.removeAttribute('data-mini-player');
      document.body.classList.remove('draggable');
    };
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <MiniPlayer />
    </ThemeProvider>
  );
}

// Main app component
function ThemedApp() {
  const settings = useSettingsStore((state) => state.settings);
  const previewTheme = useUIStore((state) => state.theme);
  const initPlayer = usePlaybackStore((state) => state.initPlayer);

  // Use the preview theme if available, otherwise use the theme from settings
  const themeToUse = previewTheme || settings?.theme || 'dark';
  const theme = themeToUse === 'light' ? lightTheme : darkTheme;

  // Set the entire app as draggable by default, only ever run this once
  useEffect(() => {
    initPlayer(); // also init the global player just one time ever
    document.body.classList.add('draggable');
    return () => {
      document.body.classList.remove('draggable');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router>
        <Routes>
          <Route path="/" element={<MainLayout />} />
          <Route path="/mini-player" element={<MiniPlayer />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

// Main app wrapper
export default function App() {
  // Initialize stores if needed
  // Note: Most initialization is now done in the store files themselves

  return isMiniPlayerWindow ? <MiniPlayerApp /> : <ThemedApp />;
}
