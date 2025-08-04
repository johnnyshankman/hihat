import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { Box, Typography } from '@mui/material';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_SortingState as MrtSortingState,
  type MRT_VisibilityState as MrtVisibilityState,
  type MRT_RowVirtualizer as MrtRowVirtualizer,
} from 'material-react-table';
import Marquee from 'react-fast-marquee';
import {
  useLibraryStore,
  useSettingsAndPlaybackStore,
  useUIStore,
} from '../stores';
import { Track } from '../../types/dbTypes';
import TrackContextMenu from './TrackContextMenu';
import MultiSelectContextMenu from './MultiSelectContextMenu';
import PlaylistSelectionDialog from './PlaylistSelectionDialog';
import SidebarToggle from './SidebarToggle';
import {
  getCommonTableConfig,
  getCommonColumnVisibilityHandler,
  getCommonRowStyling,
  getCommonColumnDefs,
  type TableData,
} from '../utils/tableConfig';
import { getFilteredAndSortedTrackIds } from '../utils/trackSelectionUtils';

// Define props interface for Playlists component
interface PlaylistsProps {
  drawerOpen: boolean;
  onDrawerToggle: () => void;
}

export default function Playlists({
  drawerOpen,
  onDrawerToggle,
}: PlaylistsProps) {
  // Get state from library store
  const playlists = useLibraryStore((state) => state.playlists);
  const tracks = useLibraryStore((state) => state.tracks);
  const selectedPlaylistId = useLibraryStore(
    (state) => state.selectedPlaylistId,
  );
  const updatePlaylistViewState = useLibraryStore(
    (state) => state.updatePlaylistViewState,
  );

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

  const [sorting, setSorting] = useState<MrtSortingState>([
    {
      id: 'artist',
      desc: false,
    },
  ]);

  // Global filter state for search
  const [globalFilter, setGlobalFilter] = useState('');

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

  // Add row virtualizer ref
  const rowVirtualizerRef = useRef<MrtRowVirtualizer>(null);

  // Local state for marquee scrolling
  const [isPlaylistNameScrolling, setIsPlaylistNameScrolling] = useState(false);

  // Refs for playlist name elements
  const playlistNameRef = useRef<HTMLDivElement>(null);
  const playlistNameRef2 = useRef<HTMLDivElement>(null);

  // Define getPlaylistTracks as a useCallback to use it in dependencies
  const getPlaylistTracks = useCallback(() => {
    if (!selectedPlaylistId || !playlists || !tracks) {
      return [];
    }

    const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
    if (!selectedPlaylist) {
      return [];
    }

    // If it's a smart playlist, we would apply the rules here
    // For now, just return the tracks in the playlist
    return selectedPlaylist.trackIds
      .map((id) => tracks.find((t) => t.id === id))
      .filter((track: Track | undefined): track is Track => !!track);
  }, [selectedPlaylistId, playlists, tracks]);

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
  const handleSingleTrackRemoveFromPlaylist = async (trackId: string) => {
    if (!selectedPlaylistId) return;

    const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
    if (!selectedPlaylist || selectedPlaylist.isSmart) {
      return;
    }

    const track = tracks.find((t) => t.id === trackId);
    const confirmMessage = `Are you sure you want to remove "${track?.title}" from "${selectedPlaylist.name}"?`;
    // eslint-disable-next-line no-alert
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // Get the showNotification function from the UI store
      const { showNotification } = useUIStore.getState();

      // Remove the track from the playlist
      const updatedPlaylist = {
        ...selectedPlaylist,
        trackIds: selectedPlaylist.trackIds.filter((id) => id !== trackId),
      };

      // Update the playlist
      await window.electron.playlists.update(updatedPlaylist);

      // Reload playlists to reflect changes
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
  };

  // Multi-select handlers
  const handleMultiSelectRemoveFromPlaylist = async () => {
    const selectedTrackIds = Object.keys(selectedTracks);
    if (selectedTrackIds.length === 0 || !selectedPlaylistId) return;

    const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
    if (!selectedPlaylist || selectedPlaylist.isSmart) {
      return;
    }

    const confirmMessage = `Are you sure you want to remove ${selectedTrackIds.length} track${selectedTrackIds.length > 1 ? 's' : ''} from "${selectedPlaylist.name}"?`;
    // eslint-disable-next-line no-alert
    if (!window.confirm(confirmMessage)) {
      return;
    }

    try {
      // Get the showNotification function from the UI store
      const { showNotification } = useUIStore.getState();

      // Remove the selected tracks from the playlist
      const updatedPlaylist = {
        ...selectedPlaylist,
        trackIds: selectedPlaylist.trackIds.filter(
          (id) => !selectedTrackIds.includes(id),
        ),
      };

      // Update the playlist
      await window.electron.playlists.update(updatedPlaylist);

      // Reload playlists to reflect changes
      await useLibraryStore.getState().loadPlaylists();

      // Clear selection after removal
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

      // Get the filtered and sorted track IDs based on current view state
      const trackIds = getFilteredAndSortedTrackIds('playlist');

      // Find the index of the track in the filtered and sorted list
      const trackIndex = trackIds.indexOf(trackId);

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

  // Expose the scrollToTrack function to the window object
  useEffect(() => {
    // @ts-ignore - Adding custom property to window
    window.hihatScrollToPlaylistTrack = scrollToTrack;

    return () => {
      // @ts-ignore - Cleanup
      delete window.hihatScrollToPlaylistTrack;
    };
  }, [scrollToTrack]);

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
  const columns = useMemo(() => getCommonColumnDefs(sorting), [sorting]);

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

  // Create a renderTopToolbarCustomActions function for the main table
  const renderTopToolbarCustomActions = () => {
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
          height: '47px',
          pl: '0',
          flexShrink: 0,
        }}
      >
        <SidebarToggle isOpen={drawerOpen} onToggle={onDrawerToggle} />
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Typography
            sx={{
              maxWidth: window.innerWidth < 768 ? '200px' : '400px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              mr: 1,
              userSelect: 'none',
            }}
            variant="h2"
          >
            {playlistNameContent}
          </Typography>
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
      setGlobalFilter(newFilter);
      updatePlaylistViewState(sorting, newFilter, selectedPlaylistId);
    },
    onColumnVisibilityChange: getCommonColumnVisibilityHandler(
      columnVisibility as unknown as Record<string, boolean>,
      updateColumnVisibility,
    ),
    muiSearchTextFieldProps: {
      ...getCommonTableConfig(drawerOpen).muiSearchTextFieldProps,
      placeholder: 'Search playlist',
    },
    onRowSelectionChange: () => {
      // do absolutely nothing, we handle this manually
    },
    muiTableBodyRowProps: ({ row, table: tableInstance }) => {
      // Get the current visible rows
      const visibleRows = tableInstance.getRowModel().rows;
      const currentIndex = visibleRows.findIndex(
        (r) => r.original.id === row.original.id,
      );

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
        ),
      };
    },
    renderTopToolbarCustomActions,
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
    </Box>
  );
}
