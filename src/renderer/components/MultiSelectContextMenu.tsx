import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { PlaylistAdd, Delete, PlaylistRemove } from '@mui/icons-material';

/* eslint-disable react/require-default-props */
interface MultiSelectContextMenuProps {
  open: boolean;
  anchorPosition: { top: number; left: number } | null;
  onClose: () => void;
  onAddToPlaylist?: () => void;
  onDeleteTracks?: () => void;
  onRemoveFromPlaylist?: () => void;
  selectedCount: number;
  isPlaylistView?: boolean;
}
/* eslint-enable react/require-default-props */

export default function MultiSelectContextMenu({
  open,
  anchorPosition,
  onClose,
  onAddToPlaylist,
  onDeleteTracks,
  onRemoveFromPlaylist,
  selectedCount,
  isPlaylistView = false,
}: MultiSelectContextMenuProps) {
  const handleAddToPlaylist = () => {
    if (onAddToPlaylist) {
      onAddToPlaylist();
      onClose();
    }
  };

  const handleDeleteTracks = () => {
    if (onDeleteTracks) {
      onDeleteTracks();
      onClose();
    }
  };

  const handleRemoveFromPlaylist = () => {
    if (onRemoveFromPlaylist) {
      onRemoveFromPlaylist();
      onClose();
    }
  };

  return (
    <Menu
      anchorPosition={anchorPosition || undefined}
      anchorReference="anchorPosition"
      onClose={onClose}
      open={open}
      PaperProps={{
        sx: {
          minWidth: 200,
        },
      }}
    >
      {isPlaylistView ? (
        <MenuItem onClick={handleRemoveFromPlaylist}>
          <ListItemIcon>
            <PlaylistRemove fontSize="small" />
          </ListItemIcon>
          <ListItemText>
            Remove from Playlist ({selectedCount} tracks)
          </ListItemText>
        </MenuItem>
      ) : (
        <>
          <MenuItem onClick={handleAddToPlaylist}>
            <ListItemIcon>
              <PlaylistAdd fontSize="small" />
            </ListItemIcon>
            <ListItemText>
              Add All To Playlist ({selectedCount} tracks)
            </ListItemText>
          </MenuItem>
          <MenuItem onClick={handleDeleteTracks}>
            <ListItemIcon>
              <Delete fontSize="small" />
            </ListItemIcon>
            <ListItemText>Remove From Library ({selectedCount} tracks)</ListItemText>
          </MenuItem>
        </>
      )}
    </Menu>
  );
}
