import React, { useState, useMemo } from 'react';
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
import type { Playlist } from '../../types/dbTypes';
import {
  usePlaylists,
  useCreatePlaylist,
  useAddTrackToPlaylist,
} from '../queries';

const EMPTY_PLAYLISTS: Playlist[] = [];

interface PlaylistSelectionDialogProps {
  open: boolean;
  onClose: () => void;
  trackId?: string;
  trackIds?: string[];
}

export default function PlaylistSelectionDialog({
  open,
  onClose,
  trackId = undefined,
  trackIds = undefined,
}: PlaylistSelectionDialogProps) {
  // Server state via TanStack Query. The `addTrackToPlaylist` and
  // `createPlaylist` mutation hooks own optimistic update + rollback +
  // invalidation; their isPending state drives the button labels below.
  // Stable empty fallback so the userPlaylists useMemo dep stays the
  // same reference when the cache is empty.
  const { data: playlistsData } = usePlaylists();
  const playlists = playlistsData ?? EMPTY_PLAYLISTS;
  const addTrackToPlaylist = useAddTrackToPlaylist();
  const createPlaylist = useCreatePlaylist();

  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);

  // Use trackIds if provided, otherwise use single trackId
  const tracksToAdd = trackIds || (trackId ? [trackId] : []);

  // Memoize the filtered playlists to prevent unnecessary recalculations
  const userPlaylists = useMemo(
    () => playlists.filter((playlist) => !playlist.isSmart),
    [playlists],
  );

  const handleAddToPlaylist = async (playlistId: string) => {
    try {
      // eslint-disable-next-line no-restricted-syntax
      for (const id of tracksToAdd) {
        // eslint-disable-next-line no-await-in-loop
        await addTrackToPlaylist.mutateAsync({ trackId: id, playlistId });
      }
      onClose();
    } catch {
      // Hook already toasts on failure / "track already in playlist".
    }
  };

  const handleCreatePlaylist = async () => {
    if (!newPlaylistName.trim()) return;
    try {
      // useCreatePlaylist returns the created Playlist (with its id) on
      // success — we don't need to re-fetch the playlists list.
      const newPlaylist = await createPlaylist.mutateAsync({
        name: newPlaylistName.trim(),
        trackIds: [],
        isSmart: false,
        smartPlaylistId: null,
        ruleSet: null,
        sortPreference: null,
      });

      // eslint-disable-next-line no-restricted-syntax
      for (const id of tracksToAdd) {
        // eslint-disable-next-line no-await-in-loop
        await addTrackToPlaylist.mutateAsync({
          trackId: id,
          playlistId: newPlaylist.id,
        });
      }

      setNewPlaylistName('');
      setShowNewPlaylistInput(false);
      onClose();
    } catch {
      // Hook already toasts on failure.
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
      <DialogTitle>
        Add{' '}
        {tracksToAdd.length > 1 ? `${tracksToAdd.length} tracks` : '1 track'} to
        Playlist
      </DialogTitle>
      <DialogContent>
        {userPlaylists.length > 0 ? (
          <>
            <Typography gutterBottom variant="subtitle1">
              Select a playlist:
            </Typography>
            <List sx={{ maxHeight: 300, overflow: 'auto' }}>
              {userPlaylists.map((playlist) => (
                <ListItemButton
                  key={playlist.id}
                  data-playlist-id={playlist.id}
                  data-testid={`playlist-option-${playlist.id}`}
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
                disabled={
                  !newPlaylistName.trim() ||
                  createPlaylist.isPending ||
                  addTrackToPlaylist.isPending
                }
                onClick={handleCreatePlaylist}
                variant="contained"
              >
                {createPlaylist.isPending || addTrackToPlaylist.isPending
                  ? 'Adding…'
                  : 'Create & Add'}
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
