import { useEffect, useState } from 'react';
import { MemoryRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClientProvider } from '@tanstack/react-query';
import MainLayout from './components/MainLayout';
import MiniPlayer from './components/MiniPlayer';
import MigrationDialog from './components/MigrationDialog';
import { lightTheme, darkTheme } from './styles/materialTheme';
import { useLibraryStore, useSettingsAndPlaybackStore } from './stores';
import useUIStore from './stores/uiStore';
import {
  queryClient,
  useScanCompleteInvalidator,
  useLibraryReady,
  useSettings,
  getSettingsSnapshot,
} from './queries';
import { usePlaylists } from './queries/playlists';
import './App.css';

const isMiniPlayerWindow =
  new URLSearchParams(window.location.search).get('miniPlayer') === 'true';

function MiniPlayerApp() {
  // The miniPlayer renderer doesn't mount a QueryClientProvider (it
  // doesn't query the DB; state arrives via push events from the main
  // window). Fetch the persisted theme directly via IPC and stash it
  // in local state. No live reactivity to theme changes — the user
  // would have to reopen the miniPlayer to pick up a theme switch.
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  useEffect(() => {
    window.electron.settings
      .get()
      .then((s) => setTheme(s.theme))
      .catch(() => {});
  }, []);
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

  // Settings come from TanStack Query; also drives the boot signal
  // below. `isFetched` flips true on either success or error so the
  // window-show gate unblocks even when the IPC fetch fails (preserves
  // the "fail gracefully and still show the window" property the old
  // Zustand `loadSettings` had via its catch block).
  const {
    data: settings,
    isFetched: settingsFetched,
    error: settingsError,
  } = useSettings();

  useEffect(() => {
    if (settingsFetched) window.electron.app.signalSettingsLoaded();
  }, [settingsFetched]);

  useEffect(() => {
    if (settingsError) {
      useUIStore
        .getState()
        .showNotification('Failed to load settings', 'error');
    }
  }, [settingsError]);

  // Reconcile the audio engine's volume once useSettings settles. The
  // Gapless-5 player is constructed in initPlayer with a fallback
  // volume (1.0) so we don't block engine creation on the IPC fetch;
  // this effect applies the persisted value if it differs.
  const settingsVolume = settings?.volume;
  useEffect(() => {
    if (settingsVolume == null) return;
    const { player } = useSettingsAndPlaybackStore.getState();
    if (player) player.setVolume(settingsVolume);
  }, [settingsVolume]);

  // Cold-boot reseed: the persisted librarySorting needs to land in
  // libraryStore.libraryViewState so trackSelectionUtils sees it for
  // next/prev track math. Write-only effect.
  useEffect(() => {
    if (!settings?.librarySorting) return;
    const libState = useLibraryStore.getState();
    libState.updateLibraryViewState(
      settings.librarySorting,
      libState.libraryViewState.filtering,
    );
  }, [settings?.librarySorting]);

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

    // Last-played song lives in settings. Read via snapshot at effect
    // run time — by here useLibraryReady has flipped (tracks/playlists
    // resolved), and useSettings is normally resolved alongside; if it
    // races and isn't yet, the no-op is harmless (user just doesn't
    // get auto-selection on this rare cold boot).
    const lastPlayedSongId = getSettingsSnapshot()?.lastPlayedSongId;
    if (!lastPlayedSongId) return;

    const { selectSpecificSong, setPaused } =
      useSettingsAndPlaybackStore.getState();

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

function ThemedAppShell() {
  // Theme reads inside the provider so the shell can use useSettings.
  const theme = useSettings().data?.theme ?? 'dark';
  const themeToProvide = theme === 'light' ? lightTheme : darkTheme;

  return (
    <ThemeProvider theme={themeToProvide}>
      <CssBaseline />
      <ThemedAppContent />
    </ThemeProvider>
  );
}

function ThemedApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemedAppShell />
    </QueryClientProvider>
  );
}

export default function App() {
  return isMiniPlayerWindow ? <MiniPlayerApp /> : <ThemedApp />;
}
