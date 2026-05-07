import React, { useState } from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { Apple, Search, Download, Delete, Edit } from '@mui/icons-material';
import SpotifyIcon from '../assets/spotify.svg';
import TidalIcon from '../assets/tidal.svg';
import {
  useSettingsAndPlaybackStore,
  useUIStore,
  useLibraryStore,
} from '../stores';
import {
  useTracks,
  useDeleteTrack,
  useDeleteFile,
  useDownloadAlbumArt,
  useUpdatePlaylist,
  getPlaylistsSnapshot,
} from '../queries';
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
  onEditMetadata?: (trackId: string) => void;
  isPlaylistView?: boolean;
  onRemoveFromPlaylist?: (trackId: string) => void;
}

export default function TrackContextMenu({
  open,
  anchorPosition,
  onClose,
  trackId,
  onAddToPlaylist,
  onEditMetadata,
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

  // Server-state lookups via TanStack Query.
  const { data: tracksData } = useTracks();
  const getTrackById = (id: string | null) =>
    id ? tracksData?.indexes.trackIndex.get(id) : undefined;

  // Mutation hooks. Each owns optimistic update + rollback +
  // invalidation; their isPending and error states aren't surfaced to
  // a button here (the menu closes immediately after click) but error
  // toasts come through uiStore via the hooks' onError.
  const deleteTrackMutation = useDeleteTrack();
  const deleteFileMutation = useDeleteFile();
  const downloadAlbumArtMutation = useDownloadAlbumArt();
  const updatePlaylistMutation = useUpdatePlaylist();

  // Add state for the delete confirmation dialog
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const openExternalUrl = (url: string, label: string): void => {
    window.electron.app
      .openInBrowser(url)
      .then((result) => {
        if (!result.success) {
          showNotification(
            `Couldn't open ${label}: ${result.message ?? 'unknown error'}`,
            'error',
          );
        }
        return result;
      })
      .catch((error: unknown) => {
        console.error(`Failed to open ${label} URL:`, error);
        showNotification(`Couldn't open ${label}`, 'error');
      });
  };

  if (!trackId) return null;

  const handlePlayTrack = () => {
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

  const handleEditMetadata = () => {
    if (onEditMetadata) {
      onEditMetadata(trackId);
    }
    onClose();
  };

  const handlerFindOnSpotify = () => {
    const track = getTrackById(trackId);

    const urlEncodedTitle = encodeURIComponent(track?.title || '');
    const urlEncodedArtist = encodeURIComponent(track?.albumArtist || '');

    openExternalUrl(
      `https://open.spotify.com/search/${urlEncodedTitle}%20artist:${urlEncodedArtist}`,
      'Spotify',
    );
    onClose();
  };

  const handlerFindOnAppleMusic = () => {
    const track = getTrackById(trackId);

    const urlEncodedTitle = encodeURIComponent(track?.title || '');
    const urlEncodedArtist = encodeURIComponent(track?.albumArtist || '');

    openExternalUrl(
      `https://music.apple.com/search?term=${urlEncodedTitle}%20${urlEncodedArtist}`,
      'Apple Music',
    );
    onClose();
  };

  const handlerFindOnTidal = () => {
    const track = getTrackById(trackId);

    const urlEncodedArtist = encodeURIComponent(track?.albumArtist || '');
    const urlEncodedTitle = encodeURIComponent(track?.title || '');

    openExternalUrl(
      `https://tidal.com/search?q=${urlEncodedArtist}%20${urlEncodedTitle}`,
      'Tidal',
    );
    onClose();
  };

  const handlerDownloadAlbumArt = async () => {
    const track = getTrackById(trackId);
    if (track) {
      // Mutation hook owns the toast on failure; we await so the menu
      // doesn't close on top of a still-running download.
      try {
        await downloadAlbumArtMutation.mutateAsync(track);
      } catch {
        // hook already notified
      }
    }
    onClose();
  };

  const handleShowInFinder = async () => {
    try {
      // Find the track to get its file path
      const track = getTrackById(trackId);

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
      const track = getTrackById(trackId);

      if (!track) {
        showNotification('Track not found', 'error');
        setDeleteDialogOpen(false);
        return;
      }

      // Get the target track ID before deletion (next track, or previous if we're deleting the last track)
      // Need to get the browser filter from the library store for accurate track ordering
      const { browserFilters } = useLibraryStore.getState();
      const filter = browserFilters.library || { artist: null, album: null };
      const trackIds = getFilteredAndSortedTrackIds(
        'library',
        filter.artist,
        filter.album,
      );
      const currentIndex = trackIds.indexOf(trackId);
      let targetTrackId: string | null = null;

      // First try to find the next track
      if (currentIndex < trackIds.length - 1) {
        targetTrackId = trackIds[currentIndex + 1];
      } else if (currentIndex > 0) {
        // If we're deleting the last track, scroll to the previous one
        targetTrackId = trackIds[currentIndex - 1];
      }

      // Check if this is the currently playing track and pause playback if it is
      if (currentTrack && currentTrack.id === trackId) {
        setPaused(true);
      }

      // Step 1: Get all playlists from the cache (already populated by
      // Sidebar's usePlaylists subscription).
      const allPlaylists = getPlaylistsSnapshot() ?? [];

      // Step 2: Remove the track from each playlist via the mutation
      // hook so cache updates and rollback semantics stay consistent.
      const playlistsToUpdate = allPlaylists.filter(
        (playlist) => !playlist.isSmart && playlist.trackIds.includes(trackId),
      );
      await Promise.all(
        playlistsToUpdate.map((playlist) =>
          updatePlaylistMutation.mutateAsync({
            ...playlist,
            trackIds: playlist.trackIds.filter((id) => id !== trackId),
          }),
        ),
      );

      // Step 3: Delete the track from the database. The mutation hook
      // invalidates tracks + playlists on success; on failure it
      // throws and we surface the error.
      try {
        await deleteTrackMutation.mutateAsync(trackId);
      } catch {
        showNotification('Failed to delete track from database', 'error');
        setDeleteDialogOpen(false);
        return;
      }

      // Step 4: Delete the file from the filesystem.
      if (track.filePath) {
        const fileDeleteResult = await deleteFileMutation.mutateAsync(
          track.filePath,
        );
        if (!fileDeleteResult.success) {
          showNotification(
            `File deletion warning: ${fileDeleteResult.message}`,
            'warning',
          );
          // Continue with UI updates even if file deletion fails.
        }
      }

      showNotification(
        `Track "${track.title}" has been removed and moved to Trash`,
        'success',
      );
      setDeleteDialogOpen(false);

      // Step 5: Scroll to the target track if it exists.
      if (targetTrackId) {
        window.hihatScrollToLibraryTrack?.(targetTrackId);
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
        <MenuItem
          data-testid="add-to-playlist-menu-item"
          onClick={handleAddToPlaylist}
        >
          <ListItemIcon>
            <PlaylistAddIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add to Playlist</ListItemText>
        </MenuItem>
        <MenuItem
          data-testid="edit-metadata-menu-item"
          onClick={handleEditMetadata}
        >
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit Metadata</ListItemText>
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
        <MenuItem onClick={handlerFindOnTidal}>
          <ListItemIcon>
            <img
              alt="Tidal"
              src={TidalIcon}
              style={{ filter: 'invert(1)', width: 20, height: 20 }}
            />
          </ListItemIcon>
          <ListItemText>Find on Tidal</ListItemText>
        </MenuItem>
        <MenuItem onClick={handlerDownloadAlbumArt}>
          <ListItemIcon>
            <Download fontSize="small" />
          </ListItemIcon>
          <ListItemText>Download Album Art</ListItemText>
        </MenuItem>
        {isPlaylistView && onRemoveFromPlaylist ? (
          <MenuItem
            data-testid="remove-from-playlist-menu-item"
            onClick={handleRemoveFromPlaylist}
          >
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
            <ListItemText style={{ color: 'red' }}>
              Remove from Library
            </ListItemText>
          </MenuItem>
        )}
      </Menu>

      {/* Confirmation Dialog for track deletion */}
      <ConfirmationDialog
        cancelText="Cancel"
        confirmButtonColor="error"
        confirmText="Delete"
        message="This track will be removed from the hihat database and the file will be moved to your Trash. Are you sure you want to continue?"
        onCancel={handleDeleteCancel}
        onConfirm={handleDeleteConfirm}
        open={deleteDialogOpen}
        title="Delete Track"
      />
    </>
  );
}
