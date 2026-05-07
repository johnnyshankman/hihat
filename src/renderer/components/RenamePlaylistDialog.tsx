import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
} from '@mui/material';
import { usePlaylists, useUpdatePlaylist } from '../queries';

interface RenamePlaylistDialogProps {
  open: boolean;
  playlistId: string | null;
  initialName: string;
  onClose: () => void;
}

export default function RenamePlaylistDialog({
  open,
  playlistId,
  initialName,
  onClose,
}: RenamePlaylistDialogProps) {
  // Local state for the input - isolated from parent
  const [name, setName] = useState(initialName);

  const { data: playlists } = usePlaylists();
  const updatePlaylist = useUpdatePlaylist();

  // Reinitialize the input on open / when the target playlist changes.
  // Same reason as CreatePlaylistDialog: don't include the mutation
  // object in the deps — its reference churns every render and would
  // reset the input out from under the user's typing.
  useEffect(() => {
    if (open) setName(initialName);
  }, [open, initialName]);

  const handleConfirm = async () => {
    if (!playlistId || !name.trim()) return;
    const playlist = playlists?.find((p) => p.id === playlistId);
    if (!playlist) return;
    try {
      await updatePlaylist.mutateAsync({ ...playlist, name: name.trim() });
      onClose();
    } catch {
      // Hook already surfaced the error toast.
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
          label="New Playlist Name"
          margin="dense"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={handleKeyDown}
          slotProps={{ htmlInput: { 'data-testid': 'rename-playlist-input' } }}
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
          disabled={updatePlaylist.isPending || !name.trim()}
          disableElevation
          onClick={handleConfirm}
        >
          {updatePlaylist.isPending ? 'Renaming…' : 'Rename'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
