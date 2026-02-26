import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SearchIcon from '@mui/icons-material/Search';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { type SortingState, type Row, type Table } from '@tanstack/react-table';
import { type Virtualizer } from '@tanstack/react-virtual';
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
import SearchBar from './SearchBar';
import VirtualTable from './VirtualTable';
import ColumnVisibilityMenu from './ColumnVisibilityMenu';
import {
  getRowClassName,
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
  const [sorting, setSorting] = useState<SortingState>(
    () => playlistViewState.sorting || [{ id: 'artist', desc: false }],
  );

  // Global filter state — receives debounced values from SearchBar.
  const [globalFilter, setGlobalFilter] = useState(
    () => playlistViewState.filtering || '',
  );
  const globalFilterRef = useRef(globalFilter);

  // Stable callback for SearchBar — never changes identity
  const handleDebouncedSearchChange = useCallback((value: string) => {
    setGlobalFilter(value);
    globalFilterRef.current = value;
  }, []);

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

  // Confirmation dialog state
  const [removeTrackConfirmOpen, setRemoveTrackConfirmOpen] = useState(false);
  const [removeTrackId, setRemoveTrackId] = useState<string | null>(null);
  const [bulkRemoveConfirmOpen, setBulkRemoveConfirmOpen] = useState(false);

  // Add row virtualizer ref
  const rowVirtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(
    null,
  );

  // Ref to store the table instance for scrollToTrack
  const tableRef = useRef<Table<TableData> | null>(null);

  // Ref to track if the table is ready for scrolling
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

    const { getTracksByIds } = useLibraryStore.getState();
    return getTracksByIds(selectedPlaylist.trackIds);
  }, [selectedPlaylistId, playlists]);

  // Memoize the playlist tracks to prevent unnecessary re-renders
  const playlistTracks = useMemo(
    () => getPlaylistTracks(),
    [getPlaylistTracks],
  );

  const handlePlayTrack = (trackId: string) => {
    if (selectedPlaylistId) {
      updatePlaylistViewState(sorting, globalFilter, selectedPlaylistId);
    }

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
  const scrollToTrack = useCallback((trackId: string) => {
    if (!rowVirtualizerRef.current) return;

    let trackIndex = -1;

    if (tableRef.current) {
      const { rows } = tableRef.current.getRowModel();
      trackIndex = rows.findIndex((row) => row.original.id === trackId);
    }

    if (trackIndex === -1) {
      const trackIds = getFilteredAndSortedTrackIds('playlist');
      trackIndex = trackIds.indexOf(trackId);
    }

    if (trackIndex !== -1) {
      rowVirtualizerRef.current.scrollToIndex(trackIndex, {
        align: 'center',
      });
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

  // Expose the scrollToTrack function to the window object
  useEffect(() => {
    // @ts-ignore - Adding custom property to window
    window.hihatScrollToPlaylistTrack = scrollToTrackWhenReady;

    return () => {
      // @ts-ignore - Cleanup
      delete window.hihatScrollToPlaylistTrack;
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

  // Prepare data for the table
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

  // Track previous global filter for detecting clears
  const prevGlobalFilterRef = useRef(globalFilter);

  // Persist global filter to store and handle scroll-to-track on clear
  useEffect(() => {
    const prevFilter = prevGlobalFilterRef.current;
    prevGlobalFilterRef.current = globalFilter;

    updatePlaylistViewState(sorting, globalFilter, selectedPlaylistId);

    if (
      prevFilter &&
      !globalFilter &&
      currentTrack &&
      playbackSource === 'playlist' &&
      playbackSourcePlaylistId === selectedPlaylistId
    ) {
      const playlistTrackIds = playlistTracks.map((t) => t.id);
      if (playlistTrackIds.includes(currentTrack.id)) {
        setTimeout(() => {
          scrollToTrack(currentTrack.id);
        }, 100);
      }
    }
  }, [
    globalFilter,
    sorting,
    updatePlaylistViewState,
    selectedPlaylistId,
    currentTrack,
    playbackSource,
    playbackSourcePlaylistId,
    playlistTracks,
    scrollToTrack,
  ]);

  // Handle search toggle
  const handleSearchToggle = useCallback(() => {
    setShowSearch((prev) => {
      if (prev) {
        setGlobalFilter('');
        globalFilterRef.current = '';
      }
      return !prev;
    });
  }, []);

  // Memoize playlist track count and hours for stable toolbar deps
  const playlistTrackCount = useMemo(
    () => playlistTracks.length,
    [playlistTracks],
  );
  const playlistTotalHours = useMemo(
    () => calculateTotalHours(playlistTracks),
    [playlistTracks],
  );

  // Mark table as ready after render completes
  useEffect(() => {
    const rafId = requestAnimationFrame(() => {
      tableReadyRef.current = true;
    });

    return () => {
      cancelAnimationFrame(rafId);
      tableReadyRef.current = false;
    };
  }, [sorting, globalFilter, data.length]);

  // Row event handlers
  const handleRowClick = useCallback(
    (row: Row<TableData>, index: number, e: React.MouseEvent) => {
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
    },
    [lastClickedIndex],
  );

  const handleRowDoubleClick = useCallback(
    (row: Row<TableData>, _index: number) => {
      handlePlayTrack(row.original.id);
      setSelectedTracks({ [row.original.id]: true });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedPlaylistId, sorting, globalFilter],
  );

  const handleRowContextMenu = useCallback(
    (row: Row<TableData>, _index: number, e: React.MouseEvent) => {
      const trackId = row.original.id;

      if (selectedTracks[trackId]) {
        handleContextMenu(e, trackId);
      } else {
        setSelectedTracks({ [trackId]: true });
        handleContextMenu(e, trackId);
      }
    },
    [selectedTracks],
  );

  const handleGetRowClassName = useCallback(
    (row: Row<TableData>, index: number) => {
      return getRowClassName(
        row.original.id,
        currentTrack?.id || undefined,
        Object.keys(selectedTracks),
        playbackSource || '',
        'playlist',
        playbackSourcePlaylistId || undefined,
        selectedPlaylistId || undefined,
        index,
      );
    },
    [
      currentTrack?.id,
      selectedTracks,
      playbackSource,
      playbackSourcePlaylistId,
      selectedPlaylistId,
    ],
  );

  // Column visibility toggle handler
  const handleColumnVisibilityToggle = useCallback(
    (columnId: string, visible: boolean) => {
      updateColumnVisibility(columnId, visible);
    },
    [updateColumnVisibility],
  );

  // Toolbar content
  const toolbarContent = useMemo(() => {
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
          height: '32px',
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
                {playlistTrackCount.toLocaleString()}&nbsp;&#9835;
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
                {playlistTotalHours}&nbsp;
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
          <SearchBar
            initialValue={globalFilterRef.current}
            onClose={handleSearchToggle}
            onDebouncedChange={handleDebouncedSearchChange}
            placeholder="Search playlist"
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
          <ColumnVisibilityMenu
            columns={columns}
            columnVisibility={
              (columnVisibility as unknown as Record<string, boolean>) || {}
            }
            onToggle={handleColumnVisibilityToggle}
          />
        </Box>
      </Box>
    );
  }, [
    drawerOpen,
    onDrawerToggle,
    selectedPlaylistId,
    isPlaylistNameScrolling,
    playlists,
    showSearch,
    playlistTrackCount,
    playlistTotalHours,
    handleSearchToggle,
    handleDebouncedSearchChange,
    columns,
    columnVisibility,
    handleColumnVisibilityToggle,
  ]);

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
    [drawerOpen],
  );

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
          <VirtualTable
            columns={columns}
            columnVisibility={
              (columnVisibility as unknown as Record<string, boolean>) || {}
            }
            data={data}
            emptyState={emptyStateContent}
            getRowClassName={handleGetRowClassName}
            globalFilter={globalFilter}
            onColumnVisibilityChange={handleColumnVisibilityToggle}
            onRowClick={handleRowClick}
            onRowContextMenu={handleRowContextMenu}
            onRowDoubleClick={handleRowDoubleClick}
            onSortingChange={setSorting}
            sorting={sorting}
            tableRef={tableRef}
            toolbar={toolbarContent}
            virtualizerRef={rowVirtualizerRef}
          />
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
