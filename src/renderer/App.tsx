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

  // Get the current track and playback state for cleanup
  const currentTrack = usePlaybackStore((state) => state.currentTrack);
  const paused = usePlaybackStore((state) => state.paused);
  const lastPlaybackTimeUpdateRef = usePlaybackStore(
    (state) => state.lastPlaybackTimeUpdateRef,
  );
  const position = usePlaybackStore((state) => state.position);
  const lastPosition = usePlaybackStore((state) => state.lastPosition);

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

  // Handle application shutdown by updating play count tracking
  useEffect(() => {
    if (!isMiniPlayerWindow) {
      const handleBeforeUnload = async () => {
        // Import modules here to avoid circular dependencies
        const { playbackTracker, updatePlayCount } = await import(
          './utils/playbackTracker'
        );

        // If there's a track playing and we're not paused, update the play count tracking
        if (currentTrack && !paused) {
          // Calculate time played since the last update
          const now = Date.now();
          const secondsPlayed = Math.floor(
            (now - lastPlaybackTimeUpdateRef) / 1000,
          );

          if (secondsPlayed > 0) {
            // Only count if position has actually increased (real playback, not seeking)
            if (position > lastPosition) {
              // Update tracking with the actual playback time
              const shouldCountPlay = playbackTracker.updateListenTime(
                currentTrack.id,
                secondsPlayed,
              );

              // If we crossed the 30-second threshold, update the play count
              if (shouldCountPlay) {
                // We need to return a promise that resolves after the updatePlayCount call
                await updatePlayCount(currentTrack.id);
              }
            }
          }
        }
      };

      // Add beforeunload event listener
      window.addEventListener('beforeunload', handleBeforeUnload);

      // Clean up
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }

    return undefined;
  }, [currentTrack, paused, position, lastPosition, lastPlaybackTimeUpdateRef]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Router future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
        <Routes>
          <Route element={<MainLayout />} path="/" />
          <Route element={<MiniPlayer />} path="/mini-player" />
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
