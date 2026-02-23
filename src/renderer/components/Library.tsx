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
  useMediaQuery,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_SortingState as MrtSortingState,
  type MRT_RowVirtualizer as MrtRowVirtualizer,
  type MRT_VisibilityState as MrtVisibilityState,
  type MRT_Row as MrtRow,
  type MRT_TableInstance as MrtTableInstance,
  // eslint-disable-next-line camelcase
  MRT_ShowHideColumnsButton,
} from 'material-react-table';
import PeopleIcon from '@mui/icons-material/People';
import {
  useLibraryStore,
  useSettingsAndPlaybackStore,
  useUIStore,
} from '../stores';
import TrackContextMenu from './TrackContextMenu';
import MultiSelectContextMenu from './MultiSelectContextMenu';
import PlaylistSelectionDialog from './PlaylistSelectionDialog';
import ConfirmationDialog from './ConfirmationDialog';
import SidebarToggle from './SidebarToggle';
import ArtistBrowser from './ArtistBrowser';
import SearchBar from './SearchBar';
import {
  getCommonTableConfig,
  getCommonColumnVisibilityHandler,
  getCommonRowStyling,
  getCommonColumnDefs,
  type TableData,
} from '../utils/tableConfig';
import { getFilteredAndSortedTrackIds } from '../utils/trackSelectionUtils';
import { calculateTotalHours } from '../utils/formatters';

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
  const tableRef = useRef<MrtTableInstance<TableData> | null>(null);

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
  const [selectedTracks, setSelectedTracks] = useState<Record<string, boolean>>(
    {},
  );
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [multiSelectPlaylistDialogOpen, setMultiSelectPlaylistDialogOpen] =
    useState(false);
  const artistFilter = useLibraryStore((state) => state.artistFilter);
  const setArtistFilter = useLibraryStore((state) => state.setArtistFilter);
  const libraryViewState = useLibraryStore((state) => state.libraryViewState);
  const [artistBrowserOpen, setArtistBrowserOpen] = useState(!!artistFilter);
  const [showSearch, setShowSearch] = useState(!!libraryViewState.filtering);
  const isNarrowWindow = useMediaQuery('(max-width:768px)');

  // Open artist browser when artist filter is set
  useEffect(() => {
    if (artistFilter && !artistBrowserOpen) {
      setArtistBrowserOpen(true);
    }
  }, [artistFilter, artistBrowserOpen]);

  // Handle artist browser toggle - clear selection when closing
  const handleArtistBrowserToggle = useCallback(() => {
    const newOpenState = !artistBrowserOpen;
    setArtistBrowserOpen(newOpenState);

    // If closing the browser, reset to "All Artists"
    if (!newOpenState) {
      setArtistFilter(null);
    }
  }, [artistBrowserOpen, setArtistFilter]);

  // Global filter state — receives debounced values from SearchBar.
  // This is the only filter state that triggers MRT re-renders.
  const [globalFilter, setGlobalFilter] = useState(
    () => libraryViewState.filtering || '',
  );
  const globalFilterRef = useRef(globalFilter);

  // Stable callback for SearchBar — never changes identity
  const handleDebouncedSearchChange = useCallback((value: string) => {
    setGlobalFilter(value);
    globalFilterRef.current = value;
  }, []);

  // Sorting state - initialize from store to persist across unmount/remount
  const [sorting, setSorting] = useState<MrtSortingState>(
    () => libraryViewState.sorting || [{ id: 'artist', desc: false }],
  );

  // Add row virtualizer ref
  const rowVirtualizerRef = useRef<MrtRowVirtualizer>(null);

  // Cache for O(1) row index lookups in muiTableBodyRowProps
  const rowIndexCacheRef = useRef<{
    rows: MrtRow<TableData>[];
    map: Map<string, number>;
  } | null>(null);

  const handlePlayTrack = useCallback(
    (trackId: string) => {
      // Play the track with 'library' as the source
      playTrack(trackId, 'library');
    },
    [playTrack],
  );

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

  // Context menu handlers
  const handleContextMenu = useCallback(
    (event: React.MouseEvent, trackId: string) => {
      event.preventDefault();
      setContextMenu({
        mouseX: event.clientX,
        mouseY: event.clientY,
      });
      setSelectedTrackId(trackId);
    },
    [],
  );

  const handleCloseContextMenu = () => {
    setContextMenu(null);
  };

  const handleAddToPlaylist = () => {
    setPlaylistDialogOpen(true);
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
      // This ensures we use the same order as the rendered table
      let trackIndex = -1;

      if (tableRef.current) {
        // Get the actual sorted/filtered rows from the table
        const { rows } = tableRef.current.getRowModel();
        trackIndex = rows.findIndex((row) => row.original.id === trackId);
      }

      // Fallback to calculating the index if table isn't ready yet
      if (trackIndex === -1) {
        const trackIds = getFilteredAndSortedTrackIds('library', artistFilter);
        trackIndex = trackIds.indexOf(trackId);
      }

      // eslint-disable-next-line no-console
      console.log('scrollToTrack called with:', {
        trackId,
        trackIndex,
        usingTableRowModel: tableRef.current !== null,
        artistFilter,
      });

      if (trackIndex !== -1) {
        // Scroll to the track
        rowVirtualizerRef.current.scrollToIndex(trackIndex, {
          align: 'center',
        });
        // eslint-disable-next-line no-console
        console.log('Scrolled to index:', trackIndex);
      } else {
        // eslint-disable-next-line no-console
        console.log('Track not found in current view');
      }
    },
    [artistFilter],
  );

  // Function that waits for the table to be ready before scrolling
  // This is used when navigating from another view (e.g., playlist) to library
  const scrollToTrackWhenReady = useCallback(
    (trackId: string, maxWaitMs: number = 2000) => {
      const startTime = Date.now();
      const pollInterval = 50; // Check every 50ms
      const minWaitMs = 150; // Minimum wait time before scrolling to ensure virtualizer is stable

      const attemptScroll = () => {
        const elapsedMs = Date.now() - startTime;

        // Check if table is ready (has rows and ref is set)
        const isReady =
          tableReadyRef.current &&
          tableRef.current &&
          tableRef.current.getRowModel().rows.length > 0;

        // Wait at least minWaitMs before scrolling, even if table appears ready
        // This ensures the virtualizer has time to stabilize for all library sizes
        if (isReady && elapsedMs >= minWaitMs) {
          // Table is ready and we've waited long enough, scroll now
          scrollToTrack(trackId);
          return;
        }

        // Check if we've exceeded the max wait time
        if (elapsedMs >= maxWaitMs) {
          // Timeout - try scrolling anyway as a fallback
          // eslint-disable-next-line no-console
          console.log(
            'scrollToTrackWhenReady: timeout reached, attempting scroll anyway',
          );
          scrollToTrack(trackId);
          return;
        }

        // Table not ready yet or haven't waited long enough, try again after a short delay
        setTimeout(attemptScroll, pollInterval);
      };

      // Start polling
      attemptScroll();
    },
    [scrollToTrack],
  );

  // Expose the scrollToTrack function to the window object
  useEffect(() => {
    // @ts-ignore - Adding custom property to window
    window.hihatScrollToLibraryTrack = scrollToTrackWhenReady;

    return () => {
      // @ts-ignore - Cleanup
      delete window.hihatScrollToLibraryTrack;
      // Reset ready state on unmount
      tableReadyRef.current = false;
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
      // Get the showNotification function from the UI store
      const { showNotification } = useUIStore.getState();

      // Before deletion, determine which track to scroll to after deletion
      // Get the current filtered and sorted track IDs with artist filter
      const currentTrackIds = getFilteredAndSortedTrackIds(
        'library',
        artistFilter,
      );

      // Find all indices of tracks being deleted
      const deletedIndices = selectedTrackIds
        .map((trackId) => currentTrackIds.indexOf(trackId))
        .filter((index) => index !== -1)
        .sort((a, b) => a - b); // Sort indices in ascending order

      // Find the track to scroll to: the next track after the highest deleted index
      let targetTrackId: string | null = null;
      if (deletedIndices.length > 0) {
        const highestDeletedIndex = deletedIndices[deletedIndices.length - 1];

        // eslint-disable-next-line no-console
        console.log('Deletion info:', {
          selectedTrackIds,
          deletedIndices,
          highestDeletedIndex,
          totalTracks: currentTrackIds.length,
        });

        // Look for the next track that won't be deleted
        for (
          let i = highestDeletedIndex + 1;
          i < currentTrackIds.length;
          i += 1
        ) {
          const candidateTrackId = currentTrackIds[i];
          if (!selectedTrackIds.includes(candidateTrackId)) {
            targetTrackId = candidateTrackId;
            // eslint-disable-next-line no-console
            console.log('Found next track:', candidateTrackId, 'at index', i);
            break;
          }
        }

        // If no track found after the highest deleted index,
        // look for a track before the lowest deleted index
        if (!targetTrackId && deletedIndices[0] > 0) {
          for (let i = deletedIndices[0] - 1; i >= 0; i -= 1) {
            const candidateTrackId = currentTrackIds[i];
            if (!selectedTrackIds.includes(candidateTrackId)) {
              targetTrackId = candidateTrackId;
              // eslint-disable-next-line no-console
              console.log(
                'Found previous track:',
                candidateTrackId,
                'at index',
                i,
              );
              break;
            }
          }
        }

        // eslint-disable-next-line no-console
        console.log('Target track for scrolling:', targetTrackId);
      }

      // Step 1: Get all playlists that might contain these tracks
      const allPlaylists = await window.electron.playlists.getAll();

      // For each selected track
      // eslint-disable-next-line no-restricted-syntax
      for (const trackId of selectedTrackIds) {
        const track = getTrackById(trackId);
        // eslint-disable-next-line no-continue
        if (!track) continue;

        // Step 2: Remove the track from all playlists that contain it
        const playlistsToUpdate = allPlaylists.filter(
          (playlist) =>
            !playlist.isSmart && playlist.trackIds.includes(trackId),
        );

        // Update all playlists in parallel
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

        // Step 3: Delete the track from the database
        // eslint-disable-next-line no-await-in-loop
        const dbDeleteResult = await window.electron.tracks.delete(trackId);

        if (!dbDeleteResult) {
          showNotification(`Failed to delete track: ${track.title}`, 'error');
          // eslint-disable-next-line no-continue
          continue;
        }

        // Step 4: Delete the actual file from the filesystem
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

      // Reload the library to reflect changes
      await useLibraryStore.getState().loadLibrary(false);

      // Clear selection after deletion
      setSelectedTracks({});

      // Scroll to the target track if one was determined
      if (targetTrackId) {
        // Use a longer timeout to ensure the table has re-rendered with the new data
        setTimeout(() => {
          // eslint-disable-next-line no-console
          console.log('Scrolling to track:', targetTrackId);
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

  // Save the currently visible track on unmount
  useEffect(() => {
    const virtualizerRef = rowVirtualizerRef.current;
    return () => {
      // On unmount, save the currently visible track
      if (virtualizerRef) {
        const visibleRange = virtualizerRef.range;

        if (visibleRange) {
          // Get the middle visible item index
          const middleIndex = Math.floor(
            (visibleRange.startIndex + visibleRange.endIndex) / 2,
          );

          // Get the filtered and sorted track IDs based on current view state
          const trackIds = getFilteredAndSortedTrackIds('library');

          if (trackIds[middleIndex]) {
            setLastViewedTrackId(trackIds[middleIndex]);
          }
        }
      }
    };
  }, [setLastViewedTrackId]);

  // Restore scroll position on mount
  useEffect(() => {
    if (lastViewedTrackId && rowVirtualizerRef.current && tracks.length > 0) {
      // Use a small delay to ensure the virtualizer is ready
      setTimeout(() => {
        scrollToTrack(lastViewedTrackId);
      }, 100);
    }
  }, [lastViewedTrackId, scrollToTrack, tracks.length]);

  // Get columns from shared configuration
  const columns = useMemo(() => getCommonColumnDefs(), []);

  // Prepare data for Material React Table with artist filtering
  const data = useMemo<TableData[]>(() => {
    let filteredTracks = tracks;

    // Filter by selected artist if one is selected
    if (artistFilter) {
      filteredTracks = tracks.filter((track) => {
        const artist = track.albumArtist || track.artist || 'Unknown Artist';
        return artist === artistFilter;
      });
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
  }, [tracks, artistFilter]);

  // Memoize total hours calculation to avoid recalculating on every render
  const totalHours = useMemo(() => calculateTotalHours(data), [data]);
  const trackCount = useMemo(() => data.length, [data]);

  // Track previous global filter for detecting clears
  const prevGlobalFilterRef = useRef(globalFilter);

  // Persist global filter to store and handle scroll-to-track on clear
  useEffect(() => {
    const prevFilter = prevGlobalFilterRef.current;
    prevGlobalFilterRef.current = globalFilter;

    updateLibraryViewState(sorting, globalFilter);

    // When filter is cleared (from non-empty to empty), scroll to current track
    if (
      prevFilter &&
      !globalFilter &&
      currentTrack &&
      playbackSource === 'library'
    ) {
      const visibleTrackIds = getFilteredAndSortedTrackIds(
        'library',
        artistFilter,
      );
      if (visibleTrackIds.includes(currentTrack.id)) {
        setTimeout(() => {
          scrollToTrack(currentTrack.id);
        }, 100);
      }
    }
  }, [
    globalFilter,
    sorting,
    updateLibraryViewState,
    currentTrack,
    playbackSource,
    artistFilter,
    scrollToTrack,
  ]);

  // Handle search toggle
  const handleSearchToggle = useCallback(() => {
    setShowSearch((prev) => {
      if (prev) {
        // Closing search - clear the filter immediately
        setGlobalFilter('');
        globalFilterRef.current = '';
      }
      return !prev;
    });
  }, []);

  // Unified toolbar with sidebar toggle, title, badges, and MRT controls
  const renderTopToolbarCustomActions = useCallback(
    // eslint-disable-next-line react/no-unused-prop-types
    ({ table: tableInstance }: { table: MrtTableInstance<TableData> }) => {
      return (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            alignItems: 'center',
            height: '40px',
            pl: '0',
            flexShrink: 0,
            width: '100%',
          }}
        >
          <SidebarToggle isOpen={drawerOpen} onToggle={onDrawerToggle} />
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
          {!showSearch && (
            <>
              <Box
                sx={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  borderRadius: '16px',
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
                  {trackCount.toLocaleString()}&nbsp;♫
                </Typography>
              </Box>
              {!isNarrowWindow && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    borderRadius: '16px',
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
              )}
            </>
          )}
          {showSearch && (
            <SearchBar
              initialValue={globalFilterRef.current}
              onClose={handleSearchToggle}
              onDebouncedChange={handleDebouncedSearchChange}
            />
          )}
          <Box sx={{ flexGrow: showSearch ? 0 : 1 }} />
          <Box
            sx={{
              display: 'flex',
              gap: '2px',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <Tooltip title={showSearch ? 'Close search' : 'Search'}>
              <IconButton
                aria-label="Show/Hide search"
                onClick={handleSearchToggle}
                sx={{
                  color: showSearch ? 'primary.main' : 'text.secondary',
                  '&:hover': {
                    color: showSearch ? 'primary.dark' : 'text.primary',
                  },
                }}
              >
                {showSearch ? <SearchOffIcon /> : <SearchIcon />}
              </IconButton>
            </Tooltip>
            {/* eslint-disable-next-line react/jsx-pascal-case, camelcase */}
            <MRT_ShowHideColumnsButton table={tableInstance} />
            <Tooltip
              title={
                artistBrowserOpen
                  ? 'Hide artist browser'
                  : 'Show artist browser'
              }
            >
              <IconButton
                onClick={handleArtistBrowserToggle}
                sx={{
                  color: artistBrowserOpen ? 'primary.main' : 'text.secondary',
                  '&:hover': {
                    color: artistBrowserOpen ? 'primary.dark' : 'text.primary',
                  },
                }}
              >
                <PeopleIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      );
    },
    [
      drawerOpen,
      onDrawerToggle,
      trackCount,
      totalHours,
      artistBrowserOpen,
      handleArtistBrowserToggle,
      isNarrowWindow,
      showSearch,
      handleSearchToggle,
      handleDebouncedSearchChange,
    ],
  );

  // Configure the table
  const table = useMaterialReactTable({
    ...getCommonTableConfig(drawerOpen),
    columns,
    data,
    rowVirtualizerInstanceRef: rowVirtualizerRef,
    state: {
      globalFilter,
      sorting,
      columnVisibility: {
        ...((columnVisibility as unknown as MrtVisibilityState) || {}),
        trackNumber: false,
      },
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);
    },
    onGlobalFilterChange: (updater) => {
      const newFilter =
        typeof updater === 'function' ? updater(globalFilter) : updater;
      setGlobalFilter(newFilter);
      globalFilterRef.current = newFilter;
    },
    onColumnVisibilityChange: getCommonColumnVisibilityHandler(
      columnVisibility as unknown as Record<string, boolean>,
      updateColumnVisibility,
    ),
    onRowSelectionChange: () => {
      // do absolutely nothing, we handle this manually
    },
    muiTableBodyRowProps: useCallback(
      ({
        row,
        table: tableInstance,
      }: {
        row: MrtRow<TableData>;
        table: MrtTableInstance<TableData>;
      }) => {
        // Build an O(1) index cache for visible rows, refreshed when the row array changes
        const visibleRows = tableInstance.getRowModel().rows;
        if (
          !rowIndexCacheRef.current ||
          rowIndexCacheRef.current.rows !== visibleRows
        ) {
          const map = new Map<string, number>();
          for (let i = 0; i < visibleRows.length; i += 1) {
            map.set(visibleRows[i].original.id, i);
          }
          rowIndexCacheRef.current = { rows: visibleRows, map };
        }
        const currentIndex =
          rowIndexCacheRef.current.map.get(row.original.id) ?? -1;

        // Use the visual index for row striping
        const visualIndex = currentIndex !== -1 ? currentIndex : row.index;

        return {
          onClick: (e: React.MouseEvent) => {
            const trackId = row.original.id;

            setSelectedTracks((prev) => {
              // Cmd/Ctrl + Click: Toggle selection
              if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
                const newSelectedTracks = { ...prev };
                if (newSelectedTracks[trackId]) {
                  delete newSelectedTracks[trackId];
                } else {
                  newSelectedTracks[trackId] = true;
                }
                setLastClickedIndex(currentIndex);
                return newSelectedTracks;
              }

              // Shift + Click: Range selection (always replace existing selection)
              if (e.shiftKey && !e.metaKey && !e.ctrlKey) {
                // If no previous selection, treat as normal click
                if (lastClickedIndex === null) {
                  setLastClickedIndex(currentIndex);
                  return { [trackId]: true };
                }

                const start = Math.min(lastClickedIndex, currentIndex);
                const end = Math.max(lastClickedIndex, currentIndex);

                // Create new selection with only the range
                const rangeSelection: Record<string, boolean> = {};

                // Select all tracks in range
                for (let i = start; i <= end; i += 1) {
                  const rowData = visibleRows[i]?.original;
                  if (rowData) {
                    rangeSelection[rowData.id] = true;
                  }
                }

                // Don't update lastClickedIndex on shift+click to maintain the anchor point
                return rangeSelection;
              }

              // Normal click: Select only this track
              setLastClickedIndex(currentIndex);
              return { [trackId]: true };
            });
          },
          onDoubleClick: () => {
            // play the track
            handlePlayTrack(row.original.id);
            // make this the only selected track
            setSelectedTracks({ [row.original.id]: true });
          },
          onContextMenu: (e: React.MouseEvent) => {
            const trackId = row.original.id;

            // If right-clicking on an already selected track, keep selection
            if (selectedTracks[trackId]) {
              handleContextMenu(e, trackId);
            } else {
              // If right-clicking on unselected track, select only that track
              setSelectedTracks({ [trackId]: true });
              handleContextMenu(e, trackId);
            }
          },
          'data-track-id': row.original.id,
          sx: getCommonRowStyling(
            row.original.id,
            currentTrack?.id || undefined,
            Object.keys(selectedTracks),
            playbackSource || '',
            'library',
            undefined,
            undefined,
            visualIndex,
          ),
        };
      },
      [
        selectedTracks,
        setSelectedTracks,
        setLastClickedIndex,
        lastClickedIndex,
        handlePlayTrack,
        handleContextMenu,
        currentTrack?.id,
        playbackSource,
      ],
    ),
    renderTopToolbarCustomActions,
    enableToolbarInternalActions: false,
    renderEmptyRowsFallback: () => (
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
  });

  // Store table instance in ref for scrollToTrack to access
  tableRef.current = table;

  // Mark table as ready after render completes
  // Using useEffect ensures this runs after the DOM has been updated
  useEffect(() => {
    // Use requestAnimationFrame to ensure the browser has painted
    // This guarantees the table is fully rendered before we mark it as ready
    const rafId = requestAnimationFrame(() => {
      tableReadyRef.current = true;
    });

    return () => {
      cancelAnimationFrame(rafId);
      tableReadyRef.current = false;
    };
  }, [sorting, globalFilter, data.length]); // Re-run when sorting, filter, or data changes

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'row',
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
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
          margin: 0,
          backgroundColor: (theme) => theme.palette.background.default,
        }}
      >
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
          <MaterialReactTable table={table} />
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
          message={`Are you sure you want to delete ${Object.keys(selectedTracks).length} track${Object.keys(selectedTracks).length > 1 ? 's' : ''}? This will permanently delete the files from your computer.`}
          onCancel={() => setBulkDeleteConfirmOpen(false)}
          onConfirm={executeMultiSelectDeleteTracks}
          open={bulkDeleteConfirmOpen}
          title="Delete Tracks"
        />
      </Box>

      {/* Artist Browser */}
      <ArtistBrowser
        onArtistSelect={setArtistFilter}
        onToggle={handleArtistBrowserToggle}
        open={artistBrowserOpen}
        selectedArtist={artistFilter}
      />
    </Box>
  );
}

// Memoize the Library component to prevent unnecessary re-renders
export default React.memo(Library, (prevProps, nextProps) => {
  // Only re-render if drawerOpen actually changes
  return (
    prevProps.drawerOpen === nextProps.drawerOpen &&
    prevProps.onDrawerToggle === nextProps.onDrawerToggle
  );
});
