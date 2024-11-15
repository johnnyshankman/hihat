import React, { useState, useEffect } from 'react';
import Draggable from 'react-draggable';
import { TinyText } from './SimpleStyledMaterialUIComponents';
import AlbumArtRightClickMenu from './AlbumArtRightClickMenu';
import useMainStore from '../store/main';
import { useWindowDimensions } from '../hooks/useWindowDimensions';

interface AlbumArtProps {
  setShowAlbumArtMenu: (menu: any) => void;
  showAlbumArtMenu: any;
}

export default function AlbumArt({
  setShowAlbumArtMenu,
  showAlbumArtMenu,
}: AlbumArtProps) {
  /**
   * @dev window provider hook
   */
  const { width, height } = useWindowDimensions();

  /**
   * @dev store hooks
   */
  const currentSong = useMainStore((store) => store.currentSong);
  const currentSongMetadata = useMainStore(
    (store) => store.currentSongMetadata,
  );
  const currentSongDataURL = useMainStore(
    (store) => store.currentSongArtworkDataURL,
  );
  const filteredLibrary = useMainStore((store) => store.filteredLibrary);
  const setOverrideScrollToIndex = useMainStore(
    (store) => store.setOverrideScrollToIndex,
  );

  /**
   * @dev component state
   */
  const [albumArtMaxWidth, setAlbumArtMaxWidth] = useState(320);

  useEffect(() => {
    const handleResize = () => {
      if (width && height) {
        const maxWidthBasedOnWidth = Math.min(320, width * 0.4);
        const maxWidthBasedOnHeight = Math.min(320, height * 0.5);
        const newMaxWidth = Math.max(
          120,
          Math.min(maxWidthBasedOnWidth, maxWidthBasedOnHeight),
        );
        setAlbumArtMaxWidth(newMaxWidth);
      }
    };

    handleResize(); // Call once to set initial size
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [width, height]);

  if (!currentSongDataURL) {
    return (
      <div
        className="relative aspect-square w-full bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-600 border-2 border-neutral-700 shadow-2xl rounded-lg"
        style={{
          maxWidth: `${albumArtMaxWidth}px`,
        }}
      >
        <div className="inset-0 h-full w-full flex items-center justify-center rounded-lg">
          <svg
            className="text-neutral-300 w-1/5 h-1/5 animate-bounce"
            fill="none"
            height="24"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            viewBox="0 0 24 24"
            width="24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
          <TinyText className="absolute bottom-3 left-3">hihat</TinyText>
        </div>
        <Draggable
          axis="y"
          onDrag={(e, data) => {
            if (!width || !height) return;
            const newMaxWidth = albumArtMaxWidth + data.deltaY;
            const maxWidthBasedOnWidth = Math.min(320, width * 0.4);
            const maxWidthBasedOnHeight = Math.min(320, height * 0.6);
            const clampedMaxWidth = Math.max(
              120,
              Math.min(
                newMaxWidth,
                maxWidthBasedOnWidth,
                maxWidthBasedOnHeight,
              ),
            );
            setAlbumArtMaxWidth(clampedMaxWidth);

            /**
             * @important dispatch an event to let all components know the width has changed
             * @see LibraryList.tsx
             */
            window.dispatchEvent(new Event('album-art-width-changed'));
          }}
          position={{ x: 0, y: 0 }}
        >
          <div className="w-full absolute bottom-0 h-[20px] bg-transparent cursor-ns-resize hover:cursor-ns-resize" />
        </Draggable>
      </div>
    );
  }

  return (
    <div
      className="relative aspect-square w-full bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-600 border-2 border-neutral-700 shadow-2xl rounded-lg"
      style={{
        maxWidth: `${albumArtMaxWidth}px`,
      }}
    >
      <img
        alt="Album Art"
        aria-hidden="true"
        className="album-art h-full w-full rounded-lg hover:cursor-pointer"
        onClick={() => {
          const libraryArray = Object.values(filteredLibrary);
          const index = libraryArray.findIndex(
            (song) =>
              song.common.title === currentSongMetadata.common?.title &&
              song.common.artist === currentSongMetadata.common?.artist &&
              song.common.album === currentSongMetadata.common?.album,
          );
          setOverrideScrollToIndex(index);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowAlbumArtMenu({
            mouseX: e.clientX - 2,
            mouseY: e.clientY - 4,
          });
        }}
        src={currentSongDataURL}
        style={{
          maxWidth: `${albumArtMaxWidth}px`,
        }}
      />
      {showAlbumArtMenu && currentSong && (
        <AlbumArtRightClickMenu
          anchorEl={document.querySelector('.album-art')}
          mouseX={showAlbumArtMenu.mouseX}
          mouseY={showAlbumArtMenu.mouseY}
          onClose={() => {
            setShowAlbumArtMenu(undefined);
          }}
          song={currentSong}
        />
      )}
      <Draggable
        axis="y"
        onDrag={(e, data) => {
          if (!width || !height) return;
          const newMaxWidth = albumArtMaxWidth + data.deltaY;
          const maxWidthBasedOnWidth = Math.min(320, width * 0.4);
          const maxWidthBasedOnHeight = Math.min(320, height * 0.6);
          const clampedMaxWidth = Math.max(
            120,
            Math.min(newMaxWidth, maxWidthBasedOnWidth, maxWidthBasedOnHeight),
          );
          setAlbumArtMaxWidth(clampedMaxWidth);

          /**
           * @important dispatch an event to let all components know the width has changed
           * @see LibraryList.tsx
           */
          window.dispatchEvent(new Event('album-art-width-changed'));
        }}
        position={{ x: 0, y: 0 }}
      >
        <div className="w-full absolute bottom-0 h-[20px] bg-transparent cursor-ns-resize hover:cursor-ns-resize" />
      </Draggable>
    </div>
  );
}
