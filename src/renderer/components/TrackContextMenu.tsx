import React from 'react';
import { Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAdd';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InfoIcon from '@mui/icons-material/Info';
import { Apple, Search } from '@mui/icons-material';
import SpotifyIcon from '../assets/spotify.svg';
import { usePlaybackStore, useUIStore, useLibraryStore } from '../stores';

interface TrackContextMenuProps {
  open: boolean;
  anchorPosition: {
    top: number;
    left: number;
  } | null;
  onClose: () => void;
  trackId: string | null;
  onAddToPlaylist: (trackId: string) => void;
}

export default function TrackContextMenu({
  open,
  anchorPosition,
  onClose,
  trackId,
  onAddToPlaylist,
}: TrackContextMenuProps) {
  const selectSpecificSong = usePlaybackStore(
    (state) => state.selectSpecificSong,
  );
  const currentView = useUIStore((state) => state.currentView);
  const selectedPlaylistId = useLibraryStore(
    (state) => state.selectedPlaylistId,
  );
  const tracks = useLibraryStore((state) => state.tracks);

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

  return (
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
    </Menu>
  );
}
