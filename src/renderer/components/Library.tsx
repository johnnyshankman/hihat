import React, {
  useState,
  useMemo,
  useRef,
  useEffect,
  useLayoutEffect,
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
import {
  useLibraryStore,
  useSettingsAndPlaybackStore,
  useUIStore,
} from '../stores';
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

// Define the type for directory selection result
interface DirectorySelectionResult {
  canceled: boolean;
  filePaths: string[];
}

// Define props interface for Library component
interface LibraryProps {
  drawerOpen: boolean;
  onDrawerToggle: () => void;
}

function Library({ drawerOpen, onDrawerToggle }: LibraryProps) {
  // Get state from library store
  const tracks = useLibraryStore((state) => state.tracks);
  const getTrackById = useLibraryStore((state) => state.getTrackById);
  const updateLibraryViewState = useLibraryStore(
    (state) => state.updateLibraryViewState,
  );
  const lastViewedTrackId = useLibraryStore((state) => state.lastViewedTrackId);
  const setLastViewedTrackId = useLibraryStore(
    (state) => state.setLastViewedTrackId,
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
  const getSearchFilter = useLibraryStore((state) => state.getSearchFilter);
  const browserOpen = useUIStore((state) => state.browserOpen);
  const setBrowserOpen = useUIStore((state) => state.setBrowserOpen);
  const [showSearch, setShowSearch] = useState(() =>
    Boolean(getSearchFilter('library')),
  );
  const [browserHeight, setBrowserHeight] = useState(200);

  // Derive artist/album filter from browser filters
  const libraryBrowserFilter = useMemo(
    () => browserFilters.library || { artist: null, album: null },
    [browserFilters],
  );
  const artistFilter = libraryBrowserFilter.artist;
  const albumFilter = libraryBrowserFilter.album;

  const handleArtistSelect = useCallback(
    (artist: string | null) => {
      setBrowserFilter('library', { artist, album: null });
    },
    [setBrowserFilter],
  );

  const handleAlbumSelect = useCallback(
    (album: string | null) => {
      setBrowserFilter('library', { ...libraryBrowserFilter, album });
    },
    [setBrowserFilter, libraryBrowserFilter],
  );

  // Global filter state — receives debounced values from SearchBar.
  const [globalFilter, setGlobalFilter] = useState(() =>
    getSearchFilter('library'),
  );
  const globalFilterRef = useRef(globalFilter);

  // Sorting state - initialize from store to persist across unmount/remount.
  // Read via getState() at init time only: we don't want to subscribe to
  // libraryViewState because we write to it on every sort/search change,
  // which would re-render this component for data it no longer reads.
  const [sorting, setSorting] = useState<SortingState>(() => {
    const stored = useLibraryStore.getState().libraryViewState.sorting;
    return stored || [{ id: 'albumArtist', desc: false }];
  });

  // Add row virtualizer ref
  const rowVirtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(
    null,
  );

  const handlePlayTrack = (trackId: string) => {
    playTrack(trackId, 'library');
  };

  const handleSelectFolder = async () => {
    try {
      const result =
        (await window.electron.dialog.selectDirectory()) as DirectorySelectionResult;
      if (
        result.canceled ||
        !result.filePaths ||
        result.filePaths.length === 0
      ) {
        return;
      }

      const libraryPath = result.filePaths[0];

      // Save the library path to settings
      const localSettings = await window.electron.settings.get();
      await window.electron.settings.update({
        ...localSettings,
        libraryPath,
      });

      // Close the dialog
      setDialogOpen(false);

      // Ask the user if they want to scan the library now
      setScanConfirmOpen(true);
    } catch (error) {
      console.error('Error selecting folder:', error);
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

  // Function to scroll to a specific track by ID
  const scrollToTrack = useCallback(
    (trackId: string) => {
      if (!rowVirtualizerRef.current) return;

      // Use the table's actual row model to find the track index
      let trackIndex = -1;

      if (tableRef.current) {
        const { rows } = tableRef.current.getRowModel();
        trackIndex = rows.findIndex((row) => row.original.id === trackId);
      }

      // Fallback to calculating the index if table isn't ready yet
      if (trackIndex === -1) {
        const trackIds = getFilteredAndSortedTrackIds(
          'library',
          artistFilter,
          albumFilter,
        );
        trackIndex = trackIds.indexOf(trackId);
      }

      if (trackIndex !== -1) {
        rowVirtualizerRef.current.scrollToIndex(trackIndex, {
          align: 'center',
        });
      }
    },
    [artistFilter, albumFilter],
  );

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

  // Latest reactive values held in a ref so handlers below can read fresh
  // state without becoming reactive themselves (keeps callback identity
  // stable for SearchBar, which subscribes via useEffect on the callback).
  // Also lets handleSortingChange compute the next sorting outside of a
  // state updater (state updaters must stay pure — they're double-invoked
  // in StrictMode / Concurrent rendering).
  const latestRef = useRef({
    sorting,
    artistFilter,
    albumFilter,
    currentTrack,
    playbackSource,
    scrollToTrack,
  });
  latestRef.current.sorting = sorting;
  latestRef.current.artistFilter = artistFilter;
  latestRef.current.albumFilter = albumFilter;
  latestRef.current.currentTrack = currentTrack;
  latestRef.current.playbackSource = playbackSource;
  latestRef.current.scrollToTrack = scrollToTrack;

  // Single source of truth for changing the global filter: updates local
  // state, persists to store, and snaps to the current track when the user
  // clears a non-empty filter. Called from both SearchBar (debounced typing)
  // and handleSearchToggle (close-button clear).
  const applyGlobalFilter = useCallback(
    (value: string) => {
      const prev = globalFilterRef.current;
      setGlobalFilter(value);
      globalFilterRef.current = value;

      const latest = latestRef.current;
      updateLibraryViewState(latest.sorting, value);
      setSearchFilter('library', value);

      if (
        prev &&
        !value &&
        latest.currentTrack &&
        latest.playbackSource === 'library'
      ) {
        const visibleTrackIds = getFilteredAndSortedTrackIds(
          'library',
          latest.artistFilter,
          latest.albumFilter,
        );
        if (visibleTrackIds.includes(latest.currentTrack.id)) {
          // Defer one frame so the table re-renders without the filter
          // before we ask the virtualizer to scroll.
          setTimeout(() => {
            const ct = latestRef.current.currentTrack;
            if (ct) latestRef.current.scrollToTrack(ct.id);
          }, 100);
        }
      }
    },
    [updateLibraryViewState, setSearchFilter],
  );

  const handleDebouncedSearchChange = applyGlobalFilter;

  // Wrap the sorting setter so persistence happens at the event source
  // instead of in a downstream effect. Compute `next` outside setSorting
  // so the updater stays pure — React may call updater functions more
  // than once and will discard the side effects of trial renders.
  const handleSortingChange = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const next =
        typeof updater === 'function'
          ? (updater as (old: SortingState) => SortingState)(
              latestRef.current.sorting,
            )
          : updater;
      setSorting(next);
      updateLibraryViewState(next, globalFilterRef.current);
      if (next.length > 0) {
        setLibrarySorting(next);
      }
    },
    [updateLibraryViewState, setLibrarySorting],
  );

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
      const { showNotification } = useUIStore.getState();

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

      const allPlaylists = await window.electron.playlists.getAll();

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
          playlistsToUpdate.map((playlist) => {
            const updatedPlaylist = {
              ...playlist,
              trackIds: playlist.trackIds.filter((id) => id !== trackId),
            };
            return window.electron.playlists.update(updatedPlaylist);
          }),
        );

        // eslint-disable-next-line no-await-in-loop
        const dbDeleteResult = await window.electron.tracks.delete(trackId);

        if (!dbDeleteResult) {
          showNotification(`Failed to delete track: ${track.title}`, 'error');
          // eslint-disable-next-line no-continue
          continue;
        }

        if (track.filePath) {
          // eslint-disable-next-line no-await-in-loop
          const fileDeleteResult = await window.electron.fileSystem.deleteFile(
            track.filePath,
          );

          if (!fileDeleteResult) {
            showNotification(
              `Failed to delete file for: ${track.title}`,
              'warning',
            );
          }
        }
      }

      await useLibraryStore.getState().loadLibrary(false);

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
      const { showNotification } = useUIStore.getState();
      showNotification('Failed to delete tracks', 'error');
    }
  };

  // Save the currently visible track on unmount. Read the virtualizer
  // through the ref *inside* the cleanup so we see its real value at
  // unmount time, not the (typically null) value at first mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const trackIds = getFilteredAndSortedTrackIds('library');
      if (trackIds[middleIndex]) {
        setLastViewedTrackId(trackIds[middleIndex]);
      }
    };
  }, [setLastViewedTrackId]);

  // Restore scroll position on mount, exactly once. Without the guard this
  // re-fires whenever tracks reload or the filter changes and yanks the
  // user back to the saved track. scrollToTrackWhenReady polls until the
  // table is rendered, so we don't need a timeout race.
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    if (scrollRestoredRef.current) return;
    if (!lastViewedTrackId || tracks.length === 0) return;
    scrollRestoredRef.current = true;
    scrollToTrackWhenReady(lastViewedTrackId);
  }, [lastViewedTrackId, tracks.length, scrollToTrackWhenReady]);

  // Get columns from shared configuration
  const columns = useMemo(() => getCommonColumnDefs(), []);

  // Prepare data for the table with browser filtering
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

  // Memoize total hours calculation to avoid recalculating on every render
  const totalHours = useMemo(() => calculateTotalHours(data), [data]);
  const trackCount = useMemo(() => data.length, [data]);

  // Handle search toggle. Closing the bar clears the filter through
  // applyGlobalFilter so persistence and scroll-on-clear both fire.
  const handleSearchToggle = useCallback(() => {
    setShowSearch((prev) => {
      if (prev) {
        applyGlobalFilter('');
      }
      return !prev;
    });
  }, [applyGlobalFilter]);

  // Mark table as ready after layout commits. useLayoutEffect runs after
  // DOM mutations but before paint, so by the time the rAF callback fires
  // the virtualizer has measured rows for the new sorting/filter/data.
  useLayoutEffect(() => {
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

  // Drag-and-drop: compute selected track IDs list
  const selectedTrackIdsList = useMemo(
    () => Object.keys(selectedTracks),
    [selectedTracks],
  );

  const handleRowDragStart = (
    trackId: string,
    selectedIds: string[],
  ): string[] => {
    if (selectedIds.includes(trackId)) {
      return selectedIds;
    }
    return [trackId];
  };

  // Toolbar content
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
            py: 0.5,
            justifyContent: 'center',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              color: (theme) => theme.palette.text.secondary,
              lineHeight: 1,
            }}
            variant="body2"
          >
            {trackCount.toLocaleString()}&nbsp;&#9835;
          </Typography>
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
            py: 0.5,
            justifyContent: 'center',
            userSelect: 'none',
            flexShrink: 0,
          }}
        >
          <Typography
            sx={{
              color: (theme) => theme.palette.text.secondary,
              lineHeight: 1,
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
              initialValue={globalFilterRef.current}
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
      trackCount,
      totalHours,
      showSearch,
      handleSearchToggle,
      handleDebouncedSearchChange,
      browserOpen,
      setBrowserOpen,
    ],
  );

  // Empty state content
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

  // Browser panel to pass to VirtualTable — always mounted so open/close can animate
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
          selectedTrackIds={selectedTrackIdsList}
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
          useUIStore.getState().setSettingsOpen(true);
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

// Memoize the Library component to prevent unnecessary re-renders
export default React.memo(Library, (prevProps, nextProps) => {
  return (
    prevProps.drawerOpen === nextProps.drawerOpen &&
    prevProps.onDrawerToggle === nextProps.onDrawerToggle
  );
});
