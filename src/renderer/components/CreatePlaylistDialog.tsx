import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import { useCreatePlaylist } from '../queries';

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

  // Mutation hook owns optimistic insert + rollback + invalidation.
  // isPending drives the Create button's disabled state below so the
  // user can't double-submit.
  const createPlaylist = useCreatePlaylist();

  // Reset the input on every open.
  // Needed because dialogs purposely never unmount and just toggle visibility.
  // They do this to ensure enter and exit animations are not cut off.
  //
  // We deliberately don't include `createPlaylist` in the deps: the
  // mutation object reference is fresh every render, so depending on
  // it would re-fire this effect on every render and reset the input
  // out from under the user's typing. The mutation's stale error state
  // is fine to leave between opens — it gets cleared on the next mutate.
  useEffect(() => {
    if (open) setName('');
  }, [open]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    try {
      await createPlaylist.mutateAsync({
        name: name.trim(),
        trackIds: [],
        isSmart: false,
        smartPlaylistId: null,
        ruleSet: null,
        sortPreference: null,
      });
      onClose();
    } catch {
      // Hook surfaced the error toast; keep dialog open so the user
      // can retry without losing what they typed.
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
          disabled={createPlaylist.isPending || !name.trim()}
          onClick={handleCreate}
        >
          {createPlaylist.isPending ? 'Creating…' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
