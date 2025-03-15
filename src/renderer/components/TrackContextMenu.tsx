import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoIcon from '@mui/icons-material/Info';
import { usePlaybackStore, useUIStore } from '../stores';

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

  if (!trackId) return null;

  const handlePlayTrack = () => {
    if (currentView === 'settings') {
      throw new Error('Cannot play track in settings view');
    }

    selectSpecificSong(trackId, currentView as 'library' | 'playlist');
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
