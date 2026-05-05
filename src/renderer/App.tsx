import { useEffect } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './components/MainLayout';
import MiniPlayer from './components/MiniPlayer';
import MigrationDialog from './components/MigrationDialog';
import { lightTheme, darkTheme } from './styles/materialTheme';
import { useLibraryStore, useSettingsAndPlaybackStore } from './stores';
import {
  queryClient,
  useScanCompleteInvalidator,
  useLibraryReady,
} from './queries';
import { usePlaylists } from './queries/playlists';
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

function ThemedAppContent() {
  // Aggregate loading state: tracks + playlists must both resolve before
  // we restore the last-played song. The two queries fire in parallel
  // on mount thanks to TQ's automatic dedup.
  const { isLoading } = useLibraryReady();

  // Seed the per-playlist sort-pref session cache from playlists data
  // when it first loads. The cache is in libraryStore so rapid sort
  // changes don't loop subscribers; the seed is here so the cache is
  // populated from server data on every cold mount.
  const { data: playlistsData } = usePlaylists();
  const seedPlaylistSortPreferences = useLibraryStore(
    (state) => state.seedPlaylistSortPreferences,
  );
  useEffect(() => {
    if (playlistsData) seedPlaylistSortPreferences(playlistsData);
  }, [playlistsData, seedPlaylistSortPreferences]);

  useEffect(() => {
    useSettingsAndPlaybackStore.getState().initPlayer();
    document.body.classList.add('draggable');
    return () => {
      document.body.classList.remove('draggable');
    };
  }, []);

  // Bridge `library:scanComplete` → TanStack Query cache invalidation
  // (and surface the user-facing notification with adds/removes).
  useScanCompleteInvalidator();

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
    <>
      <MigrationDialog />
      <Router>
        <Routes>
          <Route element={<MainLayout />} path="/" />
          <Route element={<MiniPlayer />} path="/mini-player" />
        </Routes>
      </Router>
    </>
  );
}

function ThemedApp() {
  const theme = useSettingsAndPlaybackStore((state) => state.theme);
  const themeToProvide = theme === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeProvider theme={themeToProvide}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <ThemedAppContent />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default function App() {
  return isMiniPlayerWindow ? <MiniPlayerApp /> : <ThemedApp />;
}
