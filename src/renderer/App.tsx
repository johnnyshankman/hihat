import React, { useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import MainLayout from './components/MainLayout';
import MiniPlayer from './components/MiniPlayer';
import { lightTheme, darkTheme } from './styles/materialTheme';
import { useLibraryStore, usePlaybackStore, useSettingsStore } from './stores';
import './App.css';

// Check if this is a mini player window
const isMiniPlayerWindow =
  new URLSearchParams(window.location.search).get('miniPlayer') === 'true';

// Mini player specific app that only renders the mini player
function MiniPlayerApp() {
  const theme = useSettingsStore((state) => state.theme);
  const themeToProvide = theme === 'light' ? lightTheme : darkTheme;

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
    <ThemeProvider theme={themeToProvide}>
      <CssBaseline />
      <MiniPlayer />
    </ThemeProvider>
  );
}

// Main app component
function ThemedApp() {
  const theme = useSettingsStore((state) => state.theme);
  const themeToProvide = theme === 'light' ? lightTheme : darkTheme;
  const initPlayer = usePlaybackStore((state) => state.initPlayer);
  const selectSpecificSong = usePlaybackStore(
    (state) => state.selectSpecificSong,
  );
  const isLoading = useLibraryStore((state) => state.isLoading);

  const setPaused = usePlaybackStore((state) => state.setPaused);

  const lastPlayedSongId = useSettingsStore((state) => state.lastPlayedSongId);

  // Get the current track and playback state for cleanup
  const currentTrack = usePlaybackStore((state) => state.currentTrack);
  const paused = usePlaybackStore((state) => state.paused);
  const lastPlaybackTimeUpdateRef = usePlaybackStore(
    (state) => state.lastPlaybackTimeUpdateRef,
  );
  const position = usePlaybackStore((state) => state.position);
  const lastPosition = usePlaybackStore((state) => state.lastPosition);

  // Initialize the player and the draggable body
  useEffect(() => {
    initPlayer(); // initialize the global player just one time ever
    document.body.classList.add('draggable');
    return () => {
      document.body.classList.remove('draggable');
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Load the last played song if available after load
  useEffect(() => {
    // Load the last played song when the app starts, if available
    const loadLastPlayedSong = async () => {
      // Example code for the renderer
      const logFilePath = await window.electron.app.getLogFilePath();
      console.warn('Log file path:', logFilePath);
      if (lastPlayedSongId && !isLoading) {
        try {
          // Load the track without playing it
          selectSpecificSong(lastPlayedSongId, 'library');
          setPaused(true);
          // scroll to the song in the library
          // @ts-ignore - custom property on window needs shimming in ts
          window.hihatScrollToLibraryTrack(lastPlayedSongId);
        } catch (error) {
          console.error('Failed to load last played song:', error);
        }
      }
    };

    loadLastPlayedSong();
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

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
    <ThemeProvider theme={themeToProvide}>
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
