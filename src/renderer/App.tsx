import { useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import MainLayout from './components/MainLayout';
import MiniPlayer from './components/MiniPlayer';
import MigrationDialog from './components/MigrationDialog';
import { lightTheme, darkTheme } from './styles/materialTheme';
import { useLibraryStore, useSettingsAndPlaybackStore } from './stores';
import './App.css';

const isMiniPlayerWindow =
  new URLSearchParams(window.location.search).get('miniPlayer') === 'true';

function MiniPlayerApp() {
  const theme = useSettingsAndPlaybackStore((state) => state.theme);
  const themeToProvide = theme === 'light' ? lightTheme : darkTheme;

  useEffect(() => {
    document.body.setAttribute('data-mini-player', 'true');
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

function ThemedApp() {
  const theme = useSettingsAndPlaybackStore((state) => state.theme);
  const themeToProvide = theme === 'light' ? lightTheme : darkTheme;
  const isLoading = useLibraryStore((state) => state.isLoading);

  useEffect(() => {
    useSettingsAndPlaybackStore.getState().initPlayer();
    document.body.classList.add('draggable');
    return () => {
      document.body.classList.remove('draggable');
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;

    const { lastPlayedSongId, selectSpecificSong, setPaused } =
      useSettingsAndPlaybackStore.getState();

    if (!lastPlayedSongId) return;

    try {
      selectSpecificSong(lastPlayedSongId, 'library');
      setPaused(true);
      window.hihatScrollToLibraryTrack?.(lastPlayedSongId);
    } catch (error) {
      console.error('Failed to load last played song:', error);
    }
  }, [isLoading]);

  return (
    <ThemeProvider theme={themeToProvide}>
      <CssBaseline />
      <MigrationDialog />
      <Router>
        <Routes>
          <Route element={<MainLayout />} path="/" />
          <Route element={<MiniPlayer />} path="/mini-player" />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default function App() {
  return isMiniPlayerWindow ? <MiniPlayerApp /> : <ThemedApp />;
}
