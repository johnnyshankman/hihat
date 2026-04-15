import React, { useState, useEffect } from 'react';
import {
  Box,
  Drawer,
  Typography,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
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
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import {
  useLibraryStore,
  useSettingsAndPlaybackStore,
  useUIStore,
} from '../stores';
import WindowControls from './WindowControls';
import RenamePlaylistDialog from './RenamePlaylistDialog';
import CreatePlaylistDialog from './CreatePlaylistDialog';
import { mutedIconButtonSx } from '../styles/iconButtonStyles';

const drawerWidth = 200;

export default function Sidebar() {
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
  const sidebarOpen = useUIStore((state) => state.sidebarOpen);
  const toggleSidebar = useUIStore((state) => state.toggleSidebar);
  const showNotification = useUIStore((state) => state.showNotification);

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dragOverPlaylistId, setDragOverPlaylistId] = useState<string | null>(
    null,
  );
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renamePlaylistId, setRenamePlaylistId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    playlistId: string;
    isSmart?: boolean;
  } | null>(null);

  const handleViewChange = (view: 'library' | 'playlists') => {
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
    const playlist = playlists.find((p) => p.id === playlistId);
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
      playlistId,
      isSmart: playlist?.isSmart || false,
    });
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  const handleDeletePlaylist = async () => {
    if (!contextMenu) return;
    if (contextMenu.isSmart) {
      showNotification('Smart playlists cannot be deleted', 'warning');
      setContextMenu(null);
      return;
    }
    await deletePlaylist(contextMenu.playlistId);
    if (selectedPlaylistId === contextMenu.playlistId) {
      selectPlaylist(null);
    }
    setContextMenu(null);
  };

  const handleRenamePlaylist = () => {
    if (!contextMenu) return;
    setRenamePlaylistId(contextMenu.playlistId);
    setRenameDialogOpen(true);
    setContextMenu(null);
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

  const handlePlaylistDragOver = (
    e: React.DragEvent,
    playlistId: string,
    isSmart: boolean,
  ) => {
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
  };

  const handlePlaylistDragLeave = (e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) {
      return;
    }
    setDragOverPlaylistId(null);
  };

  const handlePlaylistDrop = async (
    e: React.DragEvent,
    playlistId: string,
    isSmart: boolean,
  ) => {
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

    const { addTrackToPlaylist } = useLibraryStore.getState();

    if (trackIds.length === 1) {
      await addTrackToPlaylist(trackIds[0], playlistId);
      return;
    }

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

    const dupeMsg = dupeCount > 0 ? ` (${dupeCount} already in playlist)` : '';
    showNotification(
      `Added ${newTrackIds.length} track${newTrackIds.length > 1 ? 's' : ''} to "${playlist.name}"${dupeMsg}`,
      'success',
    );
  };

  useEffect(() => {
    const handleDragEnd = () => setDragOverPlaylistId(null);
    document.addEventListener('dragend', handleDragEnd);
    return () => document.removeEventListener('dragend', handleDragEnd);
  }, []);

  return (
    <>
      <Drawer
        anchor="left"
        open={sidebarOpen}
        sx={{
          width: drawerWidth,
          flexShrink: 0,
          '& .MuiDrawer-paper': {
            width: drawerWidth,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 100px)',
            WebkitAppRegion: 'drag',
            '& .MuiListItemButton-root, & .MuiIconButton-root, & .MuiListItemIcon-root, & .MuiListItemText-root':
              {
                WebkitAppRegion: 'no-drag',
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
          {/* Window chrome row: traffic lights + settings/sidebar toggle */}
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              px: 1.5,
              py: 0.5,
              WebkitAppRegion: 'drag',
              height: '44px',
            }}
          >
            <WindowControls />
            <Box sx={{ display: 'flex', gap: 1.5, WebkitAppRegion: 'no-drag' }}>
              <Tooltip title="Settings">
                <IconButton
                  data-testid="nav-settings"
                  onClick={() => setSettingsOpen(!settingsOpen)}
                  size="small"
                  sx={{
                    ...mutedIconButtonSx,
                    padding: 0,
                  }}
                >
                  <SettingsIcon sx={{ fontSize: 20 }} />
                </IconButton>
              </Tooltip>
              <Tooltip title={sidebarOpen ? 'Hide Sidebar' : 'Show Sidebar'}>
                <IconButton
                  data-testid="sidebar-toggle-close"
                  onClick={toggleSidebar}
                  size="small"
                  sx={{
                    ...mutedIconButtonSx,
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
                  slotProps={{
                    primary: {
                      sx: {
                        fontSize: '13px',
                        fontWeight: currentView === 'library' ? 600 : 400,
                      },
                    },
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
                      ...mutedIconButtonSx,
                      p: 0,
                      left: '2px',
                      WebkitAppRegion: 'no-drag',
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
                      handlePlaylistDragOver(e, playlist.id, !!playlist.isSmart)
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
                      slotProps={{
                        primary: {
                          noWrap: true,
                          title: playlist.name,
                          sx: {
                            fontSize: '13px',
                            fontWeight:
                              currentView === 'playlists' &&
                              selectedPlaylistId === playlist.id
                                ? 600
                                : 400,
                          },
                        },
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Box>
          </List>
        </Paper>
      </Drawer>

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

      <CreatePlaylistDialog
        onClose={closeCreateDialog}
        open={createDialogOpen}
      />

      <RenamePlaylistDialog
        initialName={
          playlists.find((p) => p.id === renamePlaylistId)?.name || ''
        }
        onClose={closeRenameDialog}
        open={renameDialogOpen}
        playlistId={renamePlaylistId}
      />
    </>
  );
}
