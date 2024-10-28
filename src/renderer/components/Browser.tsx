import React, { useState, useEffect } from 'react';
import { List } from 'react-virtualized';
import Draggable from 'react-draggable';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import usePlayerStore from '../store/player';
import useMainStore from '../store/main';
import { LightweightAudioMetadata } from '../../common/common';

interface BrowserProps {
  width: number | null;
  height: number | null;
  onClose: () => void;
}

type BrowserSelection = {
  artist: string | null;
  album: string | null;
};

const ROW_HEIGHT = 25.5;

export default function Browser({ width, height, onClose }: BrowserProps) {
  const setFilteredLibrary = usePlayerStore(
    (store) => store.setFilteredLibrary,
  );
  const storeLibrary = useMainStore((store) => store.library);

  const [selection, setSelection] = useState<BrowserSelection>({
    artist: null,
    album: null,
  });

  const [artists, setArtists] = useState<string[]>([]);
  const [albums, setAlbums] = useState<string[]>([]);

  const columnWidth = width
    ? Math.min(Math.floor((width * 0.6) / 2), 400)
    : 180;

  // Calculate available artists and albums based on library
  useEffect(() => {
    if (!storeLibrary) return;

    const artistSet = new Set<string>();
    const albumSet = new Set<string>();

    Object.values(storeLibrary).forEach((song: LightweightAudioMetadata) => {
      if (song.common.artist) {
        artistSet.add(song.common.artist);
      }
      if (song.common.album) {
        albumSet.add(song.common.album);
      }
    });

    setArtists(Array.from(artistSet).sort());
    setAlbums(Array.from(albumSet).sort());
  }, [storeLibrary]);

  // Filter the library based on selections
  useEffect(() => {
    if (!storeLibrary) return;

    const filteredSongs = { ...storeLibrary };
    Object.keys(filteredSongs).forEach((key) => {
      const song = filteredSongs[key];
      if (
        (selection.artist && song.common.artist !== selection.artist) ||
        (selection.album && song.common.album !== selection.album)
      ) {
        delete filteredSongs[key];
      }
    });

    setFilteredLibrary(filteredSongs);
  }, [selection, storeLibrary, setFilteredLibrary]);

  // Update available albums when artist is selected
  useEffect(() => {
    if (!storeLibrary || !selection.artist) {
      // Reset albums to full list when artist is deselected
      const albumSet = new Set<string>();
      Object.values(storeLibrary || {}).forEach(
        (song: LightweightAudioMetadata) => {
          if (song.common.album) {
            albumSet.add(song.common.album);
          }
        },
      );
      setAlbums(Array.from(albumSet).sort());
      return;
    }

    const albumSet = new Set<string>();
    Object.values(storeLibrary).forEach((song: LightweightAudioMetadata) => {
      if (song.common.artist === selection.artist && song.common.album) {
        albumSet.add(song.common.album);
      }
    });
    setAlbums(Array.from(albumSet).sort());
    setSelection((prev) => ({ ...prev, album: null }));
  }, [selection.artist, storeLibrary]);

  const [position, setPosition] = useState({ x: 100, y: 100 });

  useEffect(() => {
    if (!width || !height) return;

    const browserWidth = columnWidth * 2 + 8;
    const browserHeight = height * 0.4;

    let newX = position.x;
    if (position.x + browserWidth > width) {
      newX = width - browserWidth - 10;
    }
    if (newX < 0) {
      newX = 10;
    }

    let newY = position.y;
    if (position.y + browserHeight > height) {
      newY = height - browserHeight - 10;
    }
    if (newY < 0) {
      newY = 10;
    }

    if (newX !== position.x || newY !== position.y) {
      setPosition({ x: newX, y: newY });
    }
  }, [width, height, columnWidth, position.x, position.y]);

  const renderRow = (
    list: string[],
    selectedItem: string | null,
    onClick: (item: string | null) => void,
  ) =>
    // eslint-disable-next-line react/no-unstable-nested-components
    function ({
      index,
      key,
      style,
    }: {
      index: number;
      key: string;
      style: React.CSSProperties;
    }) {
      return (
        <div
          key={key}
          className="flex w-full items-center border-b last:border-b-0 border-neutral-800 transition-colors hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 py-1"
          data-state={list[index] === selectedItem ? 'selected' : undefined}
          onClick={() => {
            // If clicking the already selected item, unselect it
            if (list[index] === selectedItem) {
              onClick(null);
            } else {
              onClick(list[index]);
            }
          }}
          onKeyDown={() => {}}
          role="button"
          style={style}
          tabIndex={index}
        >
          <div className="select-none whitespace-nowrap overflow-hidden py-1 px-4 align-middle text-xs">
            {list[index]}
          </div>
        </div>
      );
    };

  if (!width || !height) return null;

  if (width < columnWidth * 2 + 8) {
    return null;
  }

  const listHeight = height * 0.4;

  return (
    <Draggable
      bounds="parent"
      handle=".drag-handle"
      onStop={(e, data) => setPosition({ x: data.x, y: data.y })}
      position={position}
    >
      <div
        className="absolute bg-[#1d1d1d] border-2 border-neutral-800 rounded-lg shadow-2xl z-[1000000000] drag"
        style={{ width: columnWidth * 2 + 8 }}
      >
        <div className="drag-handle flex items-center justify-between px-2 py-0.5 border-b border-neutral-800 cursor-move">
          <div className="flex items-center gap-2">
            <DragIndicatorIcon className="text-neutral-400" fontSize="small" />
            <span className="text-xs font-medium text-neutral-400">
              browser
            </span>
          </div>
          <IconButton
            className="text-neutral-400 hover:text-white"
            onClick={() => {
              // Reset selection state
              setSelection({
                artist: null,
                album: null,
              });

              // Reset filtered library to show all songs
              if (storeLibrary) {
                setFilteredLibrary(storeLibrary);
              }

              onClose();
            }}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        <div className="flex">
          <div style={{ width: columnWidth }}>
            <div className="sticky top-0 z-50 bg-[#1d1d1d] outline outline-offset-0 outline-1 mb-[1px] outline-neutral-800">
              <div className="select-none flex flow-row leading-[1em] items-center py-1.5 px-4 text-left align-middle font-medium text-xs text-neutral-500">
                Artist
              </div>
            </div>
            <List
              height={listHeight - 20}
              rowCount={artists.length}
              rowHeight={ROW_HEIGHT}
              rowRenderer={renderRow(artists, selection.artist, (artist) =>
                setSelection((_prev) => ({
                  artist,
                  album: null, // Clear album selection when artist changes
                })),
              )}
              width={columnWidth}
            />
          </div>
          <div style={{ width: columnWidth }}>
            <div className="sticky top-0 z-50 bg-[#1d1d1d] outline outline-offset-0 outline-1 mb-[1px] outline-neutral-800">
              <div className="select-none flex flow-row leading-[1em] items-center py-1.5 px-4 text-left align-middle font-medium text-xs text-neutral-500">
                Album
              </div>
            </div>
            <List
              height={listHeight - 20}
              rowCount={albums.length}
              rowHeight={ROW_HEIGHT}
              rowRenderer={renderRow(albums, selection.album, (album) =>
                setSelection((prev) => ({ ...prev, album })),
              )}
              width={columnWidth}
            />
          </div>
        </div>
      </div>
    </Draggable>
  );
}
