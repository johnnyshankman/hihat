import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import opener from 'opener';
import { SongSkeletonStructure } from '../../common/common';

type SongMenuProps = {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  song: string;
  songInfo: SongSkeletonStructure;
  mouseX: number;
  mouseY: number;
};

export default function ReusableSongMenu(props: SongMenuProps) {
  const { anchorEl, onClose, song, songInfo, mouseX, mouseY } = props;

  const showPathInFinder = () => {
    window.electron.ipcRenderer.sendMessage('show-in-finder', {
      path: song,
    });
    onClose();
  };

  const copyInfoToClipboard = () => {
    window.electron.ipcRenderer.sendMessage('copy-to-clipboard', {
      text: `${songInfo.common.title} - ${songInfo.common.artist} - ${songInfo.common.album}`,
    });
    onClose();
  };

  const downloadAlbumArt = () => {
    window.electron.ipcRenderer.sendMessage('download-artwork', {
      song,
    });
    onClose();
  };

  const copySpotifyLink = () => {
    const urlEncodedTitle = encodeURIComponent(songInfo?.common?.title || '');
    const urlEncodedArtist = encodeURIComponent(songInfo?.common?.artist || '');

    window.electron.ipcRenderer.sendMessage('open-in-browser', {
      text: `https://open.spotify.com/search/${urlEncodedTitle}%20artist:${urlEncodedArtist}`,
    });
    onClose();
  };

  const copyAppleMusicLink = () => {
    const urlEncodedTitle = encodeURIComponent(songInfo?.common?.title || '');
    const urlEncodedArtist = encodeURIComponent(songInfo?.common?.artist || '');

    window.electron.ipcRenderer.sendMessage('open-in-browser', {
      text: `https://music.apple.com/search?term=${urlEncodedTitle}%20${urlEncodedArtist}`,
    });
    onClose();
  };

  return (
    <Menu
      id="basic-menu"
      anchorEl={anchorEl}
      open
      MenuListProps={{
        'aria-labelledby': 'basic-button',
      }}
      onClose={onClose}
      anchorOrigin={{
        vertical: 'bottom',
        horizontal: 'right',
      }}
      anchorReference="anchorPosition"
      anchorPosition={{ top: mouseY, left: mouseX }}
    >
      <MenuItem
        sx={{
          fontSize: '11px',
        }}
        onClick={showPathInFinder}
      >
        Show In Finder
      </MenuItem>
      <MenuItem
        sx={{
          fontSize: '11px',
        }}
        onClick={copyInfoToClipboard}
      >
        Copy Song Info
      </MenuItem>
      <MenuItem
        sx={{
          fontSize: '11px',
        }}
        onClick={downloadAlbumArt}
      >
        Download Album Art
      </MenuItem>
      <MenuItem
        sx={{
          fontSize: '11px',
        }}
        onClick={copySpotifyLink}
      >
        Search on Spotify
      </MenuItem>
      <MenuItem
        sx={{
          fontSize: '11px',
        }}
        onClick={copyAppleMusicLink}
      >
        Search on Apple Music
      </MenuItem>
    </Menu>
  );
}
