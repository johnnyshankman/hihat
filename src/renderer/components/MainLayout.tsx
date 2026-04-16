import { useEffect } from 'react';
import { styled } from '@mui/material/styles';
import { Box, Drawer, Typography, CssBaseline } from '@mui/material';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import {
  useLibraryStore,
  useSettingsAndPlaybackStore,
  useUIStore,
} from '../stores';
import Sidebar from './Sidebar';
import MainContent from './MainContent';
import Settings from './Settings';
import Player from './Player';
import NotificationSystem from './NotificationSystem';

const drawerWidth = 200;

const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme, open }) => ({
  flexGrow: 1,
  padding: 0,
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  overflow: 'hidden',
  ...(open && {
    transition: theme.transitions.create('margin', {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
    marginLeft: 0,
  }),
}));

const PlayerWrapper = styled('div')(() => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  height: '100px',
}));

export default function MainLayout() {
  const isLoading = useLibraryStore((state) => state.isLoading);
  const theme = useSettingsAndPlaybackStore((state) => state.theme);
  const settingsOpen = useUIStore((state) => state.settingsOpen);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);

  // IPC keyboard shortcuts. toggleSidebar uses getState() because no
  // other code in this file reads it (no top-level subscription needed).
  // setSettingsOpen already has a top-level selector via the JSX, so we
  // reuse it and accept the dep — Zustand action references are stable
  // so the effect still only mounts once.
  useEffect(() => {
    const unsubToggleSidebar = window.electron.ipcRenderer.on(
      'ui:toggleSidebar',
      () => {
        // toggleSidebar is not used in JSX so it actually saves overhead to pull it in during runtime
        useUIStore.getState().toggleSidebar();
      },
    );
    const unsubOpenSettings = window.electron.ipcRenderer.on(
      'ui:openSettings',
      () => {
        setSettingsOpen(true);
      },
    );
    return () => {
      unsubToggleSidebar();
      unsubOpenSettings();
    };
  }, [setSettingsOpen]);

  // Document-level custom events for in-app navigation (used by deep
  // links, notification clicks, etc.). setCurrentView uses getState()
  // because nothing else in this file reads it; setSettingsOpen reuses
  // the top-level selector for the same reason as the effect above.
  useEffect(() => {
    const handleCustomViewChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ view: string }>;
      const { view } = customEvent.detail;
      if (view === 'library' || view === 'playlists') {
        useUIStore.getState().setCurrentView(view);
      } else if (view === 'settings') {
        setSettingsOpen(true);
      }
    };
    document.addEventListener('hihat:viewChange', handleCustomViewChange);
    return () => {
      document.removeEventListener('hihat:viewChange', handleCustomViewChange);
    };
  }, [setSettingsOpen]);

  useEffect(() => {
    const handleCustomPlaylistSelect = (event: Event) => {
      const customEvent = event as CustomEvent<{ playlistId: string }>;
      const { playlistId } = customEvent.detail;
      if (!playlistId) return;
      useLibraryStore.getState().selectPlaylist(playlistId);
      useUIStore.getState().setCurrentView('playlists');
    };
    document.addEventListener(
      'hihat:selectPlaylist',
      handleCustomPlaylistSelect,
    );
    return () => {
      document.removeEventListener(
        'hihat:selectPlaylist',
        handleCustomPlaylistSelect,
      );
    };
  }, []);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          width: '100vw',
          background:
            theme === 'dark'
              ? 'linear-gradient(135deg, #121212, #0A0A0A)'
              : 'linear-gradient(135deg, #f5f5f5, #e0e0e0)',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'relative',
            width: '200px',
            height: '200px',
            background:
              theme === 'dark'
                ? 'linear-gradient(to right, #1A1A1A, #121212, #0A0A0A)'
                : 'linear-gradient(to right, #ffffff, #f5f5f5, #e8e8e8)',
            borderRadius: '8px',
            boxShadow:
              theme === 'dark'
                ? '0 8px 24px rgba(0, 0, 0, 0.5)'
                : '0 8px 24px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <LibraryMusicIcon
            sx={{
              color:
                theme === 'dark'
                  ? 'rgba(255, 255, 255, 0.2)'
                  : 'rgba(0, 0, 0, 0.2)',
              width: '40%',
              height: '40%',
              animation: 'pulse 2s infinite ease-in-out',
              '@keyframes pulse': {
                '0%, 100%': {
                  transform: 'scale(1)',
                  opacity: 0.2,
                },
                '50%': {
                  transform: 'scale(1.1)',
                  opacity: 0.3,
                },
              },
            }}
          />
          <Typography
            sx={{
              position: 'absolute',
              bottom: '8px',
              left: '8px',
              color:
                theme === 'dark'
                  ? 'rgba(255, 255, 255, 0.5)'
                  : 'rgba(0, 0, 0, 0.5)',
            }}
            variant="caption"
          >
            hihat
          </Typography>
        </Box>

        <Typography
          sx={{
            mt: 4,
            color: theme === 'dark' ? 'white' : 'black',
            fontWeight: 300,
            letterSpacing: '0.1em',
            animation: 'fadeInOut 2s infinite ease-in-out',
            '@keyframes fadeInOut': {
              '0%, 100%': {
                opacity: 0.5,
              },
              '50%': {
                opacity: 1,
              },
            },
          }}
          variant="h5"
        >
          music awaits
        </Typography>

        <Box
          sx={{
            display: 'flex',
            mt: 2,
            gap: 1,
          }}
        >
          {[0, 1, 2].map((i) => (
            <Box
              key={i}
              sx={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: 'primary.main',
                animation: `bounce 1.4s infinite ease-in-out ${i * 0.2}s`,
                '@keyframes bounce': {
                  '0%, 100%': {
                    transform: 'scale(0)',
                  },
                  '50%': {
                    transform: 'scale(1)',
                  },
                },
              }}
            />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        flexDirection: 'column',
        WebkitAppRegion: 'drag',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          position: 'relative',
          overflow: 'hidden',
          WebkitAppRegion: 'drag',
        }}
      >
        <CssBaseline />
        <Sidebar />
        <Main open={sidebarOpen}>
          <MainContent />
        </Main>
      </Box>

      <Drawer
        anchor="left"
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
        sx={{
          '& .MuiDrawer-paper': {
            width: 'min(480px, calc(100vw - 60px))',
            boxSizing: 'border-box',
            borderRight: '1px solid',
            borderColor: (t) => t.palette.divider,
            WebkitAppRegion: 'no-drag',
          },
        }}
        variant="temporary"
      >
        <Settings onClose={() => setSettingsOpen(false)} />
      </Drawer>

      <PlayerWrapper sx={{ WebkitAppRegion: 'no-drag' }}>
        <Player />
      </PlayerWrapper>

      <NotificationSystem />
    </Box>
  );
}
