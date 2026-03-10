import React, { useState, useEffect, memo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
} from '@mui/material';
import {
  useLibraryStore,
  useSettingsAndPlaybackStore,
  useUIStore,
} from '../stores';

interface EditMetadataDialogProps {
  open: boolean;
  trackId: string | null;
  onClose: () => void;
}

function parseNum(val: string): number | null {
  if (!val.trim()) return null;
  const n = parseInt(val, 10);
  return Number.isNaN(n) ? null : n;
}

function EditMetadataDialog({
  open,
  trackId,
  onClose,
}: EditMetadataDialogProps) {
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [genre, setGenre] = useState('');
  const [trackNumber, setTrackNumber] = useState('');
  const [totalTracks, setTotalTracks] = useState('');
  const [discNumber, setDiscNumber] = useState('');
  const [totalDiscs, setTotalDiscs] = useState('');
  const [year, setYear] = useState('');
  const [bpm, setBpm] = useState('');
  const [composer, setComposer] = useState('');
  const [comment, setComment] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && trackId) {
      const track = useLibraryStore.getState().getTrackById(trackId);
      if (track) {
        setTitle(track.title || '');
        setArtist(track.artist || '');
        setAlbum(track.album || '');
        setAlbumArtist(track.albumArtist || '');
        setGenre(track.genre || '');
        setTrackNumber(
          track.trackNumber != null ? String(track.trackNumber) : '',
        );
        setTotalTracks(
          track.totalTracks != null ? String(track.totalTracks) : '',
        );
        setDiscNumber(track.discNumber != null ? String(track.discNumber) : '');
        setTotalDiscs(track.totalDiscs != null ? String(track.totalDiscs) : '');
        setYear(track.year != null ? String(track.year) : '');
        setBpm(track.bpm != null ? String(track.bpm) : '');
        setComposer(track.composer || '');
        setComment(track.comment || '');
      }
    }
  }, [open, trackId]);

  const handleSave = async () => {
    if (!trackId) return;
    setSaving(true);

    try {
      const metadata = {
        title,
        artist,
        album,
        trackNumber: parseNum(trackNumber),
        totalTracks: parseNum(totalTracks),
        discNumber: parseNum(discNumber),
        totalDiscs: parseNum(totalDiscs),
        year: parseNum(year),
        bpm: parseNum(bpm),
        genre,
        albumArtist,
        composer: composer || null,
        comment: comment || null,
      };

      const result = await window.electron.tracks.updateMetadata(
        trackId,
        metadata,
      );

      if (result.success) {
        const updatedTrack = await window.electron.tracks.getById(trackId);
        if (updatedTrack) {
          useLibraryStore.getState().updateTrackInPlace(updatedTrack);

          const { currentTrack } = useSettingsAndPlaybackStore.getState();
          if (currentTrack && currentTrack.id === trackId) {
            useSettingsAndPlaybackStore.setState({
              currentTrack: updatedTrack,
            });
          }
        }

        if (result.fileWriteSuccess) {
          useUIStore
            .getState()
            .showNotification('Metadata updated successfully', 'success');
        } else {
          useUIStore
            .getState()
            .showNotification(
              result.message ||
                'Metadata saved to database but file tags could not be written',
              'warning',
            );
        }
      } else {
        useUIStore
          .getState()
          .showNotification(
            result.message || 'Failed to update metadata',
            'error',
          );
      }

      onClose();
    } catch (error) {
      console.error('Error saving metadata:', error);
      useUIStore
        .getState()
        .showNotification('Failed to update metadata', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      data-testid="edit-metadata-dialog"
      fullWidth
      maxWidth="sm"
      onClose={onClose}
      open={open}
    >
      <DialogTitle>Edit Metadata</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          inputProps={{ 'data-testid': 'metadata-title-input' }}
          label="Title"
          margin="dense"
          onChange={(e) => setTitle(e.target.value)}
          value={title}
        />
        <TextField
          fullWidth
          inputProps={{ 'data-testid': 'metadata-artist-input' }}
          label="Artist"
          margin="dense"
          onChange={(e) => setArtist(e.target.value)}
          value={artist}
        />
        <TextField
          fullWidth
          inputProps={{ 'data-testid': 'metadata-album-input' }}
          label="Album"
          margin="dense"
          onChange={(e) => setAlbum(e.target.value)}
          value={album}
        />
        <TextField
          fullWidth
          inputProps={{ 'data-testid': 'metadata-album-artist-input' }}
          label="Album Artist"
          margin="dense"
          onChange={(e) => setAlbumArtist(e.target.value)}
          value={albumArtist}
        />
        <TextField
          fullWidth
          inputProps={{ 'data-testid': 'metadata-genre-input' }}
          label="Genre"
          margin="dense"
          onChange={(e) => setGenre(e.target.value)}
          value={genre}
        />
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            inputProps={{ 'data-testid': 'metadata-track-number-input' }}
            label="Track #"
            margin="dense"
            onChange={(e) => setTrackNumber(e.target.value)}
            value={trackNumber}
          />
          <TextField
            fullWidth
            inputProps={{ 'data-testid': 'metadata-total-tracks-input' }}
            label="Total Tracks"
            margin="dense"
            onChange={(e) => setTotalTracks(e.target.value)}
            value={totalTracks}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            inputProps={{ 'data-testid': 'metadata-disc-number-input' }}
            label="Disc #"
            margin="dense"
            onChange={(e) => setDiscNumber(e.target.value)}
            value={discNumber}
          />
          <TextField
            fullWidth
            inputProps={{ 'data-testid': 'metadata-total-discs-input' }}
            label="Total Discs"
            margin="dense"
            onChange={(e) => setTotalDiscs(e.target.value)}
            value={totalDiscs}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            fullWidth
            inputProps={{ 'data-testid': 'metadata-year-input' }}
            label="Year"
            margin="dense"
            onChange={(e) => setYear(e.target.value)}
            value={year}
          />
          <TextField
            fullWidth
            inputProps={{ 'data-testid': 'metadata-bpm-input' }}
            label="BPM"
            margin="dense"
            onChange={(e) => setBpm(e.target.value)}
            value={bpm}
          />
        </Box>
        <TextField
          fullWidth
          inputProps={{ 'data-testid': 'metadata-composer-input' }}
          label="Composer"
          margin="dense"
          onChange={(e) => setComposer(e.target.value)}
          value={composer}
        />
        <TextField
          fullWidth
          inputProps={{ 'data-testid': 'metadata-comment-input' }}
          label="Comment"
          margin="dense"
          multiline
          onChange={(e) => setComment(e.target.value)}
          rows={3}
          value={comment}
        />
      </DialogContent>
      <DialogActions>
        <Button data-testid="cancel-metadata-button" onClick={onClose}>
          Cancel
        </Button>
        <Button
          color="primary"
          data-testid="save-metadata-button"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default memo(EditMetadataDialog);
