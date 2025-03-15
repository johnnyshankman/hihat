import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  LinearProgress,
} from '@mui/material';
import {
  MaterialReactTable,
  useMaterialReactTable,
  MRT_ColumnDef as MrtColumnDef,
  MRT_SortingState as MrtSortingState,
  MRT_VisibilityState as MrtVisibilityState,
} from 'material-react-table';
import { Updater } from '@tanstack/react-table';
import AddIcon from '@mui/icons-material/Add';
import { useLibraryStore, usePlaybackStore, useSettingsStore } from '../stores';
import TrackContextMenu from './TrackContextMenu';
import PlaylistSelectionDialog from './PlaylistSelectionDialog';
import SidebarToggle from './SidebarToggle';
import type { Channels } from '../../types/ipc';

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
  const scanLibrary = useLibraryStore((state) => state.scanLibrary);

  // Get state from settings store
  const settings = useSettingsStore((state) => state.settings);
  const updateColumnVisibility = useSettingsStore(
    (state) => state.updateColumnVisibility,
  );

  // Get state from playback store
  const currentTrack = usePlaybackStore((state) => state.currentTrack);
  const playbackSource = usePlaybackStore((state) => state.playbackSource);
  const playTrack = usePlaybackStore((state) => state.selectSpecificSong);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [scanningDialogOpen, setScanningDialogOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
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

  // Add a ref to track the last time we updated the UI for scan progress
  const lastUpdateTime = useRef(0);

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
      const shouldScan = window.confirm(
        'Library path has been set. Would you like to scan the library now?',
      );

      if (shouldScan) {
        // Reset scan state
        setScanProgress(0);
        setScanStatus('');
        setScanningDialogOpen(true);

        // Start the scan
        try {
          await scanLibrary(libraryPath);
        } catch (error) {
          console.error('Error scanning library:', error);
          setScanStatus('Failed');
        }
      }
    } catch (error) {
      console.error('Error selecting folder:', error);
    }
  };

  const handleAddMusic = async () => {
    try {
      // First, check if a library path is set
      const localSettings = await window.electron.settings.get();
      if (!localSettings || !localSettings.libraryPath) {
        // No library path set, show the dialog to set one
        window.alert('Please set a library path first before adding music.');
        setDialogOpen(true);
        return;
      }

      // Open a file selection dialog to select music files
      const result = await window.electron.dialog.selectFiles();
      if (
        result.canceled ||
        !result.filePaths ||
        result.filePaths.length === 0
      ) {
        return;
      }

      // Reset scan state
      setScanProgress(0);
      setScanStatus('');
      setScanningDialogOpen(true);

      // Import the selected files
      try {
        await window.electron.library.import(result.filePaths);
      } catch (error) {
        console.error('Error importing files:', error);
        setScanStatus('Failed');
      }
    } catch (error) {
      console.error('Error adding music:', error);
    }
  };

  // Listen for scan progress events
  useEffect(() => {
    // Throttle updates to once every 1000ms (1 second)
    const updateThreshold = 1000; // milliseconds

    const handleScanProgress = (...args: unknown[]) => {
      const data = args[0] as {
        total: number;
        processed: number;
        current: string;
      };

      const now = Date.now();
      // Only update the UI if enough time has passed since the last update
      // or if this is the first file, every 50th file, or the last file
      if (
        now - lastUpdateTime.current > updateThreshold ||
        data.processed === 1 ||
        data.processed % 50 === 0 ||
        data.processed === data.total
      ) {
        setScanProgress(data.processed / data.total);
        setScanStatus(data.current);
        lastUpdateTime.current = now;
      }
    };

    const handleScanComplete = () => {
      setScanStatus('Complete');
    };

    // Register event listeners
    const unsubScanProgress = window.electron.ipcRenderer.on(
      'library:scanProgress' as Channels,
      handleScanProgress,
    );

    const unsubScanComplete = window.electron.ipcRenderer.on(
      'library:scanComplete' as Channels,
      handleScanComplete,
    );

    // Clean up event listeners
    return () => {
      unsubScanProgress();
      unsubScanComplete();
    };
  }, []);

  const handleCloseScanningDialog = () => {
    // Only allow closing if scan is complete or there was an error
    if (scanStatus === 'Complete' || scanStatus === 'Failed') {
      setScanningDialogOpen(false);
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
      },
      {
        accessorKey: 'artist',
        header: 'Artist',
        size: 200,
        sortingFn: (rowA, rowB) => {
          // First sort by albumArtist
          const albumArtistA = rowA.original.albumArtist || '';
          const albumArtistB = rowB.original.albumArtist || '';

          if (albumArtistA !== albumArtistB) {
            return albumArtistA.localeCompare(albumArtistB);
          }

          // Then sort by album
          const albumA = rowA.original.album || '';
          const albumB = rowB.original.album || '';

          if (albumA !== albumB) {
            return albumA.localeCompare(albumB);
          }

          // Finally sort by track number
          const trackNumberA = rowA.original.trackNumber || 0;
          const trackNumberB = rowB.original.trackNumber || 0;

          return trackNumberA - trackNumberB;
        },
      },
      {
        accessorKey: 'album',
        header: 'Album',
        size: 200,
        sortingFn: (rowA, rowB) => {
          // First sort by album alphabetically
          const albumA = rowA.original.album || '';
          const albumB = rowB.original.album || '';

          if (albumA !== albumB) {
            return albumA.localeCompare(albumB);
          }

          // Then sort by track number within the same album
          const trackNumberA = rowA.original.trackNumber || 0;
          const trackNumberB = rowB.original.trackNumber || 0;

          return trackNumberA - trackNumberB;
        },
      },
      {
        accessorKey: 'genre',
        header: 'Genre',
        size: 120,
      },
      {
        accessorKey: 'duration',
        header: 'Duration',
        size: 80,
        Cell: ({ cell }) => formatDurationFromSeconds(cell.getValue<number>()),
      },
      {
        accessorKey: 'playCount',
        header: 'Play Count',
        size: 80,
      },
      {
        accessorKey: 'dateAdded',
        header: 'Date Added',
        size: 120,
        Cell: ({ cell }) => {
          const date = cell.getValue<string>();
          return date ? new Date(date).toLocaleDateString() : '';
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
    [],
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

  // Update the renderTopToolbarCustomActions function to include the SidebarToggle
  const renderTopToolbarCustomActions = () => (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <SidebarToggle isOpen={drawerOpen} onToggle={onDrawerToggle} />
      <Typography sx={{ mr: 2 }} variant="h1">
        Library
      </Typography>
      <Button
        onClick={handleAddMusic}
        size="small"
        startIcon={<AddIcon />}
        variant="outlined"
      >
        Add Music
      </Button>
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
    // muiTableContainerProps: {
    //   sx: {
    //     height: '100%',
    //     width: '100%',
    //     overflow: 'auto',
    //     display: 'flex',
    //     flexDirection: 'column',
    //     padding: 0,
    //     margin: 0,
    //   },
    // },
    // muiTablePaperProps: {
    //   sx: {
    //     height: '100%',
    //     width: '100%',
    //     display: 'flex',
    //     flexDirection: 'column',
    //     boxShadow: 'none',
    //     borderRadius: 0,
    //     overflow: 'hidden',
    //   },
    // },
    muiTableProps: {
      sx: {
        width: '100%',
        tableLayout: 'fixed', // Force table to respect container width
        height: 'auto', // Don't expand to fill container
      },
    },
    // Make sure the table header stays fixed when scrolling
    muiTableHeadProps: {
      sx: {
        position: 'sticky',
        top: 0,
        zIndex: 1,
        backgroundColor: (theme) => theme.palette.background.paper, // Add solid background color
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
        ...((settings?.columns as unknown as MrtVisibilityState) || {}),
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

  const getScanStatusText = () => {
    if (scanStatus === 'Failed') return 'Scan Failed';
    if (scanStatus === 'Complete') return 'Scan Complete';
    return 'Scanning Library...';
  };

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
        }}
      >
        <MaterialReactTable table={table} />
      </Box>

      {/* Library scan dialog */}
      <Dialog onClose={handleCloseDialog} open={dialogOpen}>
        <DialogTitle>Scan Library</DialogTitle>
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

      {/* Scanning progress dialog */}
      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={handleCloseScanningDialog}
        open={scanningDialogOpen}
      >
        <DialogTitle>Scanning Library</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography gutterBottom variant="body1">
              {getScanStatusText()}
            </Typography>
            <LinearProgress
              sx={{ mt: 2 }}
              value={scanProgress}
              variant="determinate"
            />
            <Typography sx={{ mt: 1 }} variant="body2">
              {scanStatus}
            </Typography>
          </Box>
          {scanStatus === 'Complete' && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: 'background.default',
                maxHeight: '150px',
                overflow: 'auto',
                mb: 2,
              }}
            >
              <Typography
                component="div"
                sx={{ fontFamily: 'monospace' }}
                variant="body2"
              >
                {scanStatus}
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            disabled={scanStatus !== 'Complete' && scanStatus !== 'Failed'}
            onClick={handleCloseScanningDialog}
          >
            {scanStatus === 'Complete' || scanStatus === 'Failed'
              ? 'Close'
              : 'Scanning...'}
          </Button>
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
