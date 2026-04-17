import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Box,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import { type Row, type SortingState, type Table } from '@tanstack/react-table';
import { type Virtualizer } from '@tanstack/react-virtual';
import {
  useLibraryStore,
  useSettingsAndPlaybackStore,
  useUIStore,
} from '../stores';
import VirtualTable from './VirtualTable';
import SidebarToggle from './SidebarToggle';
import NotificationButton from './NotificationButton';
import {
  getCommonColumnDefs,
  getRowClassName,
  type TableData,
} from '../utils/tableConfig';

// Sorting is disabled in this view — queue order IS the data — so we
// hand VirtualTable a stable empty SortingState. Module-level constant
// keeps the reference identity-stable across renders.
const NO_SORTING: SortingState = [];

/**
 * Scroll to the queue's currently-playing track. Used both on mount and
 * whenever the user clicks the sidebar entry to re-enter the view.
 */
function useScrollToCurrent(
  virtualizerRef: React.MutableRefObject<Virtualizer<
    HTMLDivElement,
    Element
  > | null>,
  currentIndex: number,
  queueLength: number,
) {
  useEffect(() => {
    if (currentIndex < 0 || currentIndex >= queueLength) return undefined;
    // One-frame defer so the virtualizer has measured rows for the
    // freshly-mounted queue before we ask it to scroll.
    const id = requestAnimationFrame(() => {
      virtualizerRef.current?.scrollToIndex(currentIndex, { align: 'center' });
    });
    return () => cancelAnimationFrame(id);
    // Intentionally only runs on first paint per (currentIndex, queueLength)
    // change — enough to land on the right row when navigating into the view
    // but not so aggressive that it yanks the user back if they scroll away.
  }, [virtualizerRef, currentIndex, queueLength]);
}

