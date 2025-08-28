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
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_SortingState as MrtSortingState,
  type MRT_RowVirtualizer as MrtRowVirtualizer,
  type MRT_VisibilityState as MrtVisibilityState,
  // eslint-disable-next-line camelcase
  MRT_ToggleFiltersButton,
  // eslint-disable-next-line camelcase
  MRT_ShowHideColumnsButton,
  // eslint-disable-next-line camelcase
  MRT_ToggleGlobalFilterButton,
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
import SidebarToggle from './SidebarToggle';
import ArtistBrowser from './ArtistBrowser';
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

  const [dialogOpen, setDialogOpen] = useState(false);
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
  const [artistBrowserOpen, setArtistBrowserOpen] = useState(!!artistFilter);

  // Open artist browser when artist filter is set
  useEffect(() => {
    if (artistFilter && !artistBrowserOpen) {
      setArtistBrowserOpen(true);
    }
  }, [artistFilter, artistBrowserOpen]);

  // Handle artist browser toggle - clear selection when closing
  const handleArtistBrowserToggle = () => {
    const newOpenState = !artistBrowserOpen;
    setArtistBrowserOpen(newOpenState);

    // If closing the browser, reset to "All Artists"
    if (!newOpenState) {
      setArtistFilter(null);
    }
  };

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

      // Get the filtered and sorted track IDs based on current view state
      // Include artist filter for accurate positioning
      const trackIds = getFilteredAndSortedTrackIds('library', artistFilter);

      // Find the index of the track in the filtered and sorted list
      const trackIndex = trackIds.indexOf(trackId);

      console.log('scrollToTrack called with:', {
        trackId,
        trackIndex,
        totalTracks: trackIds.length,
        artistFilter,
      });

      if (trackIndex !== -1) {
        // Scroll to the track
        rowVirtualizerRef.current.scrollToIndex(trackIndex, {
          align: 'center',
        });
        console.log('Scrolled to index:', trackIndex);
      } else {
        console.log('Track not found in current view');
      }
    },
    [artistFilter],
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

  const handleMultiSelectDeleteTracks = async () => {
    const selectedTrackIds = Object.keys(selectedTracks);
    if (selectedTrackIds.length === 0) return;

    const confirmMessage = `Are you sure you want to delete ${selectedTrackIds.length} track${selectedTrackIds.length > 1 ? 's' : ''}? This will permanently delete the files from your computer.`;
    // eslint-disable-next-line no-alert
    if (!window.confirm(confirmMessage)) {
      return;
    }

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

        console.log('Target track for scrolling:', targetTrackId);
      }

      // Step 1: Get all playlists that might contain these tracks
      const allPlaylists = await window.electron.playlists.getAll();

      // For each selected track
      // eslint-disable-next-line no-restricted-syntax
      for (const trackId of selectedTrackIds) {
        const track = tracks.find((t) => t.id === trackId);
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
        {/* <LibraryMusicIcon
          sx={{
            fontSize: 20,
            color: 'text.secondary',
            ml: 1,
            alignSelf: 'center',
          }}
        /> */}
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
              {data.length.toLocaleString()}&nbsp;♫
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
      const oldFilter = globalFilter;
      setGlobalFilter(newFilter);
      updateLibraryViewState(sorting, newFilter);
      
      // When filter is cleared (from non-empty to empty), scroll to current track
      if (oldFilter && !newFilter && currentTrack && playbackSource === 'library') {
        // Check if the current track is visible with the current artist filter
        const visibleTrackIds = getFilteredAndSortedTrackIds('library', artistFilter);
        if (visibleTrackIds.includes(currentTrack.id)) {
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
    muiSearchTextFieldProps: {
      ...getCommonTableConfig(drawerOpen).muiSearchTextFieldProps,
      placeholder: 'Filter tracks',
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
          'library',
        ),
      };
    },
    renderTopToolbarCustomActions,
    renderToolbarInternalActions: ({ table: tableInstance }) => (
      <Box
        sx={{
          display: 'flex',
          gap: '2px',
          height: '100%',
          marginTop: '4px',
          alignItems: 'center',
          justifyContent: 'center',
          alignContent: 'center',
        }}
      >
        {/* eslint-disable-next-line react/jsx-pascal-case, camelcase */}
        <MRT_ToggleGlobalFilterButton table={tableInstance} />
        {/* eslint-disable-next-line react/jsx-pascal-case, camelcase */}
        <MRT_ToggleFiltersButton table={tableInstance} />
        {/* eslint-disable-next-line react/jsx-pascal-case, camelcase */}
        <MRT_ShowHideColumnsButton table={tableInstance} />
        <Tooltip
          title={
            artistBrowserOpen ? 'Hide artist browser' : 'Show artist browser'
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
    ),
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
