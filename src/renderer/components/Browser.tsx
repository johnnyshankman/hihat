import React, { useState, useEffect, useRef } from 'react';
import { List } from 'react-virtualized';
import Draggable from 'react-draggable';
import { IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import usePlayerStore from '../store/player';
import useMainStore from '../store/main';
import { LightweightAudioMetadata } from '../../common/common';
import { useWindowDimensions } from '../hooks/useWindowDimensions';

interface BrowserProps {
  onClose: () => void;
}

type BrowserSelection = {
  artist: string | null;
  album: string | null;
};

const ROW_HEIGHT = 25.5; // Fixed row height
const BROWSER_WIDTH = 800; // Fixed browser width

/**
 * @TODO Refactor to use the useWindowDimensions hook. The tricky part is
 * that this component relies on width and height not being <undefined />
 * on initial render, which isn't always the case due to the way the original
 * window dimensions hooks works in the Main component.
 */
export default function Browser({ onClose }: BrowserProps) {
  const { width, height } = useWindowDimensions();
  const setFilteredLibrary = usePlayerStore(
    (store) => store.setFilteredLibrary,
  );
  const setOverrideScrollToIndex = usePlayerStore(
    (store) => store.setOverrideScrollToIndex,
  );
  const currentSong = usePlayerStore((store) => store.currentSong);
  const storeLibrary = useMainStore((store) => store.library);

  const [selection, setSelection] = useState<BrowserSelection>({
    artist: null,
    album: null,
  });

  const [artists, setArtists] = useState<string[]>([]);
  const [albums, setAlbums] = useState<string[]>([]);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [browserDimensions, setBrowserDimensions] = useState({
    width: BROWSER_WIDTH,
    height: height ? height * 0.25 : 400,
  });

  const browserRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!browserRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      // eslint-disable-next-line no-restricted-syntax
      for (const entry of entries) {
        const { width: newWidth, height: newHeight } = entry.contentRect;

        setBrowserDimensions({
          width: newWidth,
          height: newHeight,
        });
      }
    });

    resizeObserver.observe(browserRef.current);

    // eslint-disable-next-line consistent-return
    return () => {
      resizeObserver.disconnect();
    };
  }, [browserRef]);

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

  useEffect(() => {
    if (!width || !height) return;

    let newX = position.x;
    if (position.x + browserDimensions.width > width) {
      newX = width - browserDimensions.width - 10;
    }
    if (newX < 0) {
      newX = 0;
    }

    let newY = position.y;
    if (position.y + browserDimensions.height > height - 80) {
      newY = height - browserDimensions.height - 80;
    }
    if (newY < 60) {
      newY = 60;
    }

    if (newX !== position.x || newY !== position.y) {
      setPosition({ x: newX, y: newY });
    }
  }, [
    width,
    height,
    position.x,
    position.y,
    browserDimensions.width,
    browserDimensions.height,
  ]);

  type ResizeCorner = 'topLeft' | 'topRight' | 'bottomLeft';

  const handleResize =
    (corner: ResizeCorner) => (e: React.MouseEvent<HTMLDivElement>) => {
      if (!browserRef.current) return;

      const startX = e.clientX;
      const startY = e.clientY;
      const startWidth = browserRef.current.offsetWidth;
      const startHeight = browserRef.current.offsetHeight;
      const startLeft = position.x;
      const startTop = position.y;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        // Calculate deltas based on corner
        const deltaX =
          corner === 'topRight'
            ? moveEvent.clientX - startX
            : startX - moveEvent.clientX;

        const deltaY = corner.startsWith('top')
          ? startY - moveEvent.clientY
          : moveEvent.clientY - startY;

        const newWidth = Math.min(
          Math.max(400, startWidth + deltaX),
          width ? width - 20 : 1200,
        );
        const newHeight = Math.min(
          Math.max(200, startHeight + deltaY),
          height ? height - 60 - 120 : 800,
        );

        // Update position based on corner
        const newLeft =
          corner !== 'topRight'
            ? startLeft - (newWidth - startWidth)
            : startLeft;

        const newTop = corner.startsWith('top')
          ? startTop - (newHeight - startHeight)
          : startTop;

        setBrowserDimensions({
          width: newWidth,
          height: newHeight,
        });

        setPosition({
          x: corner !== 'topRight' ? newLeft : position.x,
          y: corner.startsWith('top') ? Math.max(60, newTop) : position.y,
        });
      };

      const handleMouseUp = () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    };

  const renderRow = (
    list: string[],
    selectedItem: string | null,
    onClick: (item: string | null) => void,
  ) =>
    // eslint-disable-next-line react/no-unstable-nested-components, func-names
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
          className="flex w-full items-center border-b last:border-b-0 border-neutral-800 transition-colors duration-75 hover:bg-neutral-800/50 data-[state=selected]:bg-neutral-800 py-1"
          data-state={list[index] === selectedItem ? 'selected' : undefined}
          onClick={() => {
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

  return (
    <Draggable
      bounds="parent"
      handle=".drag-handle"
      onStop={(e, data) => setPosition({ x: data.x, y: data.y })}
      position={position}
    >
      <div
        ref={browserRef}
        className="absolute nodrag bg-[#1d1d1d] rounded-lg shadow-2xl resize overflow-hidden"
        style={{
          width: browserDimensions.width,
          height: browserDimensions.height,
          resize: 'both',
          minWidth: '400px',
          minHeight: '200px',
          maxWidth: width ? width - 20 : BROWSER_WIDTH,
          maxHeight: height ? height - 60 - 120 : '400px',
          zIndex: 1000000000,
        }}
      >
        {/* Add this line right after the opening div */}
        <div
          aria-label="Resize browser"
          className="resize-handle-nw"
          onMouseDown={handleResize('topLeft')}
          role="button"
          tabIndex={0}
        />

        <div
          aria-label="Resize browser"
          className="resize-handle-ne"
          onMouseDown={handleResize('topRight')}
          role="button"
          tabIndex={0}
        />

        <div
          aria-label="Resize browser"
          className="resize-handle-sw"
          onMouseDown={handleResize('bottomLeft')}
          role="button"
          tabIndex={0}
        />

        <div className="drag-handle flex items-center justify-between px-2 py-0.5 border-b border-neutral-800 cursor-move border-t-2 border-l-2 border-r-2">
          <div className="flex items-center gap-2">
            <DragIndicatorIcon className="text-neutral-400" fontSize="small" />
            <span className="text-xs font-medium text-neutral-400">
              browser
            </span>
          </div>
          <IconButton
            className="text-neutral-400 hover:text-white"
            onClick={() => {
              const oldSelection = selection;

              setSelection({
                artist: null,
                album: null,
              });

              if (storeLibrary) {
                setFilteredLibrary(storeLibrary);
              }

              if (oldSelection.album) {
                // scroll to the album's first song in the library
                const firstSongIndex = Object.keys(storeLibrary).findIndex(
                  (key) =>
                    storeLibrary[key].common.album === oldSelection.album,
                );
                setOverrideScrollToIndex(firstSongIndex);
              } else if (oldSelection.artist) {
                // scroll to the artist's first song in the library
                const firstSongIndex = Object.keys(storeLibrary).findIndex(
                  (key) =>
                    storeLibrary[key].common.artist === oldSelection.artist,
                );
                setOverrideScrollToIndex(firstSongIndex);
              } else if (currentSong) {
                // scroll to the currently playing song
                const currentSongIndex = Object.keys(storeLibrary).findIndex(
                  (key) => key === currentSong,
                );
                setOverrideScrollToIndex(currentSongIndex);
              }

              onClose();
            }}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </div>

        <div className="grid grid-cols-2 divide-x divide-neutral-800 h-[calc(100%-32px)] border-neutral-800  border-b-2 border-l-2 border-r-2 rounded-b-lg">
          <div>
            <div className="sticky top-0 z-50 bg-[#1d1d1d] outline outline-offset-0 outline-1 mb-[1px] outline-neutral-800">
              <div className="select-none flex flow-row leading-[1em] items-center py-1.5 px-4 text-left align-middle font-medium text-xs text-neutral-500">
                Artist
              </div>
            </div>
            <List
              height={browserDimensions.height - 64}
              rowCount={artists.length}
              rowHeight={ROW_HEIGHT}
              rowRenderer={renderRow(artists, selection.artist, (artist) =>
                setSelection((_prev) => ({
                  artist,
                  album: null,
                })),
              )}
              width={browserDimensions.width / 2}
            />
          </div>
          <div>
            <div className="sticky top-0 z-50 bg-[#1d1d1d] outline outline-offset-0 outline-1 mb-[1px] outline-neutral-800">
              <div className="select-none flex flow-row leading-[1em] items-center py-1.5 px-4 text-left align-middle font-medium text-xs text-neutral-500">
                Album
              </div>
            </div>
            <List
              height={browserDimensions.height - 64}
              rowCount={albums.length}
              rowHeight={ROW_HEIGHT}
              rowRenderer={renderRow(albums, selection.album, (album) =>
                setSelection((prev) => ({ ...prev, album })),
              )}
              width={browserDimensions.width / 2}
            />
          </div>
        </div>
      </div>
    </Draggable>
  );
}
