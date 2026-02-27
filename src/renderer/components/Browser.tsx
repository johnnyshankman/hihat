import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import { Track } from '../../types/dbTypes';

interface BrowserProps {
  tracks: Track[];
  selectedArtist: string | null;
  selectedAlbum: string | null;
  onArtistSelect: (artist: string | null) => void;
  onAlbumSelect: (album: string | null) => void;
  height: number;
  onHeightChange: (h: number) => void;
}

// Strip leading "the " for sorting
function sortKey(name: string): string {
  const lower = name.toLowerCase();
  if (lower.startsWith('the ')) {
    return lower.slice(4);
  }
  return lower;
}

function Browser({
  tracks,
  selectedArtist,
  selectedAlbum,
  onArtistSelect,
  onAlbumSelect,
  height,
  onHeightChange,
}: BrowserProps) {
  const artistColumnRef = useRef<HTMLDivElement>(null);
  const albumColumnRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );

  // Compute unique album artists from tracks
  const artists = useMemo(() => {
    const artistSet = new Set<string>();
    tracks.forEach((track) => {
      const artist = track.albumArtist || track.artist || 'Unknown Artist';
      artistSet.add(artist);
    });
    const list = Array.from(artistSet);
    list.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    return list;
  }, [tracks]);

  // Compute unique albums, filtered by selected artist if any
  const albums = useMemo(() => {
    let filtered = tracks;
    if (selectedArtist) {
      filtered = tracks.filter((track) => {
        const artist = track.albumArtist || track.artist || 'Unknown Artist';
        return artist === selectedArtist;
      });
    }
    const albumSet = new Set<string>();
    filtered.forEach((track) => {
      const album = track.album || 'Unknown Album';
      albumSet.add(album);
    });
    const list = Array.from(albumSet);
    list.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
    return list;
  }, [tracks, selectedArtist]);

  // Auto-scroll selected artist into view
  useEffect(() => {
    if (selectedArtist && artistColumnRef.current) {
      const el = artistColumnRef.current.querySelector(
        `[data-artist="${CSS.escape(selectedArtist)}"]`,
      );
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedArtist]);

  // Auto-scroll selected album into view
  useEffect(() => {
    if (selectedAlbum && albumColumnRef.current) {
      const el = albumColumnRef.current.querySelector(
        `[data-album="${CSS.escape(selectedAlbum)}"]`,
      );
      if (el) {
        el.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedAlbum]);

  // Resize handle logic
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      resizeStartRef.current = { startY: e.clientY, startHeight: height };

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!resizeStartRef.current) return;
        const delta = moveEvent.clientY - resizeStartRef.current.startY;
        const newHeight = Math.max(
          80,
          Math.min(600, resizeStartRef.current.startHeight + delta),
        );
        onHeightChange(newHeight);
      };

      const handleMouseUp = () => {
        resizeStartRef.current = null;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    },
    [height, onHeightChange],
  );

  return (
    <div
      className="browser-panel"
      data-testid="browser-panel"
      style={{ height }}
    >
      <div className="browser-columns">
        {/* Album Artist column */}
        <div
          ref={artistColumnRef}
          className="browser-column"
          data-testid="browser-artist-column"
          role="listbox"
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus */}
          <div
            aria-selected={selectedArtist === null}
            className={`browser-item${selectedArtist === null ? ' browser-item-selected' : ''}`}
            data-testid="browser-artist-all"
            onClick={() => onArtistSelect(null)}
            role="option"
          >
            All Album Artists ({artists.length})
          </div>
          {artists.map((artist) => (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
            <div
              key={artist}
              aria-selected={selectedArtist === artist}
              className={`browser-item${selectedArtist === artist ? ' browser-item-selected' : ''}`}
              data-artist={artist}
              data-testid="browser-artist-item"
              onClick={() => onArtistSelect(artist)}
              role="option"
            >
              {artist}
            </div>
          ))}
        </div>

        {/* Album column */}
        <div
          ref={albumColumnRef}
          className="browser-column"
          data-testid="browser-album-column"
          role="listbox"
        >
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus */}
          <div
            aria-selected={selectedAlbum === null}
            className={`browser-item${selectedAlbum === null ? ' browser-item-selected' : ''}`}
            data-testid="browser-album-all"
            onClick={() => onAlbumSelect(null)}
            role="option"
          >
            All Albums ({albums.length})
          </div>
          {albums.map((album) => (
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/interactive-supports-focus
            <div
              key={album}
              aria-selected={selectedAlbum === album}
              className={`browser-item${selectedAlbum === album ? ' browser-item-selected' : ''}`}
              data-album={album}
              data-testid="browser-album-item"
              onClick={() => onAlbumSelect(album)}
              role="option"
            >
              {album}
            </div>
          ))}
        </div>
      </div>

      {/* Resize handle */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className="browser-resize-handle"
        data-testid="browser-resize-handle"
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
}

export default React.memo(Browser, (prevProps, nextProps) => {
  return (
    prevProps.tracks === nextProps.tracks &&
    prevProps.selectedArtist === nextProps.selectedArtist &&
    prevProps.selectedAlbum === nextProps.selectedAlbum &&
    prevProps.height === nextProps.height &&
    prevProps.onArtistSelect === nextProps.onArtistSelect &&
    prevProps.onAlbumSelect === nextProps.onAlbumSelect &&
    prevProps.onHeightChange === nextProps.onHeightChange
  );
});
