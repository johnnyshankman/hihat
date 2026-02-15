import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import {
  Box,
  IconButton,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_SortingState as MrtSortingState,
  type MRT_VisibilityState as MrtVisibilityState,
  type MRT_RowVirtualizer as MrtRowVirtualizer,
  type MRT_TableInstance as MrtTableInstance,
  // eslint-disable-next-line camelcase
  MRT_ShowHideColumnsButton,
} from 'material-react-table';
import Marquee from 'react-fast-marquee';
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
import {
  getCommonTableConfig,
  getCommonColumnVisibilityHandler,
  getCommonRowStyling,
  getCommonColumnDefs,
  type TableData,
} from '../utils/tableConfig';
import { getFilteredAndSortedTrackIds } from '../utils/trackSelectionUtils';
import { calculateTotalHours } from '../utils/formatters';

// Define props interface for Playlists component
interface PlaylistsProps {
  drawerOpen: boolean;
  onDrawerToggle: () => void;
}

function Playlists({ drawerOpen, onDrawerToggle }: PlaylistsProps) {
  // Get state from library store
  const playlists = useLibraryStore((state) => state.playlists);
  const tracks = useLibraryStore((state) => state.tracks);
  const selectedPlaylistId = useLibraryStore(
    (state) => state.selectedPlaylistId,
  );
  const updatePlaylistViewState = useLibraryStore(
    (state) => state.updatePlaylistViewState,
  );
  const playlistViewState = useLibraryStore((state) => state.playlistViewState);

  // Get state from settings store
  const columnVisibility = useSettingsAndPlaybackStore(
    (state) => state.columns,
  );
  const updateColumnVisibility = useSettingsAndPlaybackStore(
    (state) => state.setColumnVisibility,
  );
  const currentTrack = useSettingsAndPlaybackStore(
    (state) => state.currentTrack,
  );
  const playbackSource = useSettingsAndPlaybackStore(
    (state) => state.playbackSource,
  );
  const playTrack = useSettingsAndPlaybackStore(
    (state) => state.selectSpecificSong,
  );
  const playbackSourcePlaylistId = useSettingsAndPlaybackStore(
    (state) => state.playbackSourcePlaylistId,
  );

  // Sorting state - initialize from store to persist across unmount/remount
  const [sorting, setSorting] = useState<MrtSortingState>(
    () => playlistViewState.sorting || [{ id: 'artist', desc: false }],
  );

  // Global filter state for search - initialize from store to persist across unmount/remount
  const [globalFilter, setGlobalFilter] = useState(
    () => playlistViewState.filtering || '',
  );

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  // Playlist selection dialog state
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);

  // Multi-select state
  const [selectedTracks, setSelectedTracks] = useState<Record<string, boolean>>(
    {},
  );
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Search state
  const [showSearch, setShowSearch] = useState(!!playlistViewState.filtering);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Confirmation dialog state
  const [removeTrackConfirmOpen, setRemoveTrackConfirmOpen] = useState(false);
  const [removeTrackId, setRemoveTrackId] = useState<string | null>(null);
  const [bulkRemoveConfirmOpen, setBulkRemoveConfirmOpen] = useState(false);

  // Add row virtualizer ref
  const rowVirtualizerRef = useRef<MrtRowVirtualizer>(null);

  // Ref to store the table instance for scrollToTrack
  const tableRef = useRef<MrtTableInstance<TableData> | null>(null);

  // Ref to track if the table is ready for scrolling (fully rendered with correct sorting)
  const tableReadyRef = useRef<boolean>(false);

  // Local state for marquee scrolling
  const [isPlaylistNameScrolling, setIsPlaylistNameScrolling] = useState(false);

  // Refs for playlist name elements
  const playlistNameRef = useRef<HTMLDivElement>(null);
  const playlistNameRef2 = useRef<HTMLDivElement>(null);

  // Define getPlaylistTracks as a useCallback to use it in dependencies
  const getPlaylistTracks = useCallback(() => {
    if (!selectedPlaylistId || !playlists) {
      return [];
    }

    const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
    if (!selectedPlaylist) {
      return [];
    }

    // If it's a smart playlist, we would apply the rules here
    // For now, just return the tracks in the playlist
    // Use the efficient getTracksByIds method for O(1) lookups instead of O(n²)
    const { getTracksByIds } = useLibraryStore.getState();
    return getTracksByIds(selectedPlaylist.trackIds);
  }, [selectedPlaylistId, playlists]);

  // Memoize the playlist tracks to prevent unnecessary re-renders
  const playlistTracks = useMemo(
    () => getPlaylistTracks(),
    [getPlaylistTracks],
  );

  const handlePlayTrack = (trackId: string) => {
    // Make sure the playlist view state is updated with the current playlist ID
    if (selectedPlaylistId) {
      updatePlaylistViewState(sorting, globalFilter, selectedPlaylistId);
    }

    // Play the track with 'playlist' as the source and pass the selectedPlaylistId
    playTrack(trackId, 'playlist', selectedPlaylistId);
  };

  // Context menu handlers
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

  const handleClosePlaylistDialog = () => {
    setPlaylistDialogOpen(false);
  };

  // Single track remove from playlist handler
  const handleSingleTrackRemoveFromPlaylist = (trackId: string) => {
    if (!selectedPlaylistId) return;

    const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
    if (!selectedPlaylist || selectedPlaylist.isSmart) {
      return;
    }

    setRemoveTrackId(trackId);
    setRemoveTrackConfirmOpen(true);
  };

  const executeSingleTrackRemove = async () => {
    setRemoveTrackConfirmOpen(false);
    if (!removeTrackId || !selectedPlaylistId) return;

    const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
    if (!selectedPlaylist) return;

    const track = tracks.find((t) => t.id === removeTrackId);

    try {
      const { showNotification } = useUIStore.getState();

      const updatedPlaylist = {
        ...selectedPlaylist,
        trackIds: selectedPlaylist.trackIds.filter(
          (id) => id !== removeTrackId,
        ),
      };

      await window.electron.playlists.update(updatedPlaylist);
      await useLibraryStore.getState().loadPlaylists();

      showNotification(
        `Successfully removed "${track?.title}" from "${selectedPlaylist.name}"`,
        'success',
      );
    } catch (error) {
      console.error('Error removing track from playlist:', error);
      const { showNotification } = useUIStore.getState();
      showNotification('Failed to remove track from playlist', 'error');
    }

    setRemoveTrackId(null);
  };

  // Multi-select handlers
  const handleMultiSelectRemoveFromPlaylist = () => {
    const selectedTrackIds = Object.keys(selectedTracks);
    if (selectedTrackIds.length === 0 || !selectedPlaylistId) return;

    const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
    if (!selectedPlaylist || selectedPlaylist.isSmart) {
      return;
    }

    setBulkRemoveConfirmOpen(true);
  };

  const executeMultiSelectRemoveFromPlaylist = async () => {
    setBulkRemoveConfirmOpen(false);
    const selectedTrackIds = Object.keys(selectedTracks);
    if (selectedTrackIds.length === 0 || !selectedPlaylistId) return;

    const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
    if (!selectedPlaylist) return;

    try {
      const { showNotification } = useUIStore.getState();

      const updatedPlaylist = {
        ...selectedPlaylist,
        trackIds: selectedPlaylist.trackIds.filter(
          (id) => !selectedTrackIds.includes(id),
        ),
      };

      await window.electron.playlists.update(updatedPlaylist);
      await useLibraryStore.getState().loadPlaylists();

      setSelectedTracks({});

      showNotification(
        `Successfully removed ${selectedTrackIds.length} track${selectedTrackIds.length > 1 ? 's' : ''} from "${selectedPlaylist.name}"`,
        'success',
      );
    } catch (error) {
      console.error('Error removing tracks from playlist:', error);
      const { showNotification } = useUIStore.getState();
      showNotification('Failed to remove tracks from playlist', 'error');
    }
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
        const trackIds = getFilteredAndSortedTrackIds('playlist');
        trackIndex = trackIds.indexOf(trackId);
      }

      if (trackIndex !== -1) {
        // Scroll to the track
        rowVirtualizerRef.current.scrollToIndex(trackIndex, {
          align: 'center',
        });
      }
    },
    // The function doesn't depend on any props or state since it gets current state from the store
    [],
  );

  // Function that waits for the table to be ready before scrolling
  // This is used when navigating from another view (e.g., library) to playlist
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
    window.hihatScrollToPlaylistTrack = scrollToTrackWhenReady;

    return () => {
      // @ts-ignore - Cleanup
      delete window.hihatScrollToPlaylistTrack;
      // Reset ready state on unmount
      tableReadyRef.current = false;
    };
  }, [scrollToTrackWhenReady]);

  // Check if playlist name text overflows its container
  useEffect(() => {
    const checkPlaylistNameOverflow = () => {
      if (playlistNameRef.current) {
        const isOverflowing =
          playlistNameRef.current.scrollWidth >
          playlistNameRef.current.clientWidth;
        setIsPlaylistNameScrolling(isOverflowing);
      }
    };

    checkPlaylistNameOverflow();

    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(checkPlaylistNameOverflow);
    if (playlistNameRef.current) {
      resizeObserver.observe(playlistNameRef.current);
    }

    const currentPlaylistNameRef = playlistNameRef.current;
    return () => {
      if (currentPlaylistNameRef) {
        resizeObserver.unobserve(currentPlaylistNameRef);
      }
    };
  }, [selectedPlaylistId, playlists]);

  // Check if playlist name in marquee overflows
  useEffect(() => {
    const checkPlaylistNameOverflow2 = () => {
      if (playlistNameRef2.current) {
        const isOverflowing =
          playlistNameRef2.current.scrollWidth >
          (playlistNameRef2.current.parentElement?.parentElement?.parentElement
            ?.clientWidth || 10000000);
        setIsPlaylistNameScrolling(isOverflowing);
      }
    };

    checkPlaylistNameOverflow2();

    // Create a ResizeObserver to watch for size changes
    const resizeObserver = new ResizeObserver(checkPlaylistNameOverflow2);
    if (playlistNameRef2.current) {
      resizeObserver.observe(playlistNameRef2.current);
    }

    const currentPlaylistNameRef2 = playlistNameRef2.current;
    return () => {
      if (currentPlaylistNameRef2) {
        resizeObserver.unobserve(currentPlaylistNameRef2);
      }
    };
  }, [selectedPlaylistId, playlists]);

  // Get columns from shared configuration
  const columns = useMemo(() => getCommonColumnDefs(), []);

  // Prepare data for Material React Table
  const data = useMemo<TableData[]>(() => {
    return playlistTracks.map((track) => {
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
  }, [playlistTracks]);

  // Handle search toggle
  const handleSearchToggle = useCallback(() => {
    setShowSearch((prev) => {
      if (prev) {
        // Closing search - clear the filter
        setGlobalFilter('');
        updatePlaylistViewState(sorting, '', selectedPlaylistId);
      }
      return !prev;
    });
  }, [sorting, updatePlaylistViewState, selectedPlaylistId]);

  // Focus search input when opened
  useEffect(() => {
    if (showSearch && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [showSearch]);

  // Unified toolbar with sidebar toggle, title, badges, and MRT controls
  const renderTopToolbarCustomActions = ({
    table: tableInstance,
  }: {
    table: MrtTableInstance<TableData>;
  }) => {
    // Get the playlist name content
    let playlistNameContent;

    if (!selectedPlaylistId) {
      playlistNameContent = '----';
    } else if (isPlaylistNameScrolling) {
      playlistNameContent = (
        <Marquee delay={0.5} pauseOnHover speed={10}>
          <div ref={playlistNameRef2}>
            {playlists.find((p) => p.id === selectedPlaylistId)?.name ||
              'Playlist'}
            &nbsp;&nbsp;-&nbsp;&nbsp;
          </div>
        </Marquee>
      );
    } else {
      playlistNameContent = (
        <div ref={playlistNameRef}>
          {playlists.find((p) => p.id === selectedPlaylistId)?.name ||
            'Playlist'}
        </div>
      );
    }

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
            maxWidth: window.innerWidth < 768 ? '200px' : '400px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            userSelect: 'none',
            flexShrink: showSearch ? 1 : 0,
          }}
          variant="h2"
        >
          {playlistNameContent}
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
                {playlistTracks.length.toLocaleString()}&nbsp;♫
              </Typography>
            </Box>
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
                {calculateTotalHours(playlistTracks)}&nbsp;
              </Typography>
              <AccessTimeIcon
                sx={{
                  fontSize: 14,
                  color: (theme) => theme.palette.text.secondary,
                }}
              />
            </Box>
          </>
        )}
        {showSearch && (
          <TextField
            autoFocus
            inputRef={searchInputRef}
            onChange={(e) => {
              setGlobalFilter(e.target.value);
              updatePlaylistViewState(
                sorting,
                e.target.value,
                selectedPlaylistId,
              );
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                handleSearchToggle();
              }
            }}
            placeholder="Search playlist"
            size="small"
            slotProps={{
              input: {
                endAdornment: globalFilter ? (
                  <InputAdornment position="end">
                    <IconButton
                      edge="end"
                      onClick={() => {
                        setGlobalFilter('');
                        updatePlaylistViewState(
                          sorting,
                          '',
                          selectedPlaylistId,
                        );
                        searchInputRef.current?.focus();
                      }}
                      size="small"
                    >
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ) : null,
              },
            }}
            sx={{
              flexGrow: 1,
              flexShrink: 1,
              minWidth: '100px',
              '& .MuiOutlinedInput-root': { height: '32px' },
            }}
            value={globalFilter}
            variant="outlined"
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
        </Box>
      </Box>
    );
  };

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
      updatePlaylistViewState(sorting, globalFilter, selectedPlaylistId);
    },
    onGlobalFilterChange: (updater) => {
      const newFilter =
        typeof updater === 'function' ? updater(globalFilter) : updater;
      const oldFilter = globalFilter;
      setGlobalFilter(newFilter);
      updatePlaylistViewState(sorting, newFilter, selectedPlaylistId);

      // When filter is cleared (from non-empty to empty), scroll to current track
      if (
        oldFilter &&
        !newFilter &&
        currentTrack &&
        playbackSource === 'playlist' &&
        playbackSourcePlaylistId === selectedPlaylistId
      ) {
        // Check if the current track is in this playlist
        const playlistTrackIds = playlistTracks.map((t) => t.id);
        if (playlistTrackIds.includes(currentTrack.id)) {
          // Use setTimeout to ensure the table has re-rendered
          setTimeout(() => {
            scrollToTrack(currentTrack.id);
          }, 100);
        }
      }
    },
    onColumnVisibilityChange: getCommonColumnVisibilityHandler(
      columnVisibility as unknown as Record<string, boolean>,
      updateColumnVisibility,
    ),
    onRowSelectionChange: () => {
      // do absolutely nothing, we handle this manually
    },
    muiTableBodyRowProps: ({ row, table: tableInstance }) => {
      // Get the current visible rows
      const visibleRows = tableInstance.getRowModel().rows;
      const currentIndex = visibleRows.findIndex(
        (r) => r.original.id === row.original.id,
      );

      // Use the visual index for row striping
      const visualIndex = currentIndex !== -1 ? currentIndex : row.index;

      return {
        onClick: (e) => {
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
        onContextMenu: (e) => {
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
          'playlist',
          playbackSourcePlaylistId || undefined,
          selectedPlaylistId || undefined,
          visualIndex,
        ),
      };
    },
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
          This playlist is empty
        </Typography>
        <Typography
          sx={{
            color: 'text.secondary',
            textAlign: 'center',
            maxWidth: '400px',
          }}
          variant="body2"
        >
          Add songs to this playlist by right-clicking on tracks and selecting
          &ldquo;Add to playlist&rdquo;
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
        flexDirection: 'column',
        overflow: 'hidden',
        padding: 0,
        margin: 0,
        backgroundColor: (theme) => theme.palette.background.default,
      }}
    >
      {selectedPlaylistId ? (
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
      ) : (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 4,
            height: '50vh',
            width: drawerOpen ? `calc(100vw - 240px)` : '100vw',
            backgroundColor: (theme) => theme.palette.background.default,
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
            Select a playlist
          </Typography>
          <Typography
            sx={{
              color: 'text.secondary',
              textAlign: 'center',
              maxWidth: '400px',
            }}
            variant="body2"
          >
            Choose a playlist from the sidebar to view its tracks.
          </Typography>
        </Box>
      )}

      {/* Context menu - show multi-select menu if multiple tracks selected */}
      {Object.keys(selectedTracks).length > 1 ? (
        <MultiSelectContextMenu
          anchorPosition={
            contextMenu !== null
              ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
              : null
          }
          isPlaylistView
          onClose={handleCloseContextMenu}
          onRemoveFromPlaylist={handleMultiSelectRemoveFromPlaylist}
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
          isPlaylistView
          onAddToPlaylist={handleAddToPlaylist}
          onClose={handleCloseContextMenu}
          onRemoveFromPlaylist={handleSingleTrackRemoveFromPlaylist}
          open={contextMenu !== null}
          trackId={selectedTrackId}
        />
      )}

      {/* Playlist selection dialog */}
      {selectedTrackId && (
        <PlaylistSelectionDialog
          onClose={handleClosePlaylistDialog}
          open={playlistDialogOpen}
          trackId={selectedTrackId}
        />
      )}

      {/* Remove single track confirmation dialog */}
      <ConfirmationDialog
        cancelText="Cancel"
        confirmButtonColor="error"
        confirmText="Remove"
        message={`Are you sure you want to remove "${tracks.find((t) => t.id === removeTrackId)?.title || 'this track'}" from "${playlists.find((p) => p.id === selectedPlaylistId)?.name || 'this playlist'}"?`}
        onCancel={() => {
          setRemoveTrackConfirmOpen(false);
          setRemoveTrackId(null);
        }}
        onConfirm={executeSingleTrackRemove}
        open={removeTrackConfirmOpen}
        title="Remove from Playlist"
      />

      {/* Bulk remove confirmation dialog */}
      <ConfirmationDialog
        cancelText="Cancel"
        confirmButtonColor="error"
        confirmText="Remove"
        message={`Are you sure you want to remove ${Object.keys(selectedTracks).length} track${Object.keys(selectedTracks).length > 1 ? 's' : ''} from "${playlists.find((p) => p.id === selectedPlaylistId)?.name || 'this playlist'}"?`}
        onCancel={() => setBulkRemoveConfirmOpen(false)}
        onConfirm={executeMultiSelectRemoveFromPlaylist}
        open={bulkRemoveConfirmOpen}
        title="Remove from Playlist"
      />
    </Box>
  );
}

// Memoize Playlists component to prevent unnecessary re-renders
export default React.memo(Playlists, (prevProps, nextProps) => {
  return (
    prevProps.drawerOpen === nextProps.drawerOpen &&
    prevProps.onDrawerToggle === nextProps.onDrawerToggle
  );
});
