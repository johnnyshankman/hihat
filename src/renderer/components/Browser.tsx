import React, {
  useMemo,
  useRef,
  useEffect,
  useCallback,
  useState,
} from 'react';
import { Track } from '../../types/dbTypes';

interface BrowserProps {
  tracks: Track[];
  selectedArtist: string | null;
  selectedAlbum: string | null;
  onArtistSelect: (artist: string | null) => void;
  onAlbumSelect: (album: string | null) => void;
  height: number;
  onHeightChange: (h: number) => void;
  open: boolean;
  onClose?: () => void;
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
  open,
  onClose,
}: BrowserProps) {
  const artistColumnRef = useRef<HTMLDivElement>(null);
  const albumColumnRef = useRef<HTMLDivElement>(null);
  const browserPanelRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<HTMLDivElement>(null);
  const resizeStartRef = useRef<{ startY: number; startHeight: number } | null>(
    null,
  );
  const [focusedColumn, setFocusedColumn] = useState<'artist' | 'album' | null>(
    null,
  );
  const [isResizing, setIsResizing] = useState(false);
  const typeAheadBufferRef = useRef('');
  const typeAheadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Sync inert attribute (React 18 doesn't type inert as a prop) and, on close,
  // return focus to the toggle button if focus lives inside the panel.
  useEffect(() => {
    const el = revealRef.current;
    if (!el) return;
    if (open) {
      el.removeAttribute('inert');
      return;
    }
    el.setAttribute('inert', '');
    if (browserPanelRef.current?.contains(document.activeElement)) {
      document
        .querySelector<HTMLElement>('[data-testid="browser-toggle"]')
        ?.focus();
    }
  }, [open]);

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

  // Auto-scroll previously selected artist into view upon re-render/return
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

  // Auto-scroll previously selected album into view upon re-render/return
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

  // Clear focus and type-ahead buffer when clicking outside the browser panel
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (
        browserPanelRef.current &&
        !browserPanelRef.current.contains(e.target as Node)
      ) {
        setFocusedColumn(null);
        typeAheadBufferRef.current = '';
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, []);

  // Type-ahead keyboard navigation (+ Escape closes)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Bail if panel is closed
      if (!open) return;

      // Escape closes the panel when a column has focus
      if (e.key === 'Escape' && focusedColumn && onClose) {
        e.preventDefault();
        setFocusedColumn(null);
        typeAheadBufferRef.current = '';
        onClose();
        return;
      }

      if (!focusedColumn) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length !== 1) return;

      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')
      ) {
        return;
      }

      e.preventDefault();

      typeAheadBufferRef.current += e.key.toLowerCase();

      if (typeAheadTimeoutRef.current) {
        clearTimeout(typeAheadTimeoutRef.current);
      }
      typeAheadTimeoutRef.current = setTimeout(() => {
        typeAheadBufferRef.current = '';
      }, 600);

      const buffer = typeAheadBufferRef.current;
      const list = focusedColumn === 'artist' ? artists : albums;
      const match = list.find((item) => sortKey(item).startsWith(buffer));

      if (match) {
        if (focusedColumn === 'artist') {
          onArtistSelect(match);
        } else {
          onAlbumSelect(match);
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    focusedColumn,
    artists,
    albums,
    onArtistSelect,
    onAlbumSelect,
    open,
    onClose,
  ]);

  // Resize handle logic — suppresses reveal transition while dragging
  const handleResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
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
        setIsResizing(false);
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
      ref={revealRef}
      aria-hidden={!open}
      className={`browser-reveal${isResizing ? ' browser-resizing' : ''}`}
      data-testid="browser-panel"
      id="browser-panel"
      style={{ height: open ? height : 0 }}
    >
      <div ref={browserPanelRef} className="browser-panel">
        <div className="browser-columns">
          {/* Album Artist column */}
          {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
          <div
            ref={artistColumnRef}
            className={`browser-column${focusedColumn === 'artist' ? ' browser-column-focused' : ''}`}
            data-testid="browser-artist-column"
            onMouseDown={() => {
              setFocusedColumn('artist');
              typeAheadBufferRef.current = '';
            }}
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
                onClick={() =>
                  onArtistSelect(selectedArtist === artist ? null : artist)
                }
                role="option"
              >
                {artist}
              </div>
            ))}
          </div>

          {/* Album column */}
          {/* eslint-disable-next-line jsx-a11y/interactive-supports-focus */}
          <div
            ref={albumColumnRef}
            className={`browser-column${focusedColumn === 'album' ? ' browser-column-focused' : ''}`}
            data-testid="browser-album-column"
            onMouseDown={() => {
              setFocusedColumn('album');
              typeAheadBufferRef.current = '';
            }}
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
                onClick={() =>
                  onAlbumSelect(selectedAlbum === album ? null : album)
                }
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
    </div>
  );
}

export default React.memo(Browser);
