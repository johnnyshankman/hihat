import * as React from 'react';
import { FormControl, useFormControlContext } from '@mui/base/FormControl';
import { Input, inputClasses } from '@mui/base/Input';
import { styled } from '@mui/system';
import clsx from 'clsx';
import { Dialog, DialogTitle } from '@mui/material';
import { useState } from 'react';
import { SongSkeletonStructure } from '../../common/common';
import useMainStore from '../store/main';
import usePlayerStore from '../store/player';

const blue = {
  100: '#DAECFF',
  200: '#b6daff',
  400: '#3399FF',
  500: '#007FFF',
  600: '#0072E5',
  900: '#003A75',
};

const grey = {
  50: '#F3F6F9',
  100: '#E5EAF2',
  200: '#DAE2ED',
  300: '#C7D0DD',
  400: '#B0B8C4',
  500: '#9DA8B7',
  600: '#6B7A90',
  700: '#434D5B',
  800: '#303740',
  900: '#1C2025',
};

const StyledInput = styled(Input)(
  ({ theme }) => `

  .${inputClasses.input} {
    width: 320px;
    font-family: 'IBM Plex Sans', sans-serif;
    font-size: 0.875rem;
    font-weight: 400;
    line-height: 1.5;
    padding: 8px 12px;
    border-radius: 8px;
    color: ${theme.palette.mode === 'dark' ? grey[300] : grey[900]};
    background: ${theme.palette.mode === 'dark' ? grey[900] : '#fff'};
    border: 1px solid ${theme.palette.mode === 'dark' ? grey[700] : grey[200]};
    box-shadow: 0px 2px 2px ${
      theme.palette.mode === 'dark' ? grey[900] : grey[50]
    };

    &:hover {
      border-color: ${blue[400]};
    }

    &:focus {
      outline: 0;
      border-color: ${blue[400]};
      box-shadow: 0 0 0 3px ${
        theme.palette.mode === 'dark' ? blue[600] : blue[200]
      };
    }
  }
`,
);

const Label = styled(
  ({
    children,
    className,
  }: {
    children?: React.ReactNode;
    className?: string;
  }) => {
    const formControlContext = useFormControlContext();
    const [dirty, setDirty] = React.useState(false);

    React.useEffect(() => {
      if (formControlContext?.filled) {
        setDirty(true);
      }
    }, [formControlContext]);

    if (formControlContext === undefined) {
      return <p>{children}</p>;
    }

    const { error, required, filled } = formControlContext;
    const showRequiredError = dirty && required && !filled;

    return (
      <p
        className={clsx(className, error || showRequiredError ? 'invalid' : '')}
      >
        {children}
        {required ? ' *' : ''}
      </p>
    );
  },
)`
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 0.875rem;
  margin-bottom: 4px;

  &.invalid {
    color: red;
  }
`;

export default function EditSongDataDialog(props: {
  open: boolean;
  onClose: () => void;
  song: string;
  songInfo: SongSkeletonStructure;
}) {
  const { onClose, song, songInfo, open } = props;
  const [songData, setSongData] = useState(songInfo);
  const libraryInStore = useMainStore((store) => store.library);
  const setLibraryInStore = useMainStore((store) => store.setLibrary);
  const filteredLibrary = usePlayerStore((store) => store.filteredLibrary);
  const setFilteredLibrary = usePlayerStore(
    (store) => store.setFilteredLibrary,
  );

  // if songInfo changes update the songData in a useEffect
  React.useEffect(() => {
    setSongData(songInfo);
  }, [songInfo]);

  // apply handler for modifying tags of a song in useEffect on mount
  React.useEffect(() => {
    window.electron.ipcRenderer.on('update-store-song', (event, args) => {
      console.log(args);
    });
  });

  return (
    <Dialog
      open={open}
      className="flex flex-col items-center justify-center content-center p-10"
    >
      <div className="flex flex-col items-center px-10 py-6">
        <DialogTitle>Edit Song</DialogTitle>

        <FormControl
          defaultValue=""
          value={songData.common.title}
          onChange={(e) => {
            setSongData({
              ...songData,
              common: {
                ...songData.common,
                title: e.target.value,
              },
            });
          }}
        >
          <Label>Name</Label>
          <StyledInput />
        </FormControl>

        <FormControl
          defaultValue=""
          value={songData.common.artist}
          onChange={(e) => {
            setSongData({
              ...songData,
              common: {
                ...songData.common, //
                artist: e.target.value,
              },
            });
          }}
        >
          <Label>Artist</Label>
          <StyledInput />
        </FormControl>

        <FormControl
          defaultValue=""
          value={songData.common.album}
          onChange={(e) => {
            setSongData({
              ...songData,
              common: {
                ...songData.common,
                album: e.target.value,
              },
            });
          }}
        >
          <Label>Album</Label>
          <StyledInput />
        </FormControl>

        <div className="flex flex-row mt-4">
          <div className="flex w-full justify-center pt-2 pb-1 px-2">
            <button
              type="button"
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => {
                // reset the song data
                setSongData(songInfo);
                onClose();
              }}
            >
              Cancel
            </button>
          </div>
          <div className="flex w-full justify-center pt-2 pb-1 px-2">
            <button
              type="button"
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
              onClick={() => {
                const tags = {
                  title: songData.common.title || '',
                  artist: songData.common.artist || '',
                  album: songData.common.album || '',
                };

                window.electron.ipcRenderer.sendMessage('modify-tags-of-file', {
                  song,
                  tags,
                });

                // update the tags for this song both in the library and the filtered library
                const songInLibrary = libraryInStore[song];
                const songInFiltered = filteredLibrary[song];

                if (songInLibrary) {
                  setLibraryInStore({
                    ...libraryInStore,
                    [song]: {
                      ...songInLibrary,
                      common: {
                        ...songInLibrary.common,
                        ...tags,
                      },
                    },
                  });
                }

                if (songInFiltered) {
                  setFilteredLibrary({
                    ...filteredLibrary,
                    [song]: {
                      ...songInFiltered,
                      common: {
                        ...songInFiltered.common,
                        ...tags,
                      },
                    },
                  });
                }
              }}
            >
              Update
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
