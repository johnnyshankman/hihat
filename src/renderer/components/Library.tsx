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
import PeopleIcon from '@mui/icons-material/People';
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
import ConfirmationDialog from './ConfirmationDialog';
import SidebarToggle from './SidebarToggle';
import ArtistBrowser from './ArtistBrowser';
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
  const [sorting, setSorting] = useState<SortingState>(
    () => libraryViewState.sorting || [{ id: 'artist', desc: false }],
  );

  // Add row virtualizer ref
  const rowVirtualizerRef = useRef<Virtualizer<HTMLDivElement, Element> | null>(
    null,
  );

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
      let trackIndex = -1;

      if (tableRef.current) {
        const { rows } = tableRef.current.getRowModel();
        trackIndex = rows.findIndex((row) => row.original.id === trackId);
      }

      // Fallback to calculating the index if table isn't ready yet
      if (trackIndex === -1) {
        const trackIds = getFilteredAndSortedTrackIds('library', artistFilter);
        trackIndex = trackIds.indexOf(trackId);
      }

      if (trackIndex !== -1) {
        rowVirtualizerRef.current.scrollToIndex(trackIndex, {
          align: 'center',
        });
      }
    },
    [artistFilter],
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

  // Expose the scrollToTrack function to the window object
  useEffect(() => {
    // @ts-ignore - Adding custom property to window
    window.hihatScrollToLibraryTrack = scrollToTrackWhenReady;

    return () => {
      // @ts-ignore - Cleanup
      delete window.hihatScrollToLibraryTrack;
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
      const { showNotification } = useUIStore.getState();

      const currentTrackIds = getFilteredAndSortedTrackIds(
        'library',
        artistFilter,
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

  // Save the currently visible track on unmount
  useEffect(() => {
    const virtualizerRefCurrent = rowVirtualizerRef.current;
    return () => {
      if (virtualizerRefCurrent) {
        const visibleRange = virtualizerRefCurrent.range;

        if (visibleRange) {
          const middleIndex = Math.floor(
            (visibleRange.startIndex + visibleRange.endIndex) / 2,
          );

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
      setTimeout(() => {
        scrollToTrack(lastViewedTrackId);
      }, 100);
    }
  }, [lastViewedTrackId, scrollToTrack, tracks.length]);

  // Get columns from shared configuration
  const columns = useMemo(() => getCommonColumnDefs(), []);

  // Prepare data for the table with artist filtering
  const data = useMemo<TableData[]>(() => {
    let filteredTracks = tracks;

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
        setGlobalFilter('');
        globalFilterRef.current = '';
      }
      return !prev;
    });
  }, []);

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
    [handlePlayTrack],
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
    [selectedTracks, handleContextMenu],
  );

  const handleGetRowClassName = useCallback(
    (row: Row<TableData>, index: number) => {
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
    },
    [currentTrack?.id, selectedTracks, playbackSource],
  );

  // Column visibility toggle handler
  const handleColumnVisibilityToggle = useCallback(
    (columnId: string, visible: boolean) => {
      updateColumnVisibility(columnId, visible);
    },
    [updateColumnVisibility],
  );

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
                {trackCount.toLocaleString()}&nbsp;&#9835;
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
          <ColumnVisibilityMenu
            columns={columns}
            columnVisibility={
              (columnVisibility as unknown as Record<string, boolean>) || {}
            }
            onToggle={handleColumnVisibilityToggle}
          />
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
      </Box>
    ),
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
      columns,
      columnVisibility,
      handleColumnVisibilityToggle,
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
  return (
    prevProps.drawerOpen === nextProps.drawerOpen &&
    prevProps.onDrawerToggle === nextProps.onDrawerToggle
  );
});
