import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

type AlbumArtRightClickMenuProps = {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  song: string;
  mouseX: number;
  mouseY: number;
};

export default function AlbumArtRightClickMenu(
  props: AlbumArtRightClickMenuProps,
) {
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

  const toggleBrowserView = () => {
    window.dispatchEvent(new Event('toggle-browser-view'));
    onClose();
  };

  return (
    <Menu
      anchorEl={anchorEl}
      anchorOrigin={{
        vertical: 'center',
        horizontal: 'center',
      }}
      anchorPosition={{ top: mouseY, left: mouseX }}
      anchorReference="anchorPosition"
      className="nodrag"
      id="basic-menu"
      MenuListProps={{
        'aria-labelledby': 'basic-button',
      }}
      onClose={onClose}
      open
    >
      <MenuItem
        onClick={copyAlbumArt}
        sx={{
          fontSize: '11px',
        }}
      >
        Copy Image
      </MenuItem>
      <MenuItem
        onClick={downloadAlbumArt}
        sx={{
          fontSize: '11px',
        }}
      >
        Download Artwork
      </MenuItem>
      <MenuItem
        onClick={toggleBrowserView}
        sx={{
          fontSize: '11px',
        }}
      >
        Toggle Browser View
      </MenuItem>
    </Menu>
  );
}
