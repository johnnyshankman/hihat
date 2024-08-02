import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Dialog, DialogContent, DialogTitle } from '@mui/material';
import { useState } from 'react';
import { SongSkeletonStructure } from '../../common/common';
import { TinyText } from './SimpleStyledMaterialUIComponents';

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
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showHideDialog, setShowHideDialog] = useState(false);

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
                This will hide the song in your hihat library AND delete its
                file from your computer. This operation cannot be undone. Are
                you sure you'd like to proceed?
              </TinyText>
            </div>
          </DialogContent>
          <div className="flex flex-row">
            <div className="flex w-full justify-center pt-2 pb-1 px-2">
              <button
                type="button"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                onClick={() => {
                  setShowDeleteDialog(false);
                  onClose();
                }}
              >
                Cancel
              </button>
            </div>
            <div className="flex w-full justify-center pt-2 pb-1 px-2">
              <button
                type="button"
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                onClick={deleteSong}
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
                This will hide the song in your hihat library and can be undone
                anytime by re-adding the song to your library. Are you sure
                you'd like to proceed?
              </TinyText>
            </div>
          </DialogContent>
          <div className="flex flex-row">
            <div className="flex w-full justify-center pt-2 pb-1 px-2">
              <button
                type="button"
                className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
                onClick={() => {
                  setShowHideDialog(false);
                  onClose();
                }}
              >
                Cancel
              </button>
            </div>
            <div className="flex w-full justify-center pt-2 pb-1 px-2">
              <button
                type="button"
                className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                onClick={hideSong}
              >
                Hide
              </button>
            </div>
          </div>
        </div>
      </Dialog>

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
          onClick={() => setShowHideDialog(true)}
        >
          Hide Song
        </MenuItem>
        <MenuItem
          sx={{
            fontSize: '11px',
          }}
          onClick={() => setShowDeleteDialog(true)}
        >
          Hide & Delete Song
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
          onClick={copyInfoToClipboard}
        >
          Copy to Clipboard
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
    </>
  );
}
