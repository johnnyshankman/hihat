import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoIcon from '@mui/icons-material/Info';
import { usePlaybackStore, useUIStore, useLibraryStore } from '../stores';

interface TrackContextMenuProps {
  open: boolean;
  anchorPosition: {
    top: number;
    left: number;
  } | null;
  onClose: () => void;
  trackId: string | null;
  onAddToPlaylist: (trackId: string) => void;
}

export default function TrackContextMenu({
  open,
  anchorPosition,
  onClose,
  trackId,
  onAddToPlaylist,
}: TrackContextMenuProps) {
  const selectSpecificSong = usePlaybackStore(
    (state) => state.selectSpecificSong,
  );
  const currentView = useUIStore((state) => state.currentView);
  const selectedPlaylistId = useLibraryStore(
    (state) => state.selectedPlaylistId,
  );

  if (!trackId) return null;

  const handlePlayTrack = () => {
    if (currentView === 'settings') {
      throw new Error('Cannot play track in settings view');
    }

    if (currentView === 'playlists' && selectedPlaylistId) {
      selectSpecificSong(trackId, 'playlist', selectedPlaylistId);
    } else {
      const source = currentView === 'library' ? 'library' : 'playlist';
      selectSpecificSong(trackId, source);
    }
    onClose();
  };

  const handleAddToPlaylist = () => {
    onAddToPlaylist(trackId);
    onClose();
  };

  return (
    <Menu
      anchorPosition={anchorPosition || undefined}
      anchorReference="anchorPosition"
      onClose={onClose}
      open={open}
    >
      <MenuItem onClick={handlePlayTrack}>
        <ListItemIcon>
          <PlayArrowIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Play</ListItemText>
      </MenuItem>
      <MenuItem onClick={handleAddToPlaylist}>
        <ListItemIcon>
          <PlaylistAddIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Add to Playlist</ListItemText>
      </MenuItem>
      <MenuItem onClick={() => {}}>
        <ListItemIcon>
          <InfoIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Track Info</ListItemText>
      </MenuItem>
    </Menu>
  );
}
