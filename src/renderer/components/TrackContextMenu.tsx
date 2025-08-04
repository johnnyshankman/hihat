import React, { useState } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Apple, Search, Download, Delete } from '@mui/icons-material';
import SpotifyIcon from '../assets/spotify.svg';
import {
  useSettingsAndPlaybackStore,
  useUIStore,
  useLibraryStore,
} from '../stores';
import ConfirmationDialog from './ConfirmationDialog';
import { getFilteredAndSortedTrackIds } from '../utils/trackSelectionUtils';

interface TrackContextMenuProps {
  open: boolean;
  anchorPosition: {
    top: number;
    left: number;
  } | null;
  onClose: () => void;
  trackId: string | null;
  onAddToPlaylist: (trackId: string) => void;
  isPlaylistView?: boolean;
  onRemoveFromPlaylist?: (trackId: string) => void;
}

function TrackContextMenu({
  open,
  anchorPosition,
  onClose,
  trackId,
  onAddToPlaylist,
  isPlaylistView = false,
  onRemoveFromPlaylist = undefined,
}: TrackContextMenuProps) {
  const selectSpecificSong = useSettingsAndPlaybackStore(
    (state) => state.selectSpecificSong,
  );
  const currentTrack = useSettingsAndPlaybackStore(
    (state) => state.currentTrack,
  );
  const setPaused = useSettingsAndPlaybackStore((state) => state.setPaused);
  const currentView = useUIStore((state) => state.currentView);
  const showNotification = useUIStore((state) => state.showNotification);
  const selectedPlaylistId = useLibraryStore(
    (state) => state.selectedPlaylistId,
  );
  const tracks = useLibraryStore((state) => state.tracks);
  const loadLibrary = useLibraryStore((state) => state.loadLibrary);
  const loadPlaylists = useLibraryStore((state) => state.loadPlaylists);

  // Add state for the delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  if (!trackId) return null;

  const handlePlayTrack = () => {
    if (currentView === 'settings') {
      throw new Error('Cannot play track in settings view');
    }

    if (currentView === 'playlists' && selectedPlaylistId) {
      selectSpecificSong(trackId, 'playlist', selectedPlaylistId);
    } else {
      const source = currentView === 'library' ? 'library' : 'playlist';
      selectSpecificSong(trackId, source);
    }
    onClose();
  };

  const handleAddToPlaylist = () => {
    onAddToPlaylist(trackId);
    onClose();
  };

  const handlerFindOnSpotify = () => {
    const track = tracks.find((t) => t.id === trackId);

    const urlEncodedTitle = encodeURIComponent(track?.title || '');
    const urlEncodedArtist = encodeURIComponent(track?.albumArtist || '');

    window.electron.app.openInBrowser(
      `https://open.spotify.com/search/${urlEncodedTitle}%20artist:${urlEncodedArtist}`,
    );
    onClose();
  };

  const handlerFindOnAppleMusic = () => {
    const track = tracks.find((t) => t.id === trackId);

    const urlEncodedTitle = encodeURIComponent(track?.title || '');
    const urlEncodedArtist = encodeURIComponent(track?.albumArtist || '');

    window.electron.app.openInBrowser(
      `https://music.apple.com/search?term=${urlEncodedTitle}%20${urlEncodedArtist}`,
    );
    onClose();
  };

  const handlerDownloadAlbumArt = async () => {
    const track = tracks.find((t) => t.id === trackId);
    if (track) {
      try {
        const result = await window.electron.fileSystem.downloadAlbumArt(track);
        if (!result.success) {
          console.error('Failed to download album art:', result.message);
        }
      } catch (error) {
        console.error('Error downloading album art:', error);
      }
    }
    onClose();
  };

  const handleShowInFinder = async () => {
    try {
      // Find the track to get its file path
      const track = tracks.find((t) => t.id === trackId);

      if (track && track.filePath) {
        // Use the electron API to show the file in Finder/Explorer
        await window.electron.fileSystem.showInFinder(track.filePath);
      } else {
        console.error('Track or file path not found');
      }

      onClose();
    } catch (error) {
      console.error('Error showing file in Finder:', error);
    }
  };

  const handleDeleteClick = () => {
    setDeleteDialogOpen(true);
    onClose();
  };

  const handleDeleteConfirm = async () => {
    try {
      const track = tracks.find((t) => t.id === trackId);

      if (!track) {
        showNotification('Track not found', 'error');
        setDeleteDialogOpen(false);
        return;
      }

      // Get the next track ID before deletion
      const trackIds = getFilteredAndSortedTrackIds('library');
      const currentIndex = trackIds.indexOf(trackId);
      const nextTrackId =
        currentIndex < trackIds.length - 1 ? trackIds[currentIndex + 1] : null;

      // Check if this is the currently playing track and pause playback if it is
      if (currentTrack && currentTrack.id === trackId) {
        setPaused(true);
      }

      // Step 1: Get all playlists that might contain this track
      const allPlaylists = await window.electron.playlists.getAll();

      // Step 2: Remove the track from all playlists that contain it
      const playlistsToUpdate = allPlaylists.filter(
        (playlist) => !playlist.isSmart && playlist.trackIds.includes(trackId),
      );

      // Update all playlists in parallel using Promise.all
      await Promise.all(
        playlistsToUpdate.map((playlist) => {
          const updatedPlaylist = {
            ...playlist,
            trackIds: playlist.trackIds.filter((id) => id !== trackId),
          };

          return window.electron.playlists.update(updatedPlaylist);
        }),
      );

      // Step 3: Delete the track from the database
      const dbDeleteResult = await window.electron.tracks.delete(trackId);

      if (!dbDeleteResult) {
        showNotification('Failed to delete track from database', 'error');
        setDeleteDialogOpen(false);
        return;
      }

      // Step 4: Delete the actual file from the filesystem
      if (track.filePath) {
        const fileDeleteResult = await window.electron.fileSystem.deleteFile(
          track.filePath,
        );

        if (!fileDeleteResult.success) {
          showNotification(
            `File deletion warning: ${fileDeleteResult.message}`,
            'warning',
          );
          // Continue with UI updates even if file deletion fails
        }
      }

      // Step 5: Update the UI
      // Reload the library to reflect the deleted track
      await loadLibrary(false);

      // Reload playlists to reflect any changes
      await loadPlaylists();

      showNotification(`Track "${track.title}" has been deleted`, 'success');
      setDeleteDialogOpen(false);

      // Step 6: Scroll to the next track if it exists
      if (nextTrackId) {
        // @ts-ignore - Using custom property we added to window
        window.hihatScrollToLibraryTrack?.(nextTrackId);
      }
    } catch (error) {
      console.error('Error deleting track:', error);
      showNotification('An error occurred while deleting the track', 'error');
      setDeleteDialogOpen(false);
    }
  };

  const handleDeleteCancel = () => {
    setDeleteDialogOpen(false);
  };

  const handleRemoveFromPlaylist = async () => {
    if (!trackId || !onRemoveFromPlaylist) return;
    onRemoveFromPlaylist(trackId);
    onClose();
  };

  return (
    <>
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
        <MenuItem onClick={handleShowInFinder}>
          <ListItemIcon>
            <Search fontSize="small" />
          </ListItemIcon>
          <ListItemText>Show in Finder</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlerFindOnSpotify}>
          <ListItemIcon>
            <img
              alt="Spotify"
              src={SpotifyIcon}
              style={{ filter: 'invert(1)' }}
            />
          </ListItemIcon>
          <ListItemText>Find on Spotify</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlerFindOnAppleMusic}>
          <ListItemIcon>
            <Apple fontSize="small" />
          </ListItemIcon>
          <ListItemText>Find on Apple Music</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlerDownloadAlbumArt}>
          <ListItemIcon>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download Album Art</ListItemText>
        </MenuItem>
        {isPlaylistView && onRemoveFromPlaylist ? (
          <MenuItem onClick={handleRemoveFromPlaylist}>
            <ListItemIcon>
              <Delete fontSize="small" htmlColor="red" />
            </ListItemIcon>
            <ListItemText style={{ color: 'red' }}>
              Remove from Playlist
            </ListItemText>
          </MenuItem>
        ) : (
          <MenuItem onClick={handleDeleteClick}>
            <ListItemIcon>
              <Delete fontSize="small" htmlColor="red" />
            </ListItemIcon>
            <ListItemText style={{ color: 'red' }}>Delete Track</ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Confirmation Dialog for track deletion */}
      <ConfirmationDialog
        cancelText="Cancel"
        confirmButtonColor="error"
        confirmText="Delete"
        message="This track will be permanently deleted from both the hihat database and your file system. This action cannot be undone. Are you sure you want to continue?"
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        open={deleteDialogOpen}
        title="Delete Track"
      />
    </>
  );
}

export default TrackContextMenu;
