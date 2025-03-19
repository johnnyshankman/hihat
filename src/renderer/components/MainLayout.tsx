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
import { useLibraryStore, useUIStore } from '../stores';
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
  const [open, setOpen] = useState(true);
  const currentView = useUIStore((state) => state.currentView);
  const setCurrentView = useUIStore((state) => state.setCurrentView);
  const [playlistsOpen, setPlaylistsOpen] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);

  // Context menu for playlist deletion
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    playlistId: string;
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
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      playlistId,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleDeletePlaylist = async () => {
    if (contextMenu) {
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
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Typography variant="h5">Loading...</Typography>
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
          {/* Window Controls */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px',
              WebkitAppRegion: 'drag', // Make this area draggable
              height: '60px',
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
                    bgcolor: (theme) => theme.palette.grey[500],
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
                    bgcolor: (theme) => theme.palette.grey[500],
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
                    bgcolor: (theme) => theme.palette.grey[500],
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
              <List component="div" disablePadding>
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
                    sx={{ pl: 3, py: 0.5, WebkitAppRegion: 'no-drag' }}
                  >
                    <ListItemText
                      primary={playlist.name}
                      primaryTypographyProps={{
                        variant: 'body2',
                        noWrap: true,
                        title: playlist.name,
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Collapse>

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
          </List>
        </Drawer>
        <Main open={open}>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              height: 'calc(100vh - 100px)', // Adjusted height since AppBar is removed
              overflow: 'hidden',
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
        <MenuItem onClick={handleDeletePlaylist}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Delete Playlist</ListItemText>
        </MenuItem>
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
