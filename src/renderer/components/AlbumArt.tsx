import React, { useState } from 'react';
import Draggable from 'react-draggable';
import { TinyText } from './SimpleStyledMaterialUIComponents';
import AlbumArtRightClickMenu from './AlbumArtRightClickMenu';
import usePlayerStore from '../store/player';

interface AlbumArtProps {
  setShowAlbumArtMenu: (menu: any) => void;
  showAlbumArtMenu: any;
  width: number | null;
}

export default function AlbumArt({
  setShowAlbumArtMenu,
  showAlbumArtMenu,
  width,
}: AlbumArtProps) {
  /**
   * @dev global store hooks
   */
  const currentSong = usePlayerStore((store) => store.currentSong);
  const currentSongMetadata = usePlayerStore(
    (store) => store.currentSongMetadata,
  );
  const currentSongDataURL = usePlayerStore(
    (store) => store.currentSongDataURL,
  );
  const filteredLibrary = usePlayerStore((store) => store.filteredLibrary);
  const setOverrideScrollToIndex = usePlayerStore(
    (store) => store.setOverrideScrollToIndex,
  );

  /**
   * @dev component state
   */
  const [albumArtMaxWidth, setAlbumArtMaxWidth] = useState(320);

  if (!currentSongDataURL) {
    return (
      <div
        className="relative aspect-square w-[40%] bg-gradient-to-r from-neutral-800 via-neutral-700 to-neutral-600 border-2 border-neutral-700 shadow-2xl rounded-lg transition-all duration-500"
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
          if (!width) return;
          const newMaxWidth = albumArtMaxWidth + data.deltaY;
          const clampedMaxWidth = Math.max(
            120,
            Math.min(newMaxWidth, width * 0.4),
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
        <div className="w-full absolute bottom-0 h-[20px] bg-transparent cursor-ns-resize hover:cursor-ns-resize bg-red-400" />
      </Draggable>
    </div>
  );
}