export default function PlaybackQueue() {
  const drawerOpen = useUIStore((state) => state.sidebarOpen);
  const onDrawerToggle = useUIStore((state) => state.toggleSidebar);

  const queueTrackIds = useSettingsAndPlaybackStore(
    (state) => state.queueTrackIds,
  );
  const queueCurrentIndex = useSettingsAndPlaybackStore(
    (state) => state.queueCurrentIndex,
  );
  const currentTrack = useSettingsAndPlaybackStore(
    (state) => state.currentTrack,
  );
  const playbackSource = useSettingsAndPlaybackStore(
    (state) => state.playbackSource,
  );
  const jumpToQueueIndex = useSettingsAndPlaybackStore(
    (state) => state.jumpToQueueIndex,
  );
  const removeFromQueue = useSettingsAndPlaybackStore(
    (state) => state.removeFromQueue,
  );

  const columnVisibility = useSettingsAndPlaybackStore(
    (state) => state.columns,
  );
  const updateColumnVisibility = useSettingsAndPlaybackStore(
    (state) => state.setColumnVisibility,
  );
  const columnWidths = useSettingsAndPlaybackStore(
    (state) => state.columnWidths,
  );
  const setColumnWidths = useSettingsAndPlaybackStore(
    (state) => state.setColumnWidths,
  );
  const columnOrder = useSettingsAndPlaybackStore((state) => state.columnOrder);
  const setColumnOrder = useSettingsAndPlaybackStore(
    (state) => state.setColumnOrder,
  );

  // Track index map for getTrackById lookups. The libraryStore's
  // trackIndex is a Map<string, Track> so this is O(1) per row.
  const tracks = useLibraryStore((state) => state.tracks);

  const tableRef = useRef<Table<TableData> | null>(null);
  const rowVirtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(
    null,
  );

  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    queueIndex: number;
  } | null>(null);

  // Map queue track IDs into the TableData shape via libraryStore's
  // O(1) trackIndex. Tracks that no longer exist in the library are
  // dropped defensively — syncQueueWithLibrary should have pruned them,
  // but the `tracks` dep below keeps the cache honest after a refresh
  // (rename, delete) even when queueTrackIds didn't change. The lint
  // rule sees `tracks` as unused inside the body (we read via
  // getState().getTrackById to dodge a closure capture of a stale list),
  // hence the disable.
  const data = useMemo<TableData[]>(
    () =>
      queueTrackIds
        .map((id) => useLibraryStore.getState().getTrackById(id))
        .filter((t): t is NonNullable<typeof t> => !!t)
        .map((t) => ({
          id: t.id || '',
          title: t.title || 'Unknown Title',
          artist: t.artist || 'Unknown Artist',
          album: t.album || 'Unknown Album',
          genre: t.genre || 'Unknown Genre',
          duration: t.duration || 0,
          playCount: typeof t.playCount === 'number' ? t.playCount : 0,
          dateAdded: t.dateAdded,
          lastPlayed: t.lastPlayed || undefined,
          albumArtist: t.albumArtist || 'Unknown Album Artist',
          trackNumber: t.trackNumber || null,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [queueTrackIds, tracks],
  );

  // useMemo: stable identity for tanstack's internal row-model memoization
  // and avoids re-allocating column defs each render. Empty deps = once.
  const columns = useMemo(() => getCommonColumnDefs(), []);

  useScrollToCurrent(
    rowVirtualizerRef,
    queueCurrentIndex,
    queueTrackIds.length,
  );

  const handleRowDoubleClick = useCallback(
    (_row: Row<TableData>, index: number) => {
      jumpToQueueIndex(index);
    },
    [jumpToQueueIndex],
  );

  const handleRowContextMenu = useCallback(
    (_row: Row<TableData>, index: number, e: React.MouseEvent) => {
      e.preventDefault();
      setContextMenu({
        mouseX: e.clientX,
        mouseY: e.clientY,
        queueIndex: index,
      });
    },
    [],
  );

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRemoveFromQueue = useCallback(() => {
    if (!contextMenu) return;
    removeFromQueue(contextMenu.queueIndex);
    setContextMenu(null);
  }, [contextMenu, removeFromQueue]);

  // Single-click selects nothing here — queue rows are not selectable;
  // the only meaningful interaction is double-click (jump) and right-
  // click (remove). VirtualTable still requires the prop, so we no-op.
  const handleRowClick = useCallback(() => {}, []);

  const handleGetRowClassName = useCallback(
    (row: Row<TableData>, index: number) => {
      const base = getRowClassName(
        row.original.id,
        currentTrack?.id || undefined,
        undefined,
        playbackSource || '',
        playbackSource || '',
        undefined,
        undefined,
        index,
      );
      // Tracks before the current pointer are history. Add a class so
      // CSS can dim them; doesn't affect the playing/selected highlights.
      if (index < queueCurrentIndex) return `${base} vt-row-queue-past`;
      return base;
    },
    [currentTrack, playbackSource, queueCurrentIndex],
  );

  const handleColumnVisibilityToggle = useCallback(
    (columnId: string, visible: boolean) => {
      updateColumnVisibility(columnId, visible);
    },
    [updateColumnVisibility],
  );

  const handleColumnSizingPersist = useCallback(
    (sizing: Record<string, number>) => {
      setColumnWidths(sizing);
    },
    [setColumnWidths],
  );

  const handleColumnOrderChange = useCallback(
    (newOrder: string[]) => {
      setColumnOrder(newOrder);
    },
    [setColumnOrder],
  );

  // Sorting prop is required by VirtualTable but disabled here — the
  // queue's order is not the user's to rearrange via column sorts.
  // Header clicks still trigger this; we ignore them. (A nice-to-have
  // follow-up would suppress the cursor: pointer on headers in this view.)
  const handleSortingChange = useCallback(() => {}, []);

  const toolbarContent = useMemo(
    () => (
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          flexShrink: 0,
          gap: 1,
          height: '32px',
          pl: '0',
          width: '100%',
        }}
      >
        <SidebarToggle isOpen={drawerOpen} onToggle={onDrawerToggle} />
        {!drawerOpen && (
          <Typography
            sx={{
              flexShrink: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              userSelect: 'none',
              whiteSpace: 'nowrap',
            }}
            variant="h2"
          >
            Playback Queue
          </Typography>
        )}
        <Box
          sx={{
            alignItems: 'center',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? theme.palette.grey[800]
                : theme.palette.grey[200],
            borderRadius: '8px',
            display: 'inline-flex',
            flexShrink: 0,
            height: 22,
            justifyContent: 'center',
            px: 1.5,
            userSelect: 'none',
          }}
        >
          <Typography
            sx={{
              color: (theme) => theme.palette.text.secondary,
              fontSize: '13px',
              lineHeight: 1,
            }}
            variant="body2"
          >
            {data.length.toLocaleString()}&nbsp;
          </Typography>
          <Box
            component="span"
            sx={{
              color: (theme) => theme.palette.text.secondary,
              display: 'inline-flex',
            }}
          >
            <QueueMusicIcon sx={{ fontSize: 14 }} />
          </Box>
        </Box>
        <Box sx={{ flexGrow: 1 }} />
        <Box
          sx={{
            alignItems: 'center',
            display: 'flex',
            flexShrink: 0,
            gap: '6px',
          }}
        >
          <NotificationButton />
        </Box>
      </Box>
    ),
    [drawerOpen, onDrawerToggle, data.length],
  );

  const emptyStateContent = useMemo(
    () => (
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          height: '50vh',
          justifyContent: 'center',
          padding: 4,
          width: drawerOpen ? `calc(100vw - 240px)` : '100vw',
        }}
      >
        <Typography
          sx={{ color: 'text.secondary', fontWeight: 'medium', mb: 1 }}
          variant="h6"
        >
          Nothing playing
        </Typography>
        <Typography
          sx={{
            color: 'text.secondary',
            maxWidth: '400px',
            textAlign: 'center',
          }}
          variant="body2"
        >
          Pick a track from your Library or a playlist to start the queue.
        </Typography>
      </Box>
    ),
    [drawerOpen],
  );

  // Right-click context-menu only offers "Remove from Queue" today.
  // The current track gets a tooltip-suppressed disabled state — removing
  // it would skip-forward, which the user can do with the player's Next
  // button anyway and likely didn't mean by right-clicking.
  const isRemovalDisabled = contextMenu?.queueIndex === queueCurrentIndex;

  return (
    <Box
      sx={{
        backgroundColor: (theme) => theme.palette.background.default,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        margin: 0,
        overflow: 'hidden',
        padding: 0,
        width: '100%',
      }}
    >
      <Box
        sx={{
          backgroundColor: (theme) => theme.palette.background.default,
          display: 'flex',
          flexDirection: 'column',
          flexGrow: 1,
          height: '100%',
          margin: 0,
          padding: 0,
          width: '100%',
        }}
      >
        <VirtualTable
          columnOrder={columnOrder || undefined}
          columns={columns}
          columnVisibility={
            (columnVisibility as unknown as Record<string, boolean>) || {}
          }
          data={data}
          emptyState={emptyStateContent}
          getRowClassName={handleGetRowClassName}
          globalFilter=""
          initialColumnSizing={columnWidths || {}}
          onColumnOrderChange={handleColumnOrderChange}
          onColumnSizingPersist={handleColumnSizingPersist}
          onColumnVisibilityChange={handleColumnVisibilityToggle}
          onRowClick={handleRowClick}
          onRowContextMenu={handleRowContextMenu}
          onRowDoubleClick={handleRowDoubleClick}
          onSortingChange={handleSortingChange}
          sorting={NO_SORTING}
          tableRef={tableRef}
          toolbar={toolbarContent}
          virtualizerRef={rowVirtualizerRef}
        />
      </Box>

      <Menu
        anchorPosition={
          contextMenu !== null
            ? { left: contextMenu.mouseX, top: contextMenu.mouseY }
            : undefined
        }
        anchorReference="anchorPosition"
        onClose={handleCloseContextMenu}
        open={contextMenu !== null}
      >
        <Tooltip
          placement="right"
          title={
            isRemovalDisabled ? 'Currently playing — use Next instead' : ''
          }
        >
          <span>
            <MenuItem
              data-testid="queue-remove-track"
              disabled={isRemovalDisabled}
              onClick={handleRemoveFromQueue}
            >
              <ListItemIcon>
                <DeleteIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Remove from Queue</ListItemText>
            </MenuItem>
          </span>
        </Tooltip>
      </Menu>
    </Box>
  );
}
