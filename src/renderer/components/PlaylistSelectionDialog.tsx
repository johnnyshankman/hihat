import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItemText,
  ListItemButton,
  TextField,
  Box,
  Typography,
  Divider,
} from '@mui/material';
import { useLibraryStore } from '../stores';

interface PlaylistSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  trackId: string;
}

export default function PlaylistSelectionDialog({
  open,
  onClose,
  trackId,
}: PlaylistSelectionDialogProps) {
  const playlists = useLibraryStore((state) => state.playlists);
  const addTrackToPlaylist = useLibraryStore(
    (state) => state.addTrackToPlaylist,
  );
  const createPlaylist = useLibraryStore((state) => state.createPlaylist);

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);

  const handleAddToPlaylist = async (playlistId: string) => {
    try {
      await addTrackToPlaylist(trackId, playlistId);
      onClose();
    } catch (error) {
      console.error('Error adding track to playlist:', error);
    }
  };

  const handleCreatePlaylist = async () => {
    if (newPlaylistName.trim()) {
      try {
        // Create the playlist
        await createPlaylist(newPlaylistName.trim());

        // Find the newly created playlist
        const updatedPlaylists = await window.electron.playlists.getAll();
        const newPlaylist = updatedPlaylists.find(
          (playlist) => playlist.name === newPlaylistName.trim(),
        );

        if (newPlaylist && newPlaylist.id) {
          await addTrackToPlaylist(trackId, newPlaylist.id);
        }

        setNewPlaylistName('');
        setShowNewPlaylistInput(false);
        onClose();
      } catch (error) {
        console.error('Error creating playlist:', error);
      }
    }
  };

  const toggleNewPlaylistInput = () => {
    setShowNewPlaylistInput(!showNewPlaylistInput);
    if (!showNewPlaylistInput) {
      setNewPlaylistName('');
    }
  };

  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>Add to Playlist</DialogTitle>
      <DialogContent>
        {playlists.length > 0 ? (
          <>
            <Typography gutterBottom variant="subtitle1">
              Select a playlist:
            </Typography>
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {playlists
                .filter((playlist) => !playlist.isSmart)
                .map((playlist) => (
                  <ListItemButton
                    key={playlist.id}
                    onClick={() => handleAddToPlaylist(playlist.id)}
                  >
                    <ListItemText
                      primary={playlist.name}
                      secondary={`${playlist.trackIds.length} tracks`}
                    />
                  </ListItemButton>
                ))}
            </List>
          </>
        ) : (
          <Typography sx={{ mb: 2 }} variant="body1">
            You don&apos;t have any playlists yet. Create one below.
          </Typography>
        )}

        <Divider sx={{ my: 2 }} />

        {showNewPlaylistInput ? (
          <Box sx={{ mt: 2 }}>
            <TextField
              autoFocus
              fullWidth
              label="New Playlist Name"
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleCreatePlaylist();
                }
              }}
              sx={{ mb: 1 }}
              value={newPlaylistName}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
              <Button onClick={toggleNewPlaylistInput} sx={{ mr: 1 }}>
                Cancel
              </Button>
              <Button
                color="primary"
                disabled={!newPlaylistName.trim()}
                onClick={handleCreatePlaylist}
                variant="contained"
              >
                Create & Add
              </Button>
            </Box>
          </Box>
        ) : (
          <Button
            color="primary"
            fullWidth
            onClick={toggleNewPlaylistInput}
            variant="outlined"
          >
            Create New Playlist
          </Button>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}
