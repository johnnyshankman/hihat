import React, { useState, useEffect, useCallback } from 'react';
import { styled } from '@mui/material/styles';
import {
  Box,
  Drawer,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  CssBaseline,
  IconButton,
  Menu,
  MenuItem,
  Tooltip,
  Paper,
} from '@mui/material';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Remove';
import MaximizeIcon from '@mui/icons-material/CropSquare';
import RestoreIcon from '@mui/icons-material/FilterNone';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import {
  useLibraryStore,
  useSettingsAndPlaybackStore,
  useUIStore,
} from '../stores';
import Library from './Library';
import Playlists from './Playlists';
import Settings from './Settings';
import Player from './Player';
import NotificationSystem from './NotificationSystem';
import RenamePlaylistDialog from './RenamePlaylistDialog';
import CreatePlaylistDialog from './CreatePlaylistDialog';

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

// Create a styled component for the Player
const PlayerWrapper = styled('div')(() => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  height: '100px',
}));

type View = 'library' | 'playlists';

export default function MainLayout() {
  // Get state and actions from library store
  const isLoading = useLibraryStore((state) => state.isLoading);
  const playlists = useLibraryStore((state) => state.playlists);
  const selectedPlaylistId = useLibraryStore(
    (state) => state.selectedPlaylistId,
  );
  const selectPlaylist = useLibraryStore((state) => state.selectPlaylist);
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);

  const theme = useSettingsAndPlaybackStore((state) => state.theme);

  const currentView = useUIStore((state) => state.currentView);
  const setCurrentView = useUIStore((state) => state.setCurrentView);
  const settingsOpen = useUIStore((state) => state.settingsOpen);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);

  const [open, setOpen] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(
    null,
  );

  // Rename dialog state - simplified to only track open/close and playlist ID
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamePlaylistId, setRenamePlaylistId] = useState<string | null>(null);

  // Context menu for playlist deletion
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    playlistId: string;
    isSmart?: boolean;
  } | null>(null);

  // Check if window is maximized
  const checkMaximized = useCallback(async () => {
    const maximized = await window.electron.window.isMaximized();
    setIsMaximized(maximized);
  }, []);

  // Handle maximize/restore
  const handleMaximize = useCallback(() => {
    window.electron.window.maximize();
    // Update maximized state after a short delay to allow the window to change state
    setTimeout(checkMaximized, 100);
  }, [checkMaximized]);

  const handleDrawerToggle = useCallback(() => {
    setOpen((prevOpen) => !prevOpen);
  }, []);

  const handleViewChange = (view: View) => {
    setCurrentView(view);
  };

  const handlePlaylistSelect = (playlistId: string) => {
    selectPlaylist(playlistId);
    setCurrentView('playlists');
  };

  const handlePlaylistContextMenu = (
    event: React.MouseEvent,
    playlistId: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    // Find the playlist to check if it's a smart playlist
    const playlist = playlists.find((p) => p.id === playlistId);

    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      playlistId,
      isSmart: playlist?.isSmart || false, // Store whether this is a smart playlist
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleDeletePlaylist = async () => {
    if (contextMenu) {
      // Don't allow deletion of smart playlists
      if (contextMenu.isSmart) {
        useUIStore
          .getState()
          .showNotification('Smart playlists cannot be deleted', 'warning');
        setContextMenu(null);
        return;
      }

      await deletePlaylist(contextMenu.playlistId);
      if (selectedPlaylistId === contextMenu.playlistId) {
        selectPlaylist(null);
      }
      setContextMenu(null);
    }
  };

  const handleRenamePlaylist = () => {
    if (contextMenu) {
      setRenamePlaylistId(contextMenu.playlistId);
      setRenameDialogOpen(true);
      setContextMenu(null);
    }
  };

  const closeRenameDialog = () => {
    setRenameDialogOpen(false);
    setRenamePlaylistId(null);
  };

  const handleAddPlaylistClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setCreateDialogOpen(true);
  };

  const closeCreateDialog = () => {
    setCreateDialogOpen(false);
  };

  // Drag-and-drop handlers for playlist sidebar items
  const handlePlaylistDragOver = useCallback(
    (e: React.DragEvent, playlistId: string, isSmart: boolean) => {
      if (
        isSmart ||
        !e.dataTransfer.types.includes('application/x-hihat-tracks')
      ) {
        e.dataTransfer.dropEffect = 'none';
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setDragOverPlaylistId(playlistId);
    },
    [],
  );

  const handlePlaylistDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) {
      return;
    }
    setDragOverPlaylistId(null);
  }, []);

  const handlePlaylistDrop = useCallback(
    async (e: React.DragEvent, playlistId: string, isSmart: boolean) => {
      setDragOverPlaylistId(null);
      if (isSmart) return;

      const raw = e.dataTransfer.getData('application/x-hihat-tracks');
      if (!raw) return;
      e.preventDefault();

      let trackIds: string[];
      try {
        trackIds = JSON.parse(raw);
      } catch {
        return;
      }

      if (!Array.isArray(trackIds) || trackIds.length === 0) return;

      const { showNotification } = useUIStore.getState();
      const { addTrackToPlaylist } = useLibraryStore.getState();

      if (trackIds.length === 1) {
        await addTrackToPlaylist(trackIds[0], playlistId);
        return;
      }

      // Batch multi-track add
      const currentPlaylists = useLibraryStore.getState().playlists;
      const playlist = currentPlaylists.find((p) => p.id === playlistId);
      if (!playlist) return;

      const existingSet = new Set(playlist.trackIds);
      const newTrackIds = trackIds.filter((id) => !existingSet.has(id));
      const dupeCount = trackIds.length - newTrackIds.length;

      if (newTrackIds.length === 0) {
        showNotification(
          `All ${trackIds.length} tracks are already in "${playlist.name}"`,
          'info',
        );
        return;
      }

      const updatedPlaylist = {
        ...playlist,
        trackIds: [...playlist.trackIds, ...newTrackIds],
      };

      await window.electron.playlists.update(updatedPlaylist);
      useLibraryStore.setState((state) => ({
        playlists: state.playlists.map((p) =>
          p.id === playlistId ? updatedPlaylist : p,
        ),
      }));

      const dupeMsg =
        dupeCount > 0 ? ` (${dupeCount} already in playlist)` : '';
      showNotification(
        `Added ${newTrackIds.length} track${newTrackIds.length > 1 ? 's' : ''} to "${playlist.name}"${dupeMsg}`,
        'success',
      );
    },
    [],
  );

  // Clean up drag state on dragend (global)
  useEffect(() => {
    const handleDragEnd = () => setDragOverPlaylistId(null);
    document.addEventListener('dragend', handleDragEnd);
    return () => document.removeEventListener('dragend', handleDragEnd);
  }, []);

  // Add keyboard shortcut handler
  useEffect(() => {
    // Listen for IPC event to toggle sidebar
    const unsubToggleSidebar = window.electron.ipcRenderer.on(
      'ui:toggleSidebar',
      () => {
        handleDrawerToggle();
      },
    );

    // Listen for IPC event to open settings
    const unsubOpenSettings = window.electron.ipcRenderer.on(
      'ui:openSettings',
      () => {
        setSettingsOpen(true);
      },
    );

    // Check if window is maximized on mount
    checkMaximized();

    // Listen for window maximize/unmaximize events
    const unsubMaximizedChange = window.electron.window.onMaximizedChange(
      (maximized) => {
        setIsMaximized(maximized);
      },
    );

    // Cleanup
    return () => {
      unsubToggleSidebar();
      unsubOpenSettings();
      unsubMaximizedChange();
    };
  }, [handleDrawerToggle, checkMaximized, setSettingsOpen]);

  useEffect(() => {
    // Listen for custom view change events
    const handleCustomViewChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ view: string }>;
      const { view } = customEvent.detail;
      if (view === 'library' || view === 'playlists') {
        setCurrentView(view);
      } else if (view === 'settings') {
        setSettingsOpen(true);
      }
    };

    // Add event listener
    document.addEventListener('hihat:viewChange', handleCustomViewChange);

    // Clean up
    return () => {
      document.removeEventListener('hihat:viewChange', handleCustomViewChange);
    };
  }, [setCurrentView, setSettingsOpen]);

  useEffect(() => {
    // Listen for custom playlist select events
    const handleCustomPlaylistSelect = (event: Event) => {
      const customEvent = event as CustomEvent<{ playlistId: string }>;
      const { playlistId } = customEvent.detail;
      if (playlistId) {
        selectPlaylist(playlistId);
        setCurrentView('playlists');
      }
    };

    // Add event listener
    document.addEventListener(
      'hihat:selectPlaylist',
      handleCustomPlaylistSelect,
    );

    // Clean up
    return () => {
      document.removeEventListener(
        'hihat:selectPlaylist',
        handleCustomPlaylistSelect,
      );
    };
  }, [setCurrentView, selectPlaylist]);

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
        {/* Centered animated loading element */}
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
          {/* Music note icon with pulsing animation */}
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

        {/* Loading text with fade animation */}
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

        {/* Loading dots with sequential animation */}
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
        WebkitAppRegion: 'drag', // Make the entire window draggable by default
      }}
    >
      <Box
        sx={{
          display: 'flex',
          flexGrow: 1,
          position: 'relative',
          overflow: 'hidden',
          WebkitAppRegion: 'drag', // Make this area draggable
        }}
      >
        <CssBaseline />
        <Drawer
          anchor="left"
          open={open}
          sx={{
            width: drawerWidth,
            flexShrink: 0,
            '& .MuiDrawer-paper': {
              width: drawerWidth,
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 100px)', // Stop above the player
              WebkitAppRegion: 'drag', // Make drawer background draggable
              '& .MuiListItemButton-root, & .MuiIconButton-root, & .MuiListItemIcon-root, & .MuiListItemText-root':
                {
                  WebkitAppRegion: 'no-drag', // Make interactive elements not draggable
                },
            },
          }}
          variant="persistent"
        >
          <Paper
            elevation={0}
            sx={{
              borderRadius: '0px',
              height: '100%',
              backgroundColor: theme === 'dark' ? '#000000' : '#FFFFFF',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Window Controls */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 1.5,
                py: 0.5,
                WebkitAppRegion: 'drag', // Make this area draggable
                height: '44px',
              }}
            >
              <Box
                sx={{ display: 'flex', gap: '8px', WebkitAppRegion: 'no-drag' }}
              >
                <Tooltip title="Close">
                  <IconButton
                    onClick={() => window.electron.window.close()}
                    size="small"
                    sx={{
                      width: '12px',
                      height: '12px',
                      bgcolor: (t) => t.palette.grey[500],
                      '&:hover': {
                        bgcolor: '#ff5f57',
                        '& .MuiSvgIcon-root': {
                          opacity: 1,
                          color: 'black',
                        },
                      },
                      padding: 0,
                    }}
                  >
                    <CloseIcon
                      sx={{
                        fontSize: '8px',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                      }}
                    />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Minimize">
                  <IconButton
                    onClick={() => window.electron.window.minimize()}
                    size="small"
                    sx={{
                      width: '12px',
                      height: '12px',
                      bgcolor: (t) => t.palette.grey[500],
                      '&:hover': {
                        bgcolor: '#ffbd2e',
                        '& .MuiSvgIcon-root': {
                          opacity: 1,
                          color: 'black',
                        },
                      },
                      padding: 0,
                    }}
                  >
                    <MinimizeIcon
                      sx={{
                        fontSize: '8px',
                        opacity: 0,
                        transition: 'opacity 0.2s',
                      }}
                    />
                  </IconButton>
                </Tooltip>
                <Tooltip title={isMaximized ? 'Restore' : 'Maximize'}>
                  <IconButton
                    onClick={handleMaximize}
                    size="small"
                    sx={{
                      width: '12px',
                      height: '12px',
                      bgcolor: (t) => t.palette.grey[500],
                      '&:hover': {
                        bgcolor: '#28c940',
                        '& .MuiSvgIcon-root': {
                          opacity: 1,
                          color: 'black',
                        },
                      },
                      padding: 0,
                    }}
                  >
                    {isMaximized ? (
                      <RestoreIcon
                        sx={{
                          fontSize: '8px',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                        }}
                      />
                    ) : (
                      <MaximizeIcon
                        sx={{
                          fontSize: '8px',
                          opacity: 0,
                          transition: 'opacity 0.2s',
                        }}
                      />
                    )}
                  </IconButton>
                </Tooltip>
              </Box>
              <Box
                sx={{ display: 'flex', gap: 1.5, WebkitAppRegion: 'no-drag' }}
              >
                {/* Settings button */}
                <Tooltip title="Settings">
                  <IconButton
                    data-testid="nav-settings"
                    onClick={() => setSettingsOpen(!settingsOpen)}
                    size="small"
                    sx={{
                      color: settingsOpen ? 'text.primary' : 'text.secondary',
                      '&:hover': {
                        color: 'text.primary',
                      },
                      padding: 0,
                    }}
                  >
                    <SettingsIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
                {/* Sidebar toggle button */}
                <Tooltip title={open ? 'Hide Sidebar' : 'Show Sidebar'}>
                  <IconButton
                    data-testid="sidebar-toggle-close"
                    onClick={handleDrawerToggle}
                    size="small"
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'text.primary',
                      },
                      padding: 0,
                    }}
                  >
                    <ViewSidebarRoundedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <List
              sx={{
                flexGrow: 1,
                paddingTop: 0,
                px: 1,
                overflow: 'auto',
                minHeight: 0,
              }}
            >
              {/* Library section */}
              <Box sx={{ mb: 0.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    px: 1.5,
                    py: 0.5,
                    WebkitAppRegion: 'no-drag',
                  }}
                >
                  <Typography
                    sx={{
                      flexGrow: 1,
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      color: (t) => t.palette.text.secondary,
                      opacity: 0.7,
                    }}
                    variant="caption"
                  >
                    Library
                  </Typography>
                </Box>
                <ListItemButton
                  data-testid="nav-library"
                  data-view="library"
                  onClick={() => handleViewChange('library')}
                  selected={currentView === 'library'}
                  sx={{
                    py: 0.25,
                    px: 1.5,
                    WebkitAppRegion: 'no-drag',
                    borderRadius: 1,
                    mb: 0,
                    '&.Mui-selected': {
                      backgroundColor: (t) =>
                        t.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.08)',
                      '& .MuiListItemText-primary': {
                        fontWeight: 600,
                      },
                      '&:hover': {
                        backgroundColor: (t) =>
                          t.palette.mode === 'dark'
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(0, 0, 0, 0.1)',
                      },
                    },
                    '&:hover': {
                      backgroundColor: (t) =>
                        t.palette.mode === 'dark'
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'rgba(0, 0, 0, 0.04)',
                    },
                  }}
                >
                  <ListItemIcon
                    sx={{
                      minWidth: '24px',
                      opacity: 0.7,
                    }}
                  >
                    <LibraryMusicIcon sx={{ fontSize: 16 }} />
                  </ListItemIcon>
                  <ListItemText
                    primary="All"
                    primaryTypographyProps={{
                      fontSize: '13px',
                      fontWeight: currentView === 'library' ? 600 : 400,
                    }}
                  />
                </ListItemButton>
              </Box>

              {/* Playlists section */}
              <Box sx={{ mt: 0.5, mb: 0.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    pl: 1.5,
                    pr: 1,
                    py: 0.5,
                    WebkitAppRegion: 'no-drag',
                  }}
                >
                  <Typography
                    sx={{
                      flexGrow: 1,
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.5px',
                      textTransform: 'uppercase',
                      color: (t) => t.palette.text.secondary,
                      opacity: 0.7,
                    }}
                    variant="caption"
                  >
                    Playlists
                  </Typography>
                  <Tooltip title="Create Playlist">
                    <IconButton
                      data-testid="add-playlist-button"
                      onClick={handleAddPlaylistClick}
                      size="small"
                      sx={{
                        p: 0,
                        left: '2px', // offset makes it perfectly centered underneath the "hide sidebar" icon
                        WebkitAppRegion: 'no-drag',
                        opacity: 0.7,
                        '&:hover': {
                          opacity: 1,
                        },
                      }}
                    >
                      <AddIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Box>

                <List component="div" disablePadding>
                  {playlists.map((playlist) => (
                    <ListItemButton
                      key={playlist.id}
                      data-playlist-id={playlist.id}
                      onClick={() => handlePlaylistSelect(playlist.id)}
                      onContextMenu={(e) =>
                        handlePlaylistContextMenu(e, playlist.id)
                      }
                      onDragLeave={handlePlaylistDragLeave}
                      onDragOver={(e) =>
                        handlePlaylistDragOver(
                          e,
                          playlist.id,
                          !!playlist.isSmart,
                        )
                      }
                      onDrop={(e) =>
                        handlePlaylistDrop(e, playlist.id, !!playlist.isSmart)
                      }
                      selected={
                        currentView === 'playlists' &&
                        selectedPlaylistId === playlist.id
                      }
                      sx={{
                        py: 0.25,
                        px: 1.5,
                        WebkitAppRegion: 'no-drag',
                        borderRadius: 1,
                        mb: 0,
                        transition: 'background-color 0.1s, outline 0.1s',
                        ...(dragOverPlaylistId === playlist.id &&
                          !playlist.isSmart && {
                            backgroundColor: (t) =>
                              t.palette.mode === 'dark'
                                ? 'rgba(66, 165, 245, 0.15)'
                                : 'rgba(33, 150, 243, 0.12)',
                            outline: (t) =>
                              `1px solid ${t.palette.mode === 'dark' ? 'rgba(66, 165, 245, 0.5)' : 'rgba(33, 150, 243, 0.5)'}`,
                          }),
                        '&.Mui-selected': {
                          backgroundColor: (t) =>
                            t.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.08)',
                          '& .MuiListItemText-primary': {
                            fontWeight: 600,
                          },
                          '&:hover': {
                            backgroundColor: (t) =>
                              t.palette.mode === 'dark'
                                ? 'rgba(255, 255, 255, 0.1)'
                                : 'rgba(0, 0, 0, 0.1)',
                          },
                        },
                        '&:hover': {
                          backgroundColor: (t) =>
                            t.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.04)',
                        },
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: '24px',
                          opacity: 0.7,
                        }}
                      >
                        {playlist.isSmart ? (
                          <AutoAwesomeIcon sx={{ fontSize: 16 }} />
                        ) : (
                          <QueueMusicIcon sx={{ fontSize: 16 }} />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={playlist.name}
                        primaryTypographyProps={{
                          noWrap: true,
                          title: playlist.name,
                          fontSize: '13px',
                          fontWeight:
                            currentView === 'playlists' &&
                            selectedPlaylistId === playlist.id
                              ? 600
                              : 400,
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Box>
            </List>
          </Paper>
        </Drawer>
        <Main open={open}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 100px)', // Adjusted height since AppBar is removed
              width: '100%',
              WebkitAppRegion: 'drag', // Make content area draggable by default
              '& button, & input, & a, & [role="button"], & .MuiTableContainer-root, & .MuiDataGrid-root, & .MuiSlider-root':
                {
                  WebkitAppRegion: 'no-drag', // Make all interactive elements not draggable
                },
            }}
          >
            {currentView === 'library' && (
              <Library drawerOpen={open} onDrawerToggle={handleDrawerToggle} />
            )}
            {currentView === 'playlists' && (
              <Playlists
                drawerOpen={open}
                onDrawerToggle={handleDrawerToggle}
              />
            )}
          </Box>
        </Main>
      </Box>

      {/* Settings slide-over panel */}
      <Drawer
        anchor="right"
        onClose={() => setSettingsOpen(false)}
        open={settingsOpen}
        sx={{
          '& .MuiDrawer-paper': {
            width: 'min(480px, calc(100vw - 60px))',
            boxSizing: 'border-box',
            borderLeft: '1px solid',
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

      {/* Context Menu for Playlist */}
      <Menu
        anchorPosition={
          contextMenu !== null
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
        anchorReference="anchorPosition"
        onClose={handleContextMenuClose}
        open={contextMenu !== null}
      >
        {/* Only show options for non-smart playlists */}
        {contextMenu && !contextMenu.isSmart ? (
          <>
            <MenuItem
              data-testid="rename-playlist-menu-item"
              onClick={handleRenamePlaylist}
            >
              <ListItemIcon>
                <EditIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Rename</ListItemText>
            </MenuItem>
            <MenuItem
              data-testid="delete-playlist-menu-item"
              onClick={handleDeletePlaylist}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Delete Playlist</ListItemText>
            </MenuItem>
          </>
        ) : (
          <MenuItem onClick={() => {}}>
            <ListItemText>No options available</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Create Playlist Dialog */}
      <CreatePlaylistDialog
        onClose={closeCreateDialog}
        open={createDialogOpen}
      />

      {/* Rename Playlist Dialog */}
      <RenamePlaylistDialog
        initialName={
          playlists.find((p) => p.id === renamePlaylistId)?.name || ''
        }
        onClose={closeRenameDialog}
        open={renameDialogOpen}
        playlistId={renamePlaylistId}
      />

      {/* Add the NotificationSystem component */}
      <NotificationSystem />
    </Box>
  );
}
