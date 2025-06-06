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
} from '@mui/material';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_SortingState as MrtSortingState,
  type MRT_RowVirtualizer as MrtRowVirtualizer,
  type MRT_VisibilityState as MrtVisibilityState,
} from 'material-react-table';
import { useLibraryStore, useSettingsAndPlaybackStore } from '../stores';
import TrackContextMenu from './TrackContextMenu';
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

// Define the type for directory selection result
interface DirectorySelectionResult {
  canceled: boolean;
  filePaths: string[];
}

// Define props interface for Library component
interface LibraryProps {
  drawerOpen: boolean;
  _onDrawerToggle: () => void;
}

export default function Library({ drawerOpen, _onDrawerToggle }: LibraryProps) {
  // Get state from library store
  const tracks = useLibraryStore((state) => state.tracks);
  const updateLibraryViewState = useLibraryStore(
    (state) => state.updateLibraryViewState,
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

  // Get columns from shared configuration
  const columns = useMemo(() => getCommonColumnDefs(sorting), [sorting]);

  // Prepare data for Material React Table
  const data = useMemo<TableData[]>(() => {
    return tracks.map((track) => {
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
  }, [tracks]);

  // Update the renderTopToolbarCustomActions function to include the SidebarToggle
  const renderTopToolbarCustomActions = () => {
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
        <SidebarToggle isOpen={drawerOpen} onToggle={_onDrawerToggle} />
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
            }}
            variant="h2"
          >
            Library
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
            }}
          >
            <Typography
              sx={{
                color: (theme) => theme.palette.text.secondary,
                lineHeight: 1,
              }}
              variant="body2"
            >
              {tracks.length.toLocaleString()}&nbsp;♫
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
      updateLibraryViewState(newSorting, globalFilter);
    },
    onGlobalFilterChange: (updater) => {
      const newFilter =
        typeof updater === 'function' ? updater(globalFilter) : updater;
      setGlobalFilter(newFilter);
      updateLibraryViewState(sorting, newFilter);
    },
    onColumnVisibilityChange: getCommonColumnVisibilityHandler(
      columnVisibility as unknown as Record<string, boolean>,
      updateColumnVisibility,
    ),
    muiSearchTextFieldProps: {
      ...getCommonTableConfig(drawerOpen).muiSearchTextFieldProps,
      placeholder: 'Search library',
    },
    muiTableBodyRowProps: ({ row }) => ({
      onClick: () => {
        handlePlayTrack(row.original.id);
      },
      onContextMenu: (e) => handleContextMenu(e, row.original.id),
      'data-track-id': row.original.id,
      sx: getCommonRowStyling(
        row.original.id,
        currentTrack?.id || undefined,
        playbackSource || '',
        'library',
      ),
    }),
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

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden', // Changed from 'auto' to 'hidden' to prevent scrollbar conflicts
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
          display: 'flex', // Add display flex
          flexDirection: 'column', // Add flex direction column
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
