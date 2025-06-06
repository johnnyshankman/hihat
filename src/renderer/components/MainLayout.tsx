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
  Collapse,
  IconButton,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Divider,
  Tooltip,
  Paper,
} from '@mui/material';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import SettingsIcon from '@mui/icons-material/Settings';
import AddIcon from '@mui/icons-material/Add';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/Delete';
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

const drawerWidth = 240;

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
const PlayerWrapper = styled('div', {
  shouldForwardProp: (prop) => prop !== 'open',
})<{
  open?: boolean;
}>(({ theme, open }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  zIndex: 1000,
  height: '100px', // Increased from 80px to 100px
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    width: `calc(100% - ${drawerWidth}px)`,
    marginLeft: `${drawerWidth}px`,
    transition: theme.transitions.create(['margin', 'width'], {
      easing: theme.transitions.easing.easeOut,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

type View = 'library' | 'playlists' | 'settings';

export default function MainLayout() {
  // Get state and actions from library store
  const isLoading = useLibraryStore((state) => state.isLoading);
  const playlists = useLibraryStore((state) => state.playlists);
  const selectedPlaylistId = useLibraryStore(
    (state) => state.selectedPlaylistId,
  );
  const selectPlaylist = useLibraryStore((state) => state.selectPlaylist);
  const deletePlaylist = useLibraryStore((state) => state.deletePlaylist);
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);

  const theme = useSettingsAndPlaybackStore((state) => state.theme);

  const currentView = useUIStore((state) => state.currentView);
  const setCurrentView = useUIStore((state) => state.setCurrentView);

  const [open, setOpen] = useState(true);
  const [playlistsOpen, setPlaylistsOpen] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);

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

  const handlePlaylistsClick = () => {
    setPlaylistsOpen(!playlistsOpen);
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

  const handleAddPlaylistClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    setCreateDialogOpen(true);
  };

  const handleCreatePlaylist = async () => {
    if (newPlaylistName.trim()) {
      await createPlaylist(newPlaylistName.trim());
      setNewPlaylistName('');
      setCreateDialogOpen(false);
      setPlaylistsOpen(true); // Expand the playlists list
    }
  };

  const closeCreateDialog = () => {
    setNewPlaylistName('');
    setCreateDialogOpen(false);
  };

  // Add keyboard shortcut handler
  useEffect(() => {
    // Listen for IPC event to toggle sidebar
    const unsubToggleSidebar = window.electron.ipcRenderer.on(
      'ui:toggleSidebar',
      () => {
        handleDrawerToggle();
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
      unsubMaximizedChange();
    };
  }, [handleDrawerToggle, checkMaximized]); // Added checkMaximized to dependency array

  useEffect(() => {
    // Listen for custom view change events
    const handleCustomViewChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ view: View }>;
      const { view } = customEvent.detail;
      if (view === 'library' || view === 'playlists' || view === 'settings') {
        setCurrentView(view);
      }
    };

    // Add event listener
    document.addEventListener('hihat:viewChange', handleCustomViewChange);

    // Clean up
    return () => {
      document.removeEventListener('hihat:viewChange', handleCustomViewChange);
    };
  }, [setCurrentView]);

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
              WebkitAppRegion: 'drag', // Make drawer background draggable
              '& .MuiListItemButton-root, & .MuiIconButton-root, & .MuiListItemIcon-root, & .MuiListItemText-root':
                {
                  WebkitAppRegion: 'no-drag', // Make interactive elements not draggable
                },
            },
          }}
          variant="persistent"
        >
          <Paper sx={{ borderRadius: '0px', height: '100%' }}>
            {/* Window Controls */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px',
                WebkitAppRegion: 'drag', // Make this area draggable
                height: '63px',
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
              <Box sx={{ WebkitAppRegion: 'no-drag' }}>
                {/* Sidebar toggle button */}
                <Tooltip title={open ? 'Hide Sidebar' : 'Show Sidebar'}>
                  <IconButton
                    onClick={handleDrawerToggle}
                    size="small"
                    sx={{
                      color: 'text.secondary',
                      '&:hover': {
                        color: 'text.primary',
                      },
                    }}
                  >
                    <ViewSidebarRoundedIcon sx={{ fontSize: 20 }} />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            <Divider />

            <List sx={{ flexGrow: 1, paddingTop: 0 }}>
              <ListItemButton
                data-view="settings"
                onClick={() => handleViewChange('settings')}
                selected={currentView === 'settings'}
                sx={{ WebkitAppRegion: 'no-drag' }}
              >
                <ListItemIcon sx={{ minWidth: '38px' }}>
                  <SettingsIcon />
                </ListItemIcon>
                <ListItemText primary="Settings" />
              </ListItemButton>

              <ListItemButton
                data-view="library"
                onClick={() => handleViewChange('library')}
                selected={currentView === 'library'}
                sx={{ WebkitAppRegion: 'no-drag' }}
              >
                <ListItemIcon sx={{ minWidth: '38px' }}>
                  <LibraryMusicIcon />
                </ListItemIcon>
                <ListItemText primary="Library" />
              </ListItemButton>

              {/* Playlists with nested list */}
              <ListItemButton
                data-view="playlists"
                onClick={handlePlaylistsClick}
                sx={{ WebkitAppRegion: 'no-drag' }}
              >
                <ListItemIcon sx={{ minWidth: '38px' }}>
                  <QueueMusicIcon />
                </ListItemIcon>
                <ListItemText primary="Playlists" />
                <IconButton
                  onClick={handleAddPlaylistClick}
                  size="small"
                  sx={{ mr: 1, WebkitAppRegion: 'no-drag' }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
                {playlistsOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>

              <Collapse in={playlistsOpen} timeout="auto" unmountOnExit>
                <List
                  component="div"
                  disablePadding
                  sx={{
                    overflow: 'hidden',
                    mt: 0.75,
                    py: 0.5,
                    mx: 1.5,
                    borderRadius: 1,
                    backgroundColor: (t) =>
                      t.palette.mode === 'dark'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.03)',
                    boxShadow: (t) =>
                      t.palette.mode === 'dark'
                        ? 'inset 0 1px 3px rgba(0, 0, 0, 0.2)'
                        : 'inset 0 1px 2px rgba(0, 0, 0, 0.1)',
                  }}
                >
                  {playlists.map((playlist) => (
                    <ListItemButton
                      key={playlist.id}
                      data-playlist-id={playlist.id}
                      onClick={() => handlePlaylistSelect(playlist.id)}
                      onContextMenu={(e) =>
                        handlePlaylistContextMenu(e, playlist.id)
                      }
                      selected={
                        currentView === 'playlists' &&
                        selectedPlaylistId === playlist.id
                      }
                      sx={{
                        py: 0.5,
                        WebkitAppRegion: 'no-drag',
                        borderRadius: 0.75,
                        mx: 0.5,
                        my: 0.25,
                        '&.Mui-selected': {
                          backgroundColor: (t) =>
                            t.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.12)'
                              : 'rgba(0, 0, 0, 0.08)',
                        },
                        '&:hover': {
                          backgroundColor: (t) =>
                            t.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.05)',
                        },
                        '&.Mui-selected:hover': {
                          backgroundColor: (t) =>
                            t.palette.mode === 'dark'
                              ? 'rgba(255, 255, 255, 0.15)'
                              : 'rgba(0, 0, 0, 0.12)',
                        },
                      }}
                    >
                      <ListItemText
                        primary={playlist.name}
                        primaryTypographyProps={{
                          noWrap: true,
                          title: playlist.name,
                          fontWeight: 500,
                          fontSize: '12px',
                          color: 'text.secondary',
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Collapse>
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
              <Library _onDrawerToggle={handleDrawerToggle} drawerOpen={open} />
            )}
            {currentView === 'playlists' && (
              <Playlists
                drawerOpen={open}
                onDrawerToggle={handleDrawerToggle}
              />
            )}
            {currentView === 'settings' && (
              <Settings drawerOpen={open} onDrawerToggle={handleDrawerToggle} />
            )}
          </Box>
        </Main>
      </Box>

      <PlayerWrapper open={open} sx={{ WebkitAppRegion: 'no-drag' }}>
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
        {/* Only show delete option for non-smart playlists */}
        {contextMenu && !contextMenu.isSmart ? (
          <MenuItem onClick={handleDeletePlaylist}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Delete Playlist</ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={() => {}}>
            <ListItemText>No options available</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Create Playlist Dialog */}
      <Dialog onClose={closeCreateDialog} open={createDialogOpen}>
        <DialogTitle>Create New Playlist</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Playlist Name"
            margin="dense"
            onChange={(e) => setNewPlaylistName(e.target.value)}
            type="text"
            value={newPlaylistName}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreateDialog}>Cancel</Button>
          <Button color="primary" onClick={handleCreatePlaylist}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add the NotificationSystem component */}
      <NotificationSystem />
    </Box>
  );
}
