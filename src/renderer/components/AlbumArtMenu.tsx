import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

type AlbumArtMenuProps = {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  song: string;
  mouseX: number;
  mouseY: number;
};

export default function AlbumArtMenu(props: AlbumArtMenuProps) {
  const { anchorEl, onClose, song, mouseX, mouseY } = props;

  const copyAlbumArt = () => {
    window.electron.ipcRenderer.sendMessage('copy-art-to-clipboard', {
      song,
    });
    onClose();
  };

  const downloadAlbumArt = () => {
    window.electron.ipcRenderer.sendMessage('download-artwork', {
      song,
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
        vertical: 'center',
        horizontal: 'center',
      }}
      anchorReference="anchorPosition"
      anchorPosition={{ top: mouseY, left: mouseX }}
    >
      <MenuItem
        sx={{
          fontSize: '11px',
        }}
        onClick={copyAlbumArt}
      >
        Copy Image
      </MenuItem>
      <MenuItem
        sx={{
          fontSize: '11px',
        }}
        onClick={downloadAlbumArt}
      >
        Download Artwork
      </MenuItem>
    </Menu>
  );
}
