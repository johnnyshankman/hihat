import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useCallback,
} from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Tooltip,
} from '@mui/material';
import { keyframes } from '@mui/system';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
import { type SortingState, type Row, type Table } from '@tanstack/react-table';
import { type Virtualizer } from '@tanstack/react-virtual';
import type { Track } from '../../types/dbTypes';
import {
  useLibraryStore,
  useSettingsAndPlaybackStore,
  useUIStore,
} from '../stores';
import {
  useTracks,
  useDeleteTrack,
  useUpdatePlaylist,
  useDeleteFile,
  getPlaylistsSnapshot,
} from '../queries';
import TrackContextMenu from './TrackContextMenu';
import MultiSelectContextMenu from './MultiSelectContextMenu';
import PlaylistSelectionDialog from './PlaylistSelectionDialog';
import EditMetadataDialog from './EditMetadataDialog';
import ConfirmationDialog from './ConfirmationDialog';
import SidebarToggle from './SidebarToggle';
import Browser from './Browser';
import SearchBar from './SearchBar';
import VirtualTable from './VirtualTable';
import NotificationButton from './NotificationButton';
import MaterialSymbolIcon from './MaterialSymbolIcon';
import {
  getRowClassName,
  getCommonColumnDefs,
  type TableData,
} from '../utils/tableConfig';
import { getFilteredAndSortedTrackIds } from '../utils/trackSelectionUtils';
import { calculateTotalHours } from '../utils/formatters';

const searchExpandAnimation = keyframes`
  from {
    max-width: 0;
    opacity: 0;
  }
  to {
    max-width: 600px;
    opacity: 1;
  }
`;

// Stable module-level default so the `librarySorting` selector fallback
// returns the same reference every render, preventing spurious re-renders
// from Zustand equality checks when no persisted sorting exists yet.
const DEFAULT_LIBRARY_SORTING: SortingState = [
  { id: 'albumArtist', desc: false },
];

// Stable empty array used as the fallback for `useTracks().data?.tracks`.
// Module-level constant so a missing cache doesn't allocate a new []
// every render, which would bust downstream useMemo dependencies.
const EMPTY_TRACKS: Track[] = [];

