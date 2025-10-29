import React, { useState, useEffect, memo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import { useLibraryStore } from '../stores';

interface RenamePlaylistDialogProps {
  open: boolean;
  playlistId: string | null;
  initialName: string;
  onClose: () => void;
}

function RenamePlaylistDialog({
  open,
  playlistId,
  initialName,
  onClose,
}: RenamePlaylistDialogProps) {
  // Local state for the input - isolated from parent
  const [name, setName] = useState(initialName);

  // Update local state when dialog opens with new playlist
  useEffect(() => {
    if (open) {
      setName(initialName);
    }
  }, [open, initialName]);

  const handleConfirm = async () => {
    if (playlistId && name.trim()) {
      try {
        // Get the playlist directly from the store
        const { playlists } = useLibraryStore.getState();
        const playlist = playlists.find((p) => p.id === playlistId);

        if (playlist) {
          const updatedPlaylist = {
            ...playlist,
            name: name.trim(),
          };
          await useLibraryStore.getState().updatePlaylist(updatedPlaylist);
        }
        onClose();
      } catch (error) {
        console.error('Error renaming playlist:', error);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <Dialog data-testid="rename-playlist-dialog" onClose={onClose} open={open}>
      <DialogTitle>Rename Playlist</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          inputProps={{ 'data-testid': 'rename-playlist-input' }}
          label="New Playlist Name"
          margin="dense"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          type="text"
          value={name}
        />
      </DialogContent>
      <DialogActions>
        <Button
          data-testid="cancel-rename-button"
          disableElevation
          onClick={onClose}
        >
          Cancel
        </Button>
        <Button
          data-testid="confirm-rename-button"
          disableElevation
          onClick={handleConfirm}
        >
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(RenamePlaylistDialog);
