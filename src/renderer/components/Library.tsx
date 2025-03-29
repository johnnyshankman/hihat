import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
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
} from '@mui/material';
import {
  MaterialReactTable,
  useMaterialReactTable,
  MRT_ColumnDef as MrtColumnDef,
  MRT_SortingState as MrtSortingState,
  MRT_VisibilityState as MrtVisibilityState,
  type MRT_RowVirtualizer as MrtRowVirtualizer,
} from 'material-react-table';
import { Updater } from '@tanstack/react-table';
import { useLibraryStore, usePlaybackStore, useSettingsStore } from '../stores';
import TrackContextMenu from './TrackContextMenu';
import PlaylistSelectionDialog from './PlaylistSelectionDialog';
import SidebarToggle from './SidebarToggle';
import { getFilteredAndSortedTrackIds } from '../utils/trackSelectionUtils';
import {
  sortByTitle,
  sortByArtist,
  sortByAlbum,
  sortByGenre,
  sortByDuration,
  sortByPlayCount,
  sortByDateAdded,
  sortByLastPlayed,
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
  lastPlayed?: string;
  albumArtist: string;
  trackNumber: number | null;
}

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

export default function Library({ drawerOpen, onDrawerToggle }: LibraryProps) {
  // Get state from library store
  const tracks = useLibraryStore((state) => state.tracks);
  const updateLibraryViewState = useLibraryStore(
    (state) => state.updateLibraryViewState,
  );
  // Get state from settings store
  const columnVisibility = useSettingsStore((state) => state.columns);
  const updateColumnVisibility = useSettingsStore(
    (state) => state.setColumnVisibility,
  );

  // Get state from playback store
  const currentTrack = usePlaybackStore((state) => state.currentTrack);
  const playbackSource = usePlaybackStore((state) => state.playbackSource);
  const playTrack = usePlaybackStore((state) => state.selectSpecificSong);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);

  // Global filter state for search
  const [globalFilter, setGlobalFilter] = useState('');

  // Sorting state
  const [sorting, setSorting] = useState<MrtSortingState>([
    {
      id: 'artist',
      desc: false,
    },
  ]);

  // Add row virtualizer ref
  const rowVirtualizerRef = useRef<MrtRowVirtualizer>(null);

  const handlePlayTrack = (trackId: string) => {
    // Play the track with 'library' as the source
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
      // eslint-disable-next-line no-alert
      const shouldScan = window.confirm(
        'Library path has been set. Would you like to scan the library now?',
      );

      if (shouldScan) {
        // Redirect user to Settings page for scanning
        // eslint-disable-next-line no-alert
        window.alert('Please go to Settings page to start the scan.');
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
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

  // Define columns for Material React Table
  const columns = useMemo<MrtColumnDef<TableData>[]>(
    () => [
      {
        accessorKey: 'title',
        header: 'Title',
        size: 350,
        sortingFn: (rowA, rowB, _columnId) => {
          // Get the current sorting state for this column
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
        header: 'Play Count',
        size: 80,
        sortingFn: (rowA, rowB, _columnId) => {
          const columnSorting = sorting.find((sort) => sort.id === 'playCount');
          const isDescending = columnSorting ? columnSorting.desc : false;
          return sortByPlayCount(rowA.original, rowB.original, isDescending);
        },
      },
      {
        accessorKey: 'lastPlayed',
        header: 'Last Played',
        size: 120,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? new Date(date).toLocaleDateString() : 'Never';
        },
        sortingFn: (rowA, rowB, _columnId) => {
          const columnSorting = sorting.find(
            (sort) => sort.id === 'lastPlayed',
          );
          const isDescending = columnSorting ? columnSorting.desc : false;
          return sortByLastPlayed(rowA.original, rowB.original, isDescending);
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
      {
        accessorKey: 'trackNumber',
        header: 'Track #',
        size: 80,
        enableHiding: true,
        enableColumnFilter: false,
        enableGlobalFilter: false,
        defaultHidden: true,
      },
    ],
    [sorting], // Add sorting as a dependency
  );

  // Prepare data for Material React Table
  const data = useMemo<TableData[]>(() => {
    return tracks.map((track) => {
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
        lastPlayed: track.lastPlayed || undefined,
        albumArtist: track.albumArtist || 'Unknown Album Artist',
        trackNumber: track.trackNumber || null,
      };
    });
  }, [tracks]);

  // Handle column visibility change
  const handleColumnVisibilityChange = (
    updaterOrValue: Updater<MrtVisibilityState>,
  ) => {
    // Find which column changed by comparing with settings
    if (!columnVisibility) return;

    // Get the updated visibility state
    let updatedColumnVisibility: MrtVisibilityState;

    if (typeof updaterOrValue === 'function') {
      // If it's a function, call it with the current visibility
      const currentMrtVisibility =
        columnVisibility as unknown as MrtVisibilityState;
      updatedColumnVisibility = updaterOrValue(currentMrtVisibility);
    } else {
      // If it's a value, use it directly
      updatedColumnVisibility = updaterOrValue;
    }

    const currentVisibility = columnVisibility;

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

  // Update the renderTopToolbarCustomActions function to include the SidebarToggle
  const renderTopToolbarCustomActions = () => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', height: '40px' }}>
      <SidebarToggle isOpen={drawerOpen} onToggle={onDrawerToggle} />
      <Typography variant="h3">Library</Typography>
    </Box>
  );

  // Function to scroll to a specific track by ID
  const scrollToTrack = useCallback(
    (trackId: string) => {
      if (!rowVirtualizerRef.current) return;

      // Get the filtered and sorted track IDs based on current view state
      const trackIds = getFilteredAndSortedTrackIds('library');

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
    window.hihatScrollToLibraryTrack = scrollToTrack;

    return () => {
      // @ts-ignore - Cleanup
      delete window.hihatScrollToLibraryTrack;
    };
  }, [scrollToTrack]);

  // Configure the table
  const table = useMaterialReactTable({
    columns,
    data,
    globalFilterFn: 'contains', // turn off fuzzy matching and use simple contains filter function which matches with what we have in @src/renderer/utils/trackSelectionUtils.ts
    enablePagination: false, // Disable pagination for infinite scrolling
    enableBottomToolbar: false, // Hide bottom toolbar (pagination controls)
    enableColumnResizing: true,
    enableSorting: true,
    enableColumnFilters: true,
    enableGlobalFilter: true,
    enableDensityToggle: false,
    enableFullScreenToggle: false,
    enableRowVirtualization: true, // Enable virtualization for better performance
    rowVirtualizerOptions: {
      overscan: 20,
    }, // Increase overscan for smoother scrolling
    rowVirtualizerInstanceRef: rowVirtualizerRef, // Use the correct prop name
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
    state: {
      globalFilter,
      sorting,
      columnVisibility: {
        ...((columnVisibility as unknown as MrtVisibilityState) || {}),
        trackNumber: false, // Always hide track number column
      },
    },
    onSortingChange: (updater) => {
      const newSorting =
        typeof updater === 'function' ? updater(sorting) : updater;
      setSorting(newSorting);
      // Update the library view state in the context
      updateLibraryViewState(newSorting, globalFilter);
    },
    onGlobalFilterChange: (updater) => {
      const newFilter =
        typeof updater === 'function' ? updater(globalFilter) : updater;
      setGlobalFilter(newFilter);
      // Update the library view state in the context
      updateLibraryViewState(sorting, newFilter);
    },
    onColumnVisibilityChange: handleColumnVisibilityChange,
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        const index = tracks.findIndex((track) => track.id === row.original.id);
        if (index !== -1) {
          handlePlayTrack(row.original.id);
        }
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
          playbackSource === 'library' && {
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
        trackNumber: false, // Always hide track number column
      },
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
          Head to Settings and point hihat to your music library folder.
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
    </Box>
  );
}