export default function Library() {
  // Subscribe directly so the parent doesn't need a drawer prop.
  const drawerOpen = useUIStore((state) => state.sidebarOpen);
  const onDrawerToggle = useUIStore((state) => state.toggleSidebar);

  // Server state (tracks) lives in TanStack Query; libraryStore keeps
  // only UI/view state. The error path doesn't need to render inline
  // here — MainLayout already toasts the failure for both queries; the
  // empty array fallback below renders the empty-state CTA.
  const { data: tracksData } = useTracks();
  const tracks = tracksData?.tracks ?? EMPTY_TRACKS;
  const getTrackById = (id: string | null | undefined) =>
    id ? tracksData?.indexes.trackIndex.get(id) : undefined;
  // Mutation hooks for the bulk-delete flow at the bottom of this file.
  // isPending isn't currently surfaced to a button (the bulk delete is
  // a confirm-then-execute flow), but the error path shows toasts via
  // the mutation's onError.
  const deleteTrackMutation = useDeleteTrack();
  const updatePlaylistMutation = useUpdatePlaylist();
  const deleteFileMutation = useDeleteFile();
  const lastViewedTrackId = useLibraryStore((state) => state.lastViewedTrackId);
  const setLastViewedTrackId = useLibraryStore(
    (state) => state.setLastViewedTrackId,
  );
  // Library's global filter lives in the libraryStore keyed by view ID.
  // Reading it directly here means the store is the single source of truth
  // — no local mirror, no ref, no manual fan-out on change.
  const globalFilter = useLibraryStore(
    (state) => state.searchFilters.library ?? '',
  );
  // Get state from settings store
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
  const setLibrarySorting = useSettingsAndPlaybackStore(
    (state) => state.setLibrarySorting,
  );
  // Sort preference lives in settingsAndPlaybackStore and is persisted to
  // DB. setLibrarySorting internally fans out to libraryViewState, so the
  // component just reads and writes this one value.
  const sorting = useSettingsAndPlaybackStore(
    (state) => state.librarySorting ?? DEFAULT_LIBRARY_SORTING,
  );
  const columnOrder = useSettingsAndPlaybackStore((state) => state.columnOrder);
  const setColumnOrder = useSettingsAndPlaybackStore(
    (state) => state.setColumnOrder,
  );

  // Get state from playback store
  const currentTrack = useSettingsAndPlaybackStore(
    (state) => state.currentTrack,
  );
  const playbackSource = useSettingsAndPlaybackStore(
    (state) => state.playbackSource,
  );
  const playTrack = useSettingsAndPlaybackStore(
    (state) => state.selectSpecificSong,
  );

  // Ref to store the table instance for scrollToTrack
  const tableRef = useRef<Table<TableData> | null>(null);

  // Ref to track if the table is ready for scrolling (fully rendered with correct sorting)
  const tableReadyRef = useRef<boolean>(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [scanConfirmOpen, setScanConfirmOpen] = useState(false);
  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [editMetadataTrackId, setEditMetadataTrackId] = useState<string | null>(
    null,
  );
  const [selectedTracks, setSelectedTracks] = useState<Record<string, boolean>>(
    {},
  );
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [multiSelectPlaylistDialogOpen, setMultiSelectPlaylistDialogOpen] =
    useState(false);
  const browserFilters = useLibraryStore((state) => state.browserFilters);
  const setBrowserFilter = useLibraryStore((state) => state.setBrowserFilter);
  const setSearchFilter = useLibraryStore((state) => state.setSearchFilter);
  const browserOpen = useUIStore((state) => state.browserOpen);
  const setBrowserOpen = useUIStore((state) => state.setBrowserOpen);
  const showNotification = useUIStore((state) => state.showNotification);
  const setSettingsOpen = useUIStore((state) => state.setSettingsOpen);
  const [showSearch, setShowSearch] = useState(
    () => !!useLibraryStore.getState().searchFilters.library,
  );
  const [browserHeight, setBrowserHeight] = useState(200);

  // Derive artist/album filter scalars directly from the browser filter
  // dictionary. No useMemo: each value is a primitive, and the consumers
  // below only need the scalar values or construct their own object.
  const artistFilter = browserFilters.library?.artist ?? null;
  const albumFilter = browserFilters.library?.album ?? null;

  const handleArtistSelect = useCallback(
    (artist: string | null) => {
      setBrowserFilter('library', { artist, album: null });
    },
    [setBrowserFilter],
  );

  const handleAlbumSelect = useCallback(
    (album: string | null) => {
      setBrowserFilter('library', { artist: artistFilter, album });
    },
    [setBrowserFilter, artistFilter],
  );

  // Add row virtualizer ref
  const rowVirtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(
    null,
  );

  const handlePlayTrack = (trackId: string) => {
    playTrack(trackId, 'library');
  };

  const handleSelectFolder = async () => {
    try {
      const result = await window.electron.dialog.selectDirectory();
      if ('error' in result) {
        showNotification(result.error, 'error');
        return;
      }
      if (result.canceled || result.filePaths.length === 0) {
        return;
      }

      const libraryPath = result.filePaths[0];

      // Save the library path to settings (partial-merge — Phase 5b).
      await window.electron.settings.update({ libraryPath });

      // Close the dialog
      setDialogOpen(false);

      // Ask the user if they want to scan the library now
      setScanConfirmOpen(true);
    } catch (error) {
      console.error('Error selecting folder:', error);
      showNotification('Failed to select folder', 'error');
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
  };

  const handleContextMenu = (event: React.MouseEvent, trackId: string) => {
    event.preventDefault();
    setContextMenu({
      mouseX: event.clientX,
      mouseY: event.clientY,
    });
    setSelectedTrackId(trackId);
  };

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleAddToPlaylist = () => {
    setPlaylistDialogOpen(true);
  };

  const handleEditMetadata = (trackId: string) => {
    setEditMetadataTrackId(trackId);
  };

  const handleClosePlaylistDialog = () => {
    setPlaylistDialogOpen(false);
  };

  // Multi-select handlers
  const handleMultiSelectAddToPlaylist = () => {
    setMultiSelectPlaylistDialogOpen(true);
  };

  const handleCloseMultiSelectPlaylistDialog = () => {
    setMultiSelectPlaylistDialogOpen(false);
  };

  // Scroll to a specific track by ID. Stable across renders — refs are
  // stable containers, and the fallback path reads browser filters from
  // the store at call time rather than closing over reactive values.
  const scrollToTrack = useCallback((trackId: string) => {
    if (!rowVirtualizerRef.current) return;

    let trackIndex = -1;
    if (tableRef.current) {
      const { rows } = tableRef.current.getRowModel();
      trackIndex = rows.findIndex((row) => row.original.id === trackId);
    }

    // Fallback: if tanstack's row model isn't populated yet, compute
    // the index from the store directly.
    if (trackIndex === -1) {
      const libState = useLibraryStore.getState();
      const af = libState.browserFilters.library?.artist ?? null;
      const alf = libState.browserFilters.library?.album ?? null;
      const trackIds = getFilteredAndSortedTrackIds('library', af, alf);
      trackIndex = trackIds.indexOf(trackId);
    }

    if (trackIndex !== -1) {
      rowVirtualizerRef.current.scrollToIndex(trackIndex, { align: 'center' });
    }
  }, []);

  // Function that waits for the table to be ready before scrolling
  const scrollToTrackWhenReady = useCallback(
    (trackId: string, maxWaitMs: number = 2000) => {
      const startTime = Date.now();
      const pollInterval = 50;
      const minWaitMs = 150;

      const attemptScroll = () => {
        const elapsedMs = Date.now() - startTime;

        const isReady =
          tableReadyRef.current &&
          tableRef.current &&
          tableRef.current.getRowModel().rows.length > 0;

        if (isReady && elapsedMs >= minWaitMs) {
          scrollToTrack(trackId);
          return;
        }

        if (elapsedMs >= maxWaitMs) {
          scrollToTrack(trackId);
          return;
        }

        setTimeout(attemptScroll, pollInterval);
      };

      attemptScroll();
    },
    [scrollToTrack],
  );

  // Writes filter to the store (which fan-outs internally) and snaps
  // scroll to the playing track when clearing a non-empty filter. Reads
  // store state fresh per call so the callback's identity stays stable —
  // SearchBar's debounce subscription won't re-fire.
  const handleDebouncedSearchChange = useCallback(
    (value: string) => {
      const libState = useLibraryStore.getState();
      const prev = libState.searchFilters.library ?? '';
      setSearchFilter('library', value);

      if (!prev || value) return;

      const playState = useSettingsAndPlaybackStore.getState();
      if (!playState.currentTrack || playState.playbackSource !== 'library')
        return;

      const af = libState.browserFilters.library?.artist ?? null;
      const alf = libState.browserFilters.library?.album ?? null;
      const visibleTrackIds = getFilteredAndSortedTrackIds('library', af, alf);
      if (!visibleTrackIds.includes(playState.currentTrack.id)) return;

      // Defer one frame so the table re-renders without the filter
      // before we ask the virtualizer to scroll.
      setTimeout(() => {
        const ct = useSettingsAndPlaybackStore.getState().currentTrack;
        if (ct) scrollToTrack(ct.id);
      }, 100);
    },
    [setSearchFilter, scrollToTrack],
  );

  // Resolve Tanstack's updater-or-value to a plain value for
  // setLibrarySorting (fan-outs to state + viewState + DB). No
  // useCallback — VirtualTable isn't memoized.
  const handleSortingChange = (
    updater: SortingState | ((old: SortingState) => SortingState),
  ) => {
    const current =
      useSettingsAndPlaybackStore.getState().librarySorting ??
      DEFAULT_LIBRARY_SORTING;
    const next = typeof updater === 'function' ? updater(current) : updater;
    setLibrarySorting(next);
  };

  // Expose the scrollToTrack function to the window object
  useEffect(() => {
    window.hihatScrollToLibraryTrack = scrollToTrackWhenReady;

    return () => {
      delete window.hihatScrollToLibraryTrack;
    };
  }, [scrollToTrackWhenReady]);

  const handleMultiSelectDeleteTracks = async () => {
    const selectedTrackIds = Object.keys(selectedTracks);
    if (selectedTrackIds.length === 0) return;

    setBulkDeleteConfirmOpen(true);
  };

  const executeMultiSelectDeleteTracks = async () => {
    setBulkDeleteConfirmOpen(false);
    const selectedTrackIds = Object.keys(selectedTracks);
    if (selectedTrackIds.length === 0) return;

    try {
      const currentTrackIds = getFilteredAndSortedTrackIds(
        'library',
        artistFilter,
        albumFilter,
      );

      const deletedIndices = selectedTrackIds
        .map((trackId) => currentTrackIds.indexOf(trackId))
        .filter((index) => index !== -1)
        .sort((a, b) => a - b);

      let targetTrackId: string | null = null;
      if (deletedIndices.length > 0) {
        const highestDeletedIndex = deletedIndices[deletedIndices.length - 1];

        for (
          let i = highestDeletedIndex + 1;
          i < currentTrackIds.length;
          i += 1
        ) {
          const candidateTrackId = currentTrackIds[i];
          if (!selectedTrackIds.includes(candidateTrackId)) {
            targetTrackId = candidateTrackId;
            break;
          }
        }

        if (!targetTrackId && deletedIndices[0] > 0) {
          for (let i = deletedIndices[0] - 1; i >= 0; i -= 1) {
            const candidateTrackId = currentTrackIds[i];
            if (!selectedTrackIds.includes(candidateTrackId)) {
              targetTrackId = candidateTrackId;
              break;
            }
          }
        }
      }

      // Use the cached playlists snapshot — the playlists query is
      // already in the cache from MainLayout / Sidebar mounts.
      const allPlaylists = getPlaylistsSnapshot() ?? [];

      // eslint-disable-next-line no-restricted-syntax
      for (const trackId of selectedTrackIds) {
        const track = getTrackById(trackId);
        // eslint-disable-next-line no-continue
        if (!track) continue;

        const playlistsToUpdate = allPlaylists.filter(
          (playlist) =>
            !playlist.isSmart && playlist.trackIds.includes(trackId),
        );

        // eslint-disable-next-line no-await-in-loop
        await Promise.all(
          playlistsToUpdate.map((playlist) =>
            updatePlaylistMutation.mutateAsync({
              ...playlist,
              trackIds: playlist.trackIds.filter((id) => id !== trackId),
            }),
          ),
        );

        try {
          // eslint-disable-next-line no-await-in-loop
          await deleteTrackMutation.mutateAsync(trackId);
        } catch {
          showNotification(`Failed to delete track: ${track.title}`, 'error');
          // eslint-disable-next-line no-continue
          continue;
        }

        if (track.filePath) {
          // eslint-disable-next-line no-await-in-loop
          const fileDeleteResult = await deleteFileMutation.mutateAsync(
            track.filePath,
          );

          if (!fileDeleteResult.success) {
            showNotification(
              `Failed to delete file for: ${track.title}`,
              'warning',
            );
          }
        }
      }

      // Mutation hooks already invalidate tracks/playlists on success;
      // nothing else to do here.

      setSelectedTracks({});

      if (targetTrackId) {
        setTimeout(() => {
          scrollToTrack(targetTrackId);
        }, 300);
      }

      showNotification(
        `Successfully deleted ${selectedTrackIds.length} track${selectedTrackIds.length > 1 ? 's' : ''}`,
        'success',
      );
    } catch (error) {
      console.error('Error deleting tracks:', error);
      showNotification('Failed to delete tracks', 'error');
    }
  };

  // Save visible track on unmount. Read virtualizer + filters inside
  // the cleanup — the ref is null at mount, and the virtualizer's range
  // indexes browser-filtered rows, so a stale filter means we save the
  // wrong track.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const virt = rowVirtualizerRef.current;
      if (!virt) return;
      const visibleRange = virt.range;
      if (!visibleRange) return;
      const middleIndex = Math.floor(
        (visibleRange.startIndex + visibleRange.endIndex) / 2,
      );
      // Read browser filters fresh from the store at unmount time so
      // the lookup list matches what the virtualizer was rendering.
      const libState = useLibraryStore.getState();
      const af = libState.browserFilters.library?.artist ?? null;
      const alf = libState.browserFilters.library?.album ?? null;
      const trackIds = getFilteredAndSortedTrackIds('library', af, alf);
      if (trackIds[middleIndex]) {
        setLastViewedTrackId(trackIds[middleIndex]);
      }
    };
  }, [setLastViewedTrackId]);

  // Restore scroll on mount, exactly once. Without the guard this
  // re-fires on track reloads / filter changes and yanks the user back.
  // scrollToTrackWhenReady polls for readiness, so no timeout race.
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    if (scrollRestoredRef.current) return;
    if (!lastViewedTrackId || tracks.length === 0) return;
    scrollRestoredRef.current = true;
    scrollToTrackWhenReady(lastViewedTrackId);
  }, [lastViewedTrackId, tracks.length, scrollToTrackWhenReady]);

  // useMemo: stable identity for tanstack's internal row-model memoization
  // and avoids re-allocating column defs each render. Empty deps = once.
  const columns = useMemo(() => getCommonColumnDefs(), []);

  // useMemo: O(n) filter + map over potentially thousands of tracks.
  const data = useMemo<TableData[]>(() => {
    let filteredTracks = tracks;

    if (artistFilter) {
      filteredTracks = filteredTracks.filter((track) => {
        const artist = track.albumArtist || track.artist || 'Unknown Artist';
        return artist === artistFilter;
      });
    }

    if (albumFilter) {
      filteredTracks = filteredTracks.filter(
        (track) => (track.album || 'Unknown Album') === albumFilter,
      );
    }

    return filteredTracks.map((track) => {
      return {
        id: track.id || '',
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Unknown Album',
        genre: track.genre || 'Unknown Genre',
        duration: track.duration || 0,
        playCount: typeof track.playCount === 'number' ? track.playCount : 0,
        dateAdded: track.dateAdded,
        lastPlayed: track.lastPlayed || undefined,
        albumArtist: track.albumArtist || 'Unknown Album Artist',
        trackNumber: track.trackNumber || null,
      };
    });
  }, [tracks, artistFilter, albumFilter]);

  // useMemo: O(n) reduce over track durations.
  const totalHours = useMemo(() => calculateTotalHours(data), [data]);

  // Closing routes through handleDebouncedSearchChange so persistence
  // + scroll-on-clear both fire. Side effect lives outside setShowSearch
  // — StrictMode double-invokes state updaters and would discard it.
  const handleSearchToggle = useCallback(() => {
    if (showSearch) handleDebouncedSearchChange('');
    setShowSearch((prev) => !prev);
  }, [showSearch, handleDebouncedSearchChange]);

  // Mark table as ready after the next frame so the virtualizer has
  // measured rows for the new sorting/filter/data.
  useEffect(() => {
    tableReadyRef.current = false;
    const rafId = requestAnimationFrame(() => {
      tableReadyRef.current = true;
    });
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [sorting, globalFilter, data.length]);

  const handleRowClick = (
    row: Row<TableData>,
    index: number,
    e: React.MouseEvent,
  ) => {
    const trackId = row.original.id;

    setSelectedTracks((prev) => {
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        const newSelectedTracks = { ...prev };
        if (newSelectedTracks[trackId]) {
          delete newSelectedTracks[trackId];
        } else {
          newSelectedTracks[trackId] = true;
        }
        setLastClickedIndex(index);
        return newSelectedTracks;
      }

      if (e.shiftKey && !e.metaKey && !e.ctrlKey) {
        if (lastClickedIndex === null) {
          setLastClickedIndex(index);
          return { [trackId]: true };
        }

        const start = Math.min(lastClickedIndex, index);
        const end = Math.max(lastClickedIndex, index);

        const rangeSelection: Record<string, boolean> = {};

        if (tableRef.current) {
          const visibleRows = tableRef.current.getRowModel().rows;
          for (let i = start; i <= end; i += 1) {
            const rowData = visibleRows[i]?.original;
            if (rowData) {
              rangeSelection[rowData.id] = true;
            }
          }
        }

        return rangeSelection;
      }

      setLastClickedIndex(index);
      return { [trackId]: true };
    });
  };

  const handleRowDoubleClick = (row: Row<TableData>, _index: number) => {
    handlePlayTrack(row.original.id);
    setSelectedTracks({ [row.original.id]: true });
  };

  const handleRowContextMenu = (
    row: Row<TableData>,
    _index: number,
    e: React.MouseEvent,
  ) => {
    const trackId = row.original.id;

    if (selectedTracks[trackId]) {
      handleContextMenu(e, trackId);
    } else {
      setSelectedTracks({ [trackId]: true });
      handleContextMenu(e, trackId);
    }
  };

  const handleGetRowClassName = (row: Row<TableData>, index: number) => {
    return getRowClassName(
      row.original.id,
      currentTrack?.id || undefined,
      Object.keys(selectedTracks),
      playbackSource || '',
      'library',
      undefined,
      undefined,
      index,
    );
  };

  const handleColumnVisibilityToggle = (columnId: string, visible: boolean) => {
    updateColumnVisibility(columnId, visible);
  };

  const handleColumnSizingPersist = (sizing: Record<string, number>) => {
    setColumnWidths(sizing);
  };

  const handleColumnOrderChange = (newOrder: string[]) => {
    setColumnOrder(newOrder);
  };

  const handleRowDragStart = (
    trackId: string,
    selectedIds: string[],
  ): string[] => {
    if (selectedIds.includes(trackId)) {
      return selectedIds;
    }
    return [trackId];
  };

  // useMemo: deep JSX subtree. Stable element reference lets React skip
  // reconciliation of the toolbar when row clicks re-render the parent.
  const toolbarContent = useMemo(
    () => (
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'center',
          height: '32px',
          pl: '0',
          flexShrink: 0,
          width: '100%',
        }}
      >
        <SidebarToggle isOpen={drawerOpen} onToggle={onDrawerToggle} />
        {!drawerOpen && (
          <Typography
            sx={{
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              userSelect: 'none',
              flexShrink: 0,
            }}
            variant="h2"
          >
            Library
          </Typography>
        )}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: '8px',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? theme.palette.grey[800]
                : theme.palette.grey[200],
            px: 1.5,
            height: 22,
            justifyContent: 'center',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              color: (theme) => theme.palette.text.secondary,
              lineHeight: 1,
              fontSize: '13px',
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
            <MaterialSymbolIcon
              fontSize={16}
              icon="music_note_2"
              weight={100}
            />
          </Box>
        </Box>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: '8px',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? theme.palette.grey[800]
                : theme.palette.grey[200],
            px: 1.5,
            height: 22,
            justifyContent: 'center',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              color: (theme) => theme.palette.text.secondary,
              lineHeight: 1,
              fontSize: '13px',
            }}
            variant="body2"
          >
            {totalHours}&nbsp;
          </Typography>
          <AccessTimeIcon
            sx={{
              fontSize: 14,
              color: (theme) => theme.palette.text.secondary,
            }}
          />
        </Box>
        {showSearch && (
          <Box
            sx={{
              display: 'flex',
              flexGrow: 1,
              minWidth: 0,
              overflow: 'hidden',
              marginLeft: 'auto',
              animation: `${searchExpandAnimation} 120ms ease-out forwards`,
            }}
          >
            <SearchBar
              initialValue={globalFilter}
              onClose={handleSearchToggle}
              onDebouncedChange={handleDebouncedSearchChange}
            />
          </Box>
        )}
        <Box sx={{ flexGrow: showSearch ? 0 : 1 }} />
        <Box
          sx={{
            display: 'flex',
            gap: '6px',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <Tooltip title={showSearch ? 'Close search' : 'Search'}>
            <IconButton
              aria-label="Show/Hide search"
              onClick={handleSearchToggle}
              size="small"
              sx={{
                color: showSearch ? 'text.primary' : 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                },
                WebkitAppRegion: 'no-drag',
              }}
            >
              {showSearch ? (
                <SearchOffRoundedIcon sx={{ fontSize: 20 }} />
              ) : (
                <SearchRoundedIcon sx={{ fontSize: 20 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={browserOpen ? 'Hide Browser' : 'Show Browser'}>
            <IconButton
              aria-controls="browser-panel"
              aria-expanded={browserOpen}
              aria-label="Show/Hide browser"
              data-testid="browser-toggle"
              onClick={() => setBrowserOpen(!browserOpen)}
              size="small"
              sx={{
                color: browserOpen ? 'text.primary' : 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                },
                WebkitAppRegion: 'no-drag',
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  transform: browserOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <MaterialSymbolIcon fontSize="small" icon="top_panel_open" />
              </Box>
            </IconButton>
          </Tooltip>
          <NotificationButton />
        </Box>
      </Box>
    ),
    [
      drawerOpen,
      onDrawerToggle,
      data.length,
      totalHours,
      showSearch,
      handleSearchToggle,
      handleDebouncedSearchChange,
      globalFilter,
      browserOpen,
      setBrowserOpen,
    ],
  );

  // useMemo: stable element reference skips subtree reconciliation on
  // parent re-renders where drawerOpen hasn't changed.
  const emptyStateContent = useMemo(
    () => (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          height: '50vh',
          width: drawerOpen ? `calc(100vw - 240px)` : '100vw',
        }}
      >
        <Typography
          sx={{
            color: 'text.secondary',
            fontWeight: 'medium',
            mb: 1,
          }}
          variant="h6"
        >
          Your library is empty
        </Typography>
        <Typography
          sx={{
            color: 'text.secondary',
            textAlign: 'center',
            maxWidth: '400px',
          }}
          variant="body2"
        >
          Head to Settings and give hihat access to your music library folder.
        </Typography>
      </Box>
    ),
    [drawerOpen],
  );

  const handleBrowserClose = useCallback(
    () => setBrowserOpen(false),
    [setBrowserOpen],
  );

  // useMemo: wraps React.memo'd Browser. Stable element reference skips
  // its subtree on parent re-renders where deps haven't changed. Always
  // mounted so open/close can animate.
  const browserPanel = useMemo(() => {
    return (
      <Browser
        height={browserHeight}
        onAlbumSelect={handleAlbumSelect}
        onArtistSelect={handleArtistSelect}
        onClose={handleBrowserClose}
        onHeightChange={setBrowserHeight}
        open={browserOpen}
        selectedAlbum={albumFilter}
        selectedArtist={artistFilter}
        tracks={tracks}
      />
    );
  }, [
    browserOpen,
    browserHeight,
    handleAlbumSelect,
    handleArtistSelect,
    handleBrowserClose,
    albumFilter,
    artistFilter,
    tracks,
  ]);

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 0,
        margin: 0,
        backgroundColor: (theme) => theme.palette.background.default,
      }}
    >
      {/* Main content area */}
      <Box
        sx={{
          flexGrow: 1,
          height: '100%',
          width: '100%',
          padding: 0,
          margin: 0,
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: (theme) => theme.palette.background.default,
        }}
      >
        <VirtualTable
          browserPanel={browserPanel}
          columnOrder={columnOrder || undefined}
          columns={columns}
          columnVisibility={
            (columnVisibility as unknown as Record<string, boolean>) || {}
          }
          data={data}
          emptyState={emptyStateContent}
          getRowClassName={handleGetRowClassName}
          globalFilter={globalFilter}
          initialColumnSizing={columnWidths || {}}
          onColumnOrderChange={handleColumnOrderChange}
          onColumnSizingPersist={handleColumnSizingPersist}
          onColumnVisibilityChange={handleColumnVisibilityToggle}
          onRowClick={handleRowClick}
          onRowContextMenu={handleRowContextMenu}
          onRowDoubleClick={handleRowDoubleClick}
          onRowDragStart={handleRowDragStart}
          onSortingChange={handleSortingChange}
          selectedTrackIds={Object.keys(selectedTracks)}
          sorting={sorting}
          tableRef={tableRef}
          toolbar={toolbarContent}
          virtualizerRef={rowVirtualizerRef}
        />
      </Box>

      {/* Library path selection dialog */}
      <Dialog onClose={handleCloseDialog} open={dialogOpen}>
        <DialogTitle>Set Library Path</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            Please select your music library folder:
          </Typography>
          <Button onClick={handleSelectFolder} variant="contained">
            Select Folder
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Playlist selection dialog */}
      {selectedTrackId && (
        <PlaylistSelectionDialog
          onClose={handleClosePlaylistDialog}
          open={playlistDialogOpen}
          trackId={selectedTrackId}
        />
      )}

      {/* Edit Metadata dialog */}
      <EditMetadataDialog
        onClose={() => setEditMetadataTrackId(null)}
        open={editMetadataTrackId !== null}
        trackId={editMetadataTrackId}
      />

      {/* Context menu - show multi-select menu if multiple tracks selected */}
      {Object.keys(selectedTracks).length > 1 ? (
        <MultiSelectContextMenu
          anchorPosition={
            contextMenu !== null
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : null
          }
          onAddToPlaylist={handleMultiSelectAddToPlaylist}
          onClose={handleCloseContextMenu}
          onDeleteTracks={handleMultiSelectDeleteTracks}
          open={contextMenu !== null}
          selectedCount={Object.keys(selectedTracks).length}
        />
      ) : (
        <TrackContextMenu
          anchorPosition={
            contextMenu !== null
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : null
          }
          onAddToPlaylist={handleAddToPlaylist}
          onClose={handleCloseContextMenu}
          onEditMetadata={handleEditMetadata}
          open={contextMenu !== null}
          trackId={selectedTrackId}
        />
      )}

      {/* Multi-select playlist selection dialog */}
      {multiSelectPlaylistDialogOpen && (
        <PlaylistSelectionDialog
          onClose={handleCloseMultiSelectPlaylistDialog}
          open={multiSelectPlaylistDialogOpen}
          trackIds={Object.keys(selectedTracks)}
        />
      )}

      {/* Scan confirmation dialog */}
      <ConfirmationDialog
        cancelText="Later"
        confirmButtonColor="primary"
        confirmText="Open Settings"
        message="Library path has been set. Would you like to go to Settings to scan your library now?"
        onCancel={() => setScanConfirmOpen(false)}
        onConfirm={() => {
          setScanConfirmOpen(false);
          setSettingsOpen(true);
        }}
        open={scanConfirmOpen}
        title="Scan Library"
      />

      {/* Bulk delete confirmation dialog */}
      <ConfirmationDialog
        cancelText="Cancel"
        confirmButtonColor="error"
        confirmText="Delete"
        message={`Are you sure you want to delete ${Object.keys(selectedTracks).length} track${Object.keys(selectedTracks).length > 1 ? 's' : ''}? This will remove the track from hihat and move the file to your Trash. You can always add it back from there later.`}
        onCancel={() => setBulkDeleteConfirmOpen(false)}
        onConfirm={executeMultiSelectDeleteTracks}
        open={bulkDeleteConfirmOpen}
        title="Delete Tracks"
      />
    </Box>
  );
}
