import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { useState } from 'react';
import { LightweightAudioMetadata } from '../../common/common';
import { TinyText } from './SimpleStyledMaterialUIComponents';

type SongRightClickMenuProps = {
  anchorEl: HTMLElement | null;
  onClose: () => void;
  song: string;
  songInfo: LightweightAudioMetadata;
  mouseX: number;
  mouseY: number;
};

export default function SongRightClickMenu(props: SongRightClickMenuProps) {
  const { anchorEl, onClose, song, songInfo, mouseX, mouseY } = props;
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHideDialog, setShowHideDialog] = useState(false);
  const [showDeleteAlbumDialog, setShowDeleteAlbumDialog] = useState(false);

  const showPathInFinder = () => {
    window.electron.ipcRenderer.sendMessage('show-in-finder', {
      path: song,
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

  const hideSong = () => {
    window.electron.ipcRenderer.sendMessage('hide-song', {
      song,
    });
    onClose();
  };

  const deleteSong = () => {
    window.electron.ipcRenderer.sendMessage('delete-song', {
      song,
    });
    onClose();
  };

  const deleteAlbum = () => {
    window.electron.ipcRenderer.sendMessage('delete-album', {
      song,
    });
    onClose();
  };

  return (
    <>
      <Dialog
        className="flex flex-col items-center justify-center content-center p-10"
        open={showDeleteDialog}
      >
        <div className="flex flex-col items-center pb-4 max-w-[400px]">
          <DialogTitle>Delete Track</DialogTitle>
          <DialogContent>
            <div className="flex w-full justify-center px-2">
              <TinyText>
                This will delete {songInfo.common.title} from your hihat library{' '}
                <strong>
                  and permanently delete its file from your computer.
                  <br />
                  <br />
                  This operation cannot be undone.
                </strong>
              </TinyText>
            </div>
          </DialogContent>
          <div className="flex flex-row">
            <div className="flex w-full justify-center pt-2 pb-1 px-2">
              <button
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                onClick={() => {
                  setShowDeleteDialog(false);
                  onClose();
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
            <div className="flex w-full justify-center pt-2 pb-1 px-2">
              <button
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                onClick={deleteSong}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        className="flex flex-col items-center justify-center content-center p-10"
        open={showDeleteAlbumDialog}
      >
        <div className="flex flex-col items-center pb-4 max-w-[400px]">
          <DialogTitle>Delete Album</DialogTitle>
          <DialogContent>
            <div className="flex w-full justify-center px-2">
              <TinyText>
                This will delete {songInfo.common.album} from your hihat library{' '}
                <strong>
                  and permanently delete its files from your computer.
                  <br />
                  <br />
                  This operation cannot be undone.
                </strong>
              </TinyText>
            </div>
          </DialogContent>
          <div className="flex flex-row">
            <div className="flex w-full justify-center pt-2 pb-1 px-2">
              <button
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                onClick={() => {
                  setShowDeleteDialog(false);
                  onClose();
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
            <div className="flex w-full justify-center pt-2 pb-1 px-2">
              <button
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                onClick={deleteAlbum}
                type="button"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </Dialog>

      <Dialog
        className="flex flex-col items-center justify-center content-center p-10"
        open={showHideDialog}
      >
        <div className="flex flex-col items-center pb-4 max-w-[400px]">
          <DialogTitle>Hide Song</DialogTitle>
          <DialogContent>
            <div className="flex w-full justify-center px-2">
              <TinyText>
                This will hide {songInfo.common.title} from your hihat library
                but this action can be undone anytime by re-adding the file
                using the &quot;Add To Library&quot; button.
              </TinyText>
            </div>
          </DialogContent>
          <div className="flex flex-row">
            <div className="flex w-full justify-center pt-2 pb-1 px-2">
              <button
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                onClick={() => {
                  setShowHideDialog(false);
                  onClose();
                }}
                type="button"
              >
                Cancel
              </button>
            </div>
            <div className="flex w-full justify-center pt-2 pb-1 px-2">
              <button
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                onClick={hideSong}
                type="button"
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      </Dialog>

      <Menu
        anchorEl={anchorEl}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        anchorPosition={{ top: mouseY, left: mouseX }}
        anchorReference="anchorPosition"
        id="basic-menu"
        MenuListProps={{
          'aria-labelledby': 'basic-button',
        }}
        onClose={onClose}
        open
      >
        <MenuItem
          onClick={showPathInFinder}
          sx={{
            fontSize: '11px',
          }}
        >
          Show In Finder
        </MenuItem>
        <MenuItem
          onClick={() => {
            window.dispatchEvent(new Event('toggle-browser-view'));
            onClose();
          }}
          sx={{
            fontSize: '11px',
          }}
        >
          Toggle Browser View
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
          onClick={copySpotifyLink}
          sx={{
            fontSize: '11px',
          }}
        >
          Find on Spotify
        </MenuItem>
        <MenuItem
          onClick={copyAppleMusicLink}
          sx={{
            fontSize: '11px',
          }}
        >
          Find on Apple Music
        </MenuItem>
        <MenuItem
          onClick={() => setShowHideDialog(true)}
          sx={{
            fontSize: '11px',
          }}
        >
          Hide
        </MenuItem>
        <MenuItem
          onClick={() => setShowDeleteDialog(true)}
          style={{ color: 'red' }}
          sx={{
            fontSize: '11px',
          }}
        >
          Delete Song
        </MenuItem>
        <MenuItem
          onClick={() => setShowDeleteAlbumDialog(true)}
          style={{ color: 'red' }}
          sx={{
            fontSize: '11px',
          }}
        >
          Delete Album
        </MenuItem>
      </Menu>
    </>
  );
}
