import React, {
  useCallback,
  useMemo,
  useState,
  useRef,
  useEffect,
} from 'react';
import { Box, Typography } from '@mui/material';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef as MrtColumnDef,
  type MRT_SortingState as MrtSortingState,
  type MRT_VisibilityState as MrtVisibilityState,
  type MRT_RowVirtualizer as MrtRowVirtualizer,
} from 'material-react-table';
import type { Updater } from '@tanstack/react-table';
import { useLibraryStore, usePlaybackStore, useSettingsStore } from '../stores';
import { Track } from '../../types/dbTypes';
import TrackContextMenu from './TrackContextMenu';
import PlaylistSelectionDialog from './PlaylistSelectionDialog';
import SidebarToggle from './SidebarToggle';
import {
  sortByTitle,
  sortByArtist,
  sortByAlbum,
  sortByGenre,
  sortByDuration,
  sortByPlayCount,
  sortByDateAdded,
} from '../utils/sortingFunctions';

// Custom formatter for duration in seconds
const formatDurationFromSeconds = (seconds: number): string => {
  if (
    seconds === undefined ||
    seconds === null ||
    Number.isNaN(seconds) ||
    seconds < 0
  ) {
    return '0:00';
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Define the type for our table data
interface TableData {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  playCount: number;
  dateAdded?: string;
  albumArtist: string;
  trackNumber: number | null;
}

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
  const settings = useSettingsStore((state) => state.settings);
  const updateColumnVisibility = useSettingsStore(
    (state) => state.updateColumnVisibility,
  );

  // Get state and actions from playback store
  const currentTrack = usePlaybackStore((state) => state.currentTrack);
  const playbackSource = usePlaybackStore((state) => state.playbackSource);
  const playTrack = usePlaybackStore((state) => state.selectSpecificSong);

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

  // Add row virtualizer ref
  const rowVirtualizerRef = useRef<MrtRowVirtualizer>(null);

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
      .filter((track): track is Track => !!track);
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

    // Play the track with 'playlist' as the source
    playTrack(trackId, 'playlist');
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

  // Handle column visibility change
  const handleColumnVisibilityChange = (
    updaterOrValue: Updater<MrtVisibilityState>,
  ) => {
    // Find which column changed by comparing with settings
    if (!settings || !settings.columns) return;

    // Get the updated visibility state
    let updatedColumnVisibility: MrtVisibilityState;

    if (typeof updaterOrValue === 'function') {
      // If it's a function, call it with the current visibility
      const currentMrtVisibility =
        settings.columns as unknown as MrtVisibilityState;
      updatedColumnVisibility = updaterOrValue(currentMrtVisibility);
    } else {
      // If it's a value, use it directly
      updatedColumnVisibility = updaterOrValue;
    }

    const currentVisibility = settings.columns;

    // Find the column that changed
    Object.keys(updatedColumnVisibility).forEach((column) => {
      const isCurrentlyVisible =
        !!currentVisibility[column as keyof typeof currentVisibility];
      const willBeVisible = !!updatedColumnVisibility[column];

      // Only update if there's a change
      if (isCurrentlyVisible !== willBeVisible) {
        // Update this column in settings
        updateColumnVisibility(column, willBeVisible);
      }
    });
  };

  // Function to scroll to a specific track by ID
  const scrollToTrack = useCallback(
    (trackId: string) => {
      if (!rowVirtualizerRef.current || !playlistTracks) return;

      const trackIndex = playlistTracks.findIndex(
        (track) => track.id === trackId,
      );
      if (trackIndex !== -1) {
        // Scroll to the track
        rowVirtualizerRef.current.scrollToIndex(trackIndex);

        // Add visual feedback by adding a class to the row
        setTimeout(() => {
          const row = document.querySelector(`[data-track-id="${trackId}"]`);
          if (row) {
            // Add a highlight class
            row.classList.add('highlight-row');

            // Remove the class after animation completes
            setTimeout(() => {
              row.classList.remove('highlight-row');
            }, 2000);
          }
        }, 200); // Wait for the scroll to complete
      }
    },
    [playlistTracks],
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

  // Define columns for Material React Table
  const columns = useMemo<MrtColumnDef<TableData>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        size: 350,
        sortingFn: (rowA, rowB, _columnId) => {
          const columnSorting = sorting.find((sort) => sort.id === 'title');
          const isDescending = columnSorting ? columnSorting.desc : false;
          return sortByTitle(rowA.original, rowB.original, isDescending);
        },
      },
      {
        accessorKey: 'artist',
        header: 'Artist',
        size: 200,
        sortingFn: (rowA, rowB, _columnId) => {
          const columnSorting = sorting.find((sort) => sort.id === 'artist');
          const isDescending = columnSorting ? columnSorting.desc : false;
          return sortByArtist(rowA.original, rowB.original, isDescending);
        },
      },
      {
        accessorKey: 'album',
        header: 'Album',
        size: 200,
        sortingFn: (rowA, rowB, _columnId) => {
          const columnSorting = sorting.find((sort) => sort.id === 'album');
          const isDescending = columnSorting ? columnSorting.desc : false;
          return sortByAlbum(rowA.original, rowB.original, isDescending);
        },
      },
      {
        accessorKey: 'genre',
        header: 'Genre',
        size: 120,
        sortingFn: (rowA, rowB, _columnId) => {
          const columnSorting = sorting.find((sort) => sort.id === 'genre');
          const isDescending = columnSorting ? columnSorting.desc : false;
          return sortByGenre(rowA.original, rowB.original, isDescending);
        },
      },
      {
        accessorKey: 'duration',
        header: 'Duration',
        size: 80,
        Cell: ({ cell }) => formatDurationFromSeconds(cell.getValue<number>()),
        sortingFn: (rowA, rowB, _columnId) => {
          const columnSorting = sorting.find((sort) => sort.id === 'duration');
          const isDescending = columnSorting ? columnSorting.desc : false;
          return sortByDuration(rowA.original, rowB.original, isDescending);
        },
      },
      {
        accessorKey: 'playCount',
        header: 'Plays',
        size: 80,
        sortingFn: (rowA, rowB, _columnId) => {
          const columnSorting = sorting.find((sort) => sort.id === 'playCount');
          const isDescending = columnSorting ? columnSorting.desc : false;
          return sortByPlayCount(rowA.original, rowB.original, isDescending);
        },
      },
      {
        accessorKey: 'dateAdded',
        header: 'Date Added',
        size: 120,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? new Date(date).toLocaleDateString() : '';
        },
        sortingFn: (rowA, rowB, _columnId) => {
          const columnSorting = sorting.find((sort) => sort.id === 'dateAdded');
          const isDescending = columnSorting ? columnSorting.desc : false;
          return sortByDateAdded(rowA.original, rowB.original, isDescending);
        },
      },
    ],
    [sorting], // Add sorting as a dependency
  );

  // Prepare data for Material React Table
  const data = useMemo<TableData[]>(() => {
    return playlistTracks.map((track) => {
      // Ensure duration is a number and not undefined/null
      let duration = 0;
      if (typeof track.duration === 'number') {
        duration = track.duration;
      } else if (track.duration) {
        // Try to convert to number if it's a string or other type
        duration = Number(track.duration);
      }

      return {
        id: track.id || '',
        title: track.title || 'Unknown Title',
        artist: track.artist || 'Unknown Artist',
        album: track.album || 'Unknown Album',
        genre: track.genre || 'Unknown Genre',
        // Set the duration value
        duration,
        playCount: typeof track.playCount === 'number' ? track.playCount : 0,
        dateAdded: track.dateAdded,
        albumArtist: track.albumArtist || 'Unknown Album Artist',
        trackNumber: track.trackNumber || null,
      };
    });
  }, [playlistTracks]);

  // Create a renderTopToolbarCustomActions function for the main table
  const renderTopToolbarCustomActions = () => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', height: '40px' }}>
      <SidebarToggle isOpen={drawerOpen} onToggle={onDrawerToggle} />
      <Typography variant="h3">
        {selectedPlaylistId
          ? `${
              playlists.find((p) => p.id === selectedPlaylistId)?.name ||
              'Playlist'
            } (${playlistTracks.length} tracks)`
          : 'Playlists'}
      </Typography>
    </Box>
  );

  // Configure the table
  const table = useMaterialReactTable({
    columns,
    data,
    enablePagination: false, // Disable pagination for infinite scrolling
    enableBottomToolbar: false, // Hide bottom toolbar (pagination controls)
    enableColumnResizing: true,
    enableSorting: true,
    enableColumnFilters: true,
    enableGlobalFilter: true,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableRowVirtualization: true, // Enable virtualization for better performance
    rowVirtualizerOptions: { overscan: 20 }, // Increase overscan for smoother scrolling
    rowVirtualizerInstanceRef: rowVirtualizerRef, // Add the row virtualizer ref
    state: {
      sorting,
      globalFilter,
      columnVisibility: {
        ...((settings?.columns as unknown as MrtVisibilityState) || {}),
      },
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);
      // Update the playlist view state in the context
      updatePlaylistViewState(newSorting, globalFilter, selectedPlaylistId);
    },
    onGlobalFilterChange: (updater) => {
      const newFilter =
        typeof updater === 'function' ? updater(globalFilter) : updater;
      setGlobalFilter(newFilter);
      // Update the playlist view state in the context
      updatePlaylistViewState(sorting, newFilter, selectedPlaylistId);
    },
    onColumnVisibilityChange: handleColumnVisibilityChange,
    muiSearchTextFieldProps: {
      placeholder: 'Search library',
      variant: 'outlined',
    },
    muiTableContainerProps: {
      sx: {
        height: '100%',
        width: '100%',
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        padding: 0,
        margin: 0,
        backgroundColor: (theme) => theme.palette.background.default,
      },
    },
    muiTablePaperProps: {
      sx: {
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: 'none',
        borderRadius: 0,
        overflow: 'hidden',
        backgroundColor: (theme) => theme.palette.background.paper,
      },
    },
    muiTableProps: {
      sx: {
        width: '100%',
        tableLayout: 'fixed', // Force table to respect container width
        height: 'auto', // Don't expand to fill container
        backgroundColor: (theme) => theme.palette.background.default,
      },
    },
    // Make sure the table header stays fixed when scrolling
    muiTableHeadProps: {
      sx: {
        position: 'sticky',
        top: 0,
        zIndex: 1,
        backgroundColor: (theme) => theme.palette.background.default,
        opacity: 1.0,
      },
    },
    // Ensure the toolbar stays fixed
    muiTopToolbarProps: {
      sx: {
        position: 'sticky',
        top: 0,
        zIndex: 2,
        padding: '4px 8px', // Reduce padding in the toolbar
        width: '100%',
        backgroundColor: (theme) => theme.palette.background.default,
      },
    },
    // Remove padding from the table body and ensure it aligns to the top
    muiTableBodyProps: {
      sx: {
        '& td': { padding: '4px 0.5rem' }, // Reduce cell padding
        width: '100%',
        alignItems: 'flex-start', // Align content to the top
        display: 'table-row-group', // Use standard table row group display
      },
    },
    // Ensure the table body container doesn't center content vertically
    muiTableBodyCellProps: {
      sx: {
        verticalAlign: 'top', // Align cell content to the top
      },
    },
    layoutMode: 'grid', // Use grid layout mode for better control
    displayColumnDefOptions: {
      'mrt-row-expand': {
        size: 0, // Minimize any expansion space
      },
    },
    renderTopToolbarCustomActions,
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        handlePlayTrack(row.original.id);
      },
      onContextMenu: (e) => handleContextMenu(e, row.original.id),
      'data-track-id': row.original.id,
      sx: {
        cursor: 'pointer',
        backgroundColor: (theme) => theme.palette.background.default,
        borderBottom: '1px solid',
        borderColor: (theme) => theme.palette.divider,
        // Highlight the currently playing track if it's from the library
        ...(currentTrack?.id === row.original.id &&
          playbackSource === 'playlist' && {
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark'
                ? theme.palette.grey[800]
                : theme.palette.grey[400],
            '&:hover': {
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark'
                  ? theme.palette.grey[700]
                  : theme.palette.grey[300],
            },
          }),
        '&:hover': {
          backgroundColor: 'rgba(255, 255, 255, 0.05)', // Subtle hover effect for non-selected rows
        },
      },
    }),
    defaultDisplayColumn: { size: 150 },
    initialState: {
      density: 'compact',
      columnVisibility: {
        // Hide less important columns on smaller screens
        genre: window.innerWidth > 1200,
        playCount: window.innerWidth > 1000,
        dateAdded: window.innerWidth > 1400,
      },
    },
    renderEmptyRowsFallback: () => (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 4,
          height: '50vh',
          width: '100%',
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
            overflow: 'hidden',
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
            p: 2,
            backgroundColor: (theme) => theme.palette.background.default,
          }}
        >
          <Typography sx={{ mt: 2 }} variant="body1">
            Select a playlist to view its tracks.
          </Typography>
        </Box>
      )}

      {/* Context menu */}
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
