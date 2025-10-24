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

interface CreatePlaylistDialogProps {
  open: boolean;
  onClose: () => void;
  onPlaylistCreated?: () => void;
}

function CreatePlaylistDialog({
  open,
  onClose,
  onPlaylistCreated,
}: CreatePlaylistDialogProps) {
  // Local state for the input - isolated from parent
  const [name, setName] = useState('');

  // Reset name when dialog opens
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
        if (onPlaylistCreated) {
          onPlaylistCreated();
        }
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
    <Dialog onClose={onClose} open={open}>
      <DialogTitle>Create New Playlist</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Playlist Name"
          margin="dense"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          type="text"
          value={name}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button color="primary" onClick={handleCreate}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(CreatePlaylistDialog);
