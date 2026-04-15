import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import { useLibraryStore } from '../stores';

interface CreatePlaylistDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function CreatePlaylistDialog({
  open,
  onClose,
}: CreatePlaylistDialogProps) {
  // Local state for the input - isolated from parent
  const [name, setName] = useState('');

  // Reset name when dialog opens
  // Code smell: This is sort of an anti pattern. We're reacting to prop changes
  // in order to reset the internal state which is kind of odd. It's because this
  // is hidden but still mounted 24/7 so the state never implicitly resets itself.
  useEffect(() => {
    if (open) {
      setName('');
    }
  }, [open]);

  const handleCreate = async () => {
    if (name.trim()) {
      try {
        await useLibraryStore.getState().createPlaylist(name.trim());
        onClose();
      } catch (error) {
        console.error('Error creating playlist:', error);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreate();
    }
  };

  return (
    <Dialog data-testid="create-playlist-dialog" onClose={onClose} open={open}>
      <DialogTitle>Create New Playlist</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Playlist Name"
          margin="dense"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          slotProps={{ htmlInput: { 'data-testid': 'playlist-name-input' } }}
          type="text"
          value={name}
        />
      </DialogContent>
      <DialogActions>
        <Button data-testid="cancel-playlist-button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          color="primary"
          data-testid="create-playlist-button"
          onClick={handleCreate}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}
