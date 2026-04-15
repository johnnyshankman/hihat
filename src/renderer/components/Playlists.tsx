import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { keyframes } from '@mui/system';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import SearchOffRoundedIcon from '@mui/icons-material/SearchOffRounded';
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
import EditMetadataDialog from './EditMetadataDialog';
import ConfirmationDialog from './ConfirmationDialog';
import SidebarToggle from './SidebarToggle';
import Browser from './Browser';
import SearchBar from './SearchBar';
import VirtualTable from './VirtualTable';
import NotificationButton from './NotificationButton';
import MaterialSymbolIcon from './MaterialSymbolIcon';
import {
  getRowClassName,
  getCommonColumnDefs,
  type TableData,
} from '../utils/tableConfig';
import { getFilteredAndSortedTrackIds } from '../utils/trackSelectionUtils';
import { calculateTotalHours } from '../utils/formatters';

const searchExpandAnimation = keyframes`
  from {
    max-width: 0;
    opacity: 0;
  }
  to {
    max-width: 600px;
    opacity: 1;
  }
`;

// Stable module-level default so selector fallbacks return the same
// reference on every render, preventing spurious Zustand re-renders.
const DEFAULT_PLAYLIST_SORTING: SortingState = [
  { id: 'albumArtist', desc: false },
];

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
  const setPlaylistSortPreference = useLibraryStore(
    (state) => state.setPlaylistSortPreference,
  );
  const setSearchFilter = useLibraryStore((state) => state.setSearchFilter);

  // Read via selectors; setPlaylistSortPreference and setSearchFilter
  // fan out to playlistViewState, so this component just writes.
  const sorting = useLibraryStore((state) => {
    const pid = state.selectedPlaylistId;
    if (!pid) return DEFAULT_PLAYLIST_SORTING;
    return state.playlistSortPreferences[pid] ?? DEFAULT_PLAYLIST_SORTING;
  });
  const globalFilter = useLibraryStore((state) => {
    const pid = state.selectedPlaylistId;
    if (!pid) return '';
    return state.searchFilters[pid] ?? '';
  });

  // Get state from settings store
  const columnVisibility = useSettingsAndPlaybackStore(
    (state) => state.columns,
  );
  const updateColumnVisibility = useSettingsAndPlaybackStore(
    (state) => state.setColumnVisibility,
  );
  const columnWidths = useSettingsAndPlaybackStore(
    (state) => state.columnWidths,
  );
  const setColumnWidths = useSettingsAndPlaybackStore(
    (state) => state.setColumnWidths,
  );
  const columnOrder = useSettingsAndPlaybackStore((state) => state.columnOrder);
  const setColumnOrder = useSettingsAndPlaybackStore(
    (state) => state.setColumnOrder,
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

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  // Playlist selection dialog state
  const [playlistDialogOpen, setPlaylistDialogOpen] = useState(false);
  const [editMetadataTrackId, setEditMetadataTrackId] = useState<string | null>(
    null,
  );

  // Multi-select state
  const [selectedTracks, setSelectedTracks] = useState<Record<string, boolean>>(
    {},
  );
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  // Search bar visibility. Initialized from store, then reset on every
  // playlist switch via the "adjusting some state when a prop changes"
  // pattern below — React docs explicitly recommend this over an effect.
  const [showSearch, setShowSearch] = useState(() => {
    const pid = useLibraryStore.getState().selectedPlaylistId;
    if (!pid) return false;
    return !!useLibraryStore.getState().searchFilters[pid];
  });
  const [lastSeenPlaylistId, setLastSeenPlaylistId] =
    useState(selectedPlaylistId);
  if (lastSeenPlaylistId !== selectedPlaylistId) {
    setLastSeenPlaylistId(selectedPlaylistId);
    setShowSearch(!!globalFilter);
  }

  // Browser state
  const browserOpen = useUIStore((state) => state.browserOpen);
  const setBrowserOpen = useUIStore((state) => state.setBrowserOpen);
  const browserFilters = useLibraryStore((state) => state.browserFilters);
  const setBrowserFilter = useLibraryStore((state) => state.setBrowserFilter);
  const [browserHeight, setBrowserHeight] = useState(200);

  // Derive browser filter scalars for the currently-selected playlist
  // directly from the browser filter dictionary. No useMemo: primitives
  // are compared by value downstream.
  const playlistArtistFilter = selectedPlaylistId
    ? (browserFilters[selectedPlaylistId]?.artist ?? null)
    : null;
  const playlistAlbumFilter = selectedPlaylistId
    ? (browserFilters[selectedPlaylistId]?.album ?? null)
    : null;

  const handleBrowserArtistSelect = useCallback(
    (artist: string | null) => {
      if (selectedPlaylistId) {
        setBrowserFilter(selectedPlaylistId, { artist, album: null });
      }
    },
    [selectedPlaylistId, setBrowserFilter],
  );

  const handleBrowserAlbumSelect = useCallback(
    (album: string | null) => {
      if (selectedPlaylistId) {
        setBrowserFilter(selectedPlaylistId, {
          artist: playlistArtistFilter,
          album,
        });
      }
    },
    [selectedPlaylistId, setBrowserFilter, playlistArtistFilter],
  );

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

  // useMemo: playlist lookup + O(n) getTracksByIds via the trackIndex map.
  const playlistTracks = useMemo(() => {
    if (!selectedPlaylistId || !playlists) return [];
    const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId);
    if (!selectedPlaylist) return [];
    return useLibraryStore.getState().getTracksByIds(selectedPlaylist.trackIds);
  }, [selectedPlaylistId, playlists]);

  const handlePlayTrack = (trackId: string) => {
    // No manual updatePlaylistViewState call needed — the store keeps
    // playlistViewState in sync via selectPlaylist / setSearchFilter /
    // setPlaylistSortPreference fan-outs.
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

  const handleEditMetadata = (trackId: string) => {
    setEditMetadataTrackId(trackId);
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

  // Expose the scrollToTrack function to the window object.
  useEffect(() => {
    window.hihatScrollToPlaylistTrack = scrollToTrackWhenReady;
    return () => {
      delete window.hihatScrollToPlaylistTrack;
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

  // useMemo: stable identity for tanstack's internal row-model memoization
  // and avoids re-allocating column defs each render. Empty deps = once.
  const columns = useMemo(() => getCommonColumnDefs(), []);

  // useMemo: O(n) filter + map over playlist tracks.
  const data = useMemo<TableData[]>(() => {
    let filtered = playlistTracks;

    if (playlistArtistFilter) {
      filtered = filtered.filter((track) => {
        const artist = track.albumArtist || track.artist || 'Unknown Artist';
        return artist === playlistArtistFilter;
      });
    }

    if (playlistAlbumFilter) {
      filtered = filtered.filter(
        (track) => (track.album || 'Unknown Album') === playlistAlbumFilter,
      );
    }

    return filtered.map((track) => {
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
  }, [playlistTracks, playlistArtistFilter, playlistAlbumFilter]);

  // Writes filter to the store (which fan-outs internally) and snaps
  // scroll to the playing track when clearing a non-empty filter on the
  // active playlist. Reads store state fresh per call so the callback's
  // identity stays stable.
  const handleDebouncedSearchChange = useCallback(
    (value: string) => {
      const libState = useLibraryStore.getState();
      const pid = libState.selectedPlaylistId;
      if (!pid) return;
      const prev = libState.searchFilters[pid] ?? '';
      setSearchFilter(pid, value);

      if (!prev || value) return;

      const playState = useSettingsAndPlaybackStore.getState();
      if (
        !playState.currentTrack ||
        playState.playbackSource !== 'playlist' ||
        playState.playbackSourcePlaylistId !== pid
      )
        return;

      // After setSearchFilter's fan-out, playlistViewState.filtering is
      // '' and playlistViewState.playlistId is pid, so getFilteredAnd
      // SortedTrackIds returns exactly what's visible post-clear.
      const af = libState.browserFilters[pid]?.artist ?? null;
      const alf = libState.browserFilters[pid]?.album ?? null;
      const visibleTrackIds = getFilteredAndSortedTrackIds('playlist', af, alf);
      if (!visibleTrackIds.includes(playState.currentTrack.id)) return;

      setTimeout(() => {
        const ct = useSettingsAndPlaybackStore.getState().currentTrack;
        if (ct) scrollToTrack(ct.id);
      }, 100);
    },
    [setSearchFilter, scrollToTrack],
  );

  // Resolve Tanstack's updater-or-value to a plain value for
  // setPlaylistSortPreference (fan-outs to session cache + viewState +
  // DB). No useCallback — VirtualTable isn't memoized.
  const handleSortingChange = (
    updater: SortingState | ((old: SortingState) => SortingState),
  ) => {
    const state = useLibraryStore.getState();
    const pid = state.selectedPlaylistId;
    if (!pid) return;
    const current =
      state.playlistSortPreferences[pid] ?? DEFAULT_PLAYLIST_SORTING;
    const next = typeof updater === 'function' ? updater(current) : updater;
    setPlaylistSortPreference(pid, next);
  };

  // Handle search toggle. Closing the bar clears the filter through
  // handleDebouncedSearchChange so persistence and scroll-on-clear both
  // fire. The side effect lives outside setShowSearch because state
  // updaters must stay pure.
  const handleSearchToggle = useCallback(() => {
    if (showSearch) handleDebouncedSearchChange('');
    setShowSearch((prev) => !prev);
  }, [showSearch, handleDebouncedSearchChange]);

  // useMemo: O(n) reduce over playlist track durations.
  const playlistTotalHours = useMemo(
    () => calculateTotalHours(playlistTracks),
    [playlistTracks],
  );

  // Mark table as ready after the next frame so the virtualizer has
  // measured rows for the new sorting/filter/data.
  useEffect(() => {
    tableReadyRef.current = false;
    const rafId = requestAnimationFrame(() => {
      tableReadyRef.current = true;
    });
    return () => {
      cancelAnimationFrame(rafId);
    };
  }, [sorting, globalFilter, data.length]);

  const handleRowClick = (
    row: Row<TableData>,
    index: number,
    e: React.MouseEvent,
  ) => {
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
  };

  const handleRowDoubleClick = (row: Row<TableData>, _index: number) => {
    handlePlayTrack(row.original.id);
    setSelectedTracks({ [row.original.id]: true });
  };

  const handleRowContextMenu = (
    row: Row<TableData>,
    _index: number,
    e: React.MouseEvent,
  ) => {
    const trackId = row.original.id;

    if (selectedTracks[trackId]) {
      handleContextMenu(e, trackId);
    } else {
      setSelectedTracks({ [trackId]: true });
      handleContextMenu(e, trackId);
    }
  };

  const handleGetRowClassName = (row: Row<TableData>, index: number) => {
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
  };

  const handleColumnVisibilityToggle = (columnId: string, visible: boolean) => {
    updateColumnVisibility(columnId, visible);
  };

  const handleColumnSizingPersist = (sizing: Record<string, number>) => {
    setColumnWidths(sizing);
  };

  const handleColumnOrderChange = (newOrder: string[]) => {
    setColumnOrder(newOrder);
  };

  const handleRowDragStart = (
    trackId: string,
    selectedIds: string[],
  ): string[] => {
    if (selectedIds.includes(trackId)) {
      return selectedIds;
    }
    return [trackId];
  };

  // useMemo: deep JSX subtree. Stable element reference lets React skip
  // reconciliation of the toolbar when row clicks re-render the parent.
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
        {!drawerOpen && (
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
        )}
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: '8px',
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
            {playlistTracks.length.toLocaleString()}&nbsp;&#9835;
          </Typography>
        </Box>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            borderRadius: '8px',
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
        {showSearch && (
          <Box
            sx={{
              display: 'flex',
              flexGrow: 1,
              minWidth: 0,
              overflow: 'hidden',
              marginLeft: 'auto',
              animation: `${searchExpandAnimation} 120ms ease-out forwards`,
            }}
          >
            <SearchBar
              initialValue={globalFilter}
              onClose={handleSearchToggle}
              onDebouncedChange={handleDebouncedSearchChange}
              placeholder="Search playlist"
            />
          </Box>
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
              size="small"
              sx={{
                color: showSearch ? 'text.primary' : 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                },
                WebkitAppRegion: 'no-drag',
              }}
            >
              {showSearch ? (
                <SearchOffRoundedIcon sx={{ fontSize: 20 }} />
              ) : (
                <SearchRoundedIcon sx={{ fontSize: 20 }} />
              )}
            </IconButton>
          </Tooltip>
          <Tooltip title={browserOpen ? 'Hide Browser' : 'Show Browser'}>
            <IconButton
              aria-controls="browser-panel"
              aria-expanded={browserOpen}
              aria-label="Show/Hide browser"
              data-testid="browser-toggle"
              onClick={() => setBrowserOpen(!browserOpen)}
              size="small"
              sx={{
                color: browserOpen ? 'text.primary' : 'text.secondary',
                '&:hover': {
                  color: 'text.primary',
                },
                WebkitAppRegion: 'no-drag',
              }}
            >
              <Box
                sx={{
                  display: 'inline-flex',
                  transform: browserOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}
              >
                <MaterialSymbolIcon fontSize="small" icon="top_panel_open" />
              </Box>
            </IconButton>
          </Tooltip>
          <NotificationButton />
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
    globalFilter,
    playlistTracks.length,
    playlistTotalHours,
    handleSearchToggle,
    handleDebouncedSearchChange,
    browserOpen,
    setBrowserOpen,
  ]);

  const handleBrowserClose = useCallback(
    () => setBrowserOpen(false),
    [setBrowserOpen],
  );

  // useMemo: wraps React.memo'd Browser. Stable element reference skips
  // its subtree on parent re-renders where deps haven't changed. Gated
  // on selectedPlaylistId (not browserOpen) so open/close can animate.
  const browserPanel = useMemo(() => {
    if (!selectedPlaylistId) return undefined;
    return (
      <Browser
        height={browserHeight}
        onAlbumSelect={handleBrowserAlbumSelect}
        onArtistSelect={handleBrowserArtistSelect}
        onClose={handleBrowserClose}
        onHeightChange={setBrowserHeight}
        open={browserOpen}
        selectedAlbum={playlistAlbumFilter}
        selectedArtist={playlistArtistFilter}
        tracks={playlistTracks}
      />
    );
  }, [
    browserOpen,
    selectedPlaylistId,
    browserHeight,
    handleBrowserAlbumSelect,
    handleBrowserArtistSelect,
    handleBrowserClose,
    playlistAlbumFilter,
    playlistArtistFilter,
    playlistTracks,
  ]);

  // useMemo: stable element reference skips subtree reconciliation on
  // parent re-renders where drawerOpen hasn't changed.
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
            browserPanel={browserPanel}
            columnOrder={columnOrder || undefined}
            columns={columns}
            columnVisibility={
              (columnVisibility as unknown as Record<string, boolean>) || {}
            }
            data={data}
            emptyState={emptyStateContent}
            getRowClassName={handleGetRowClassName}
            globalFilter={globalFilter}
            initialColumnSizing={columnWidths || {}}
            onColumnOrderChange={handleColumnOrderChange}
            onColumnSizingPersist={handleColumnSizingPersist}
            onColumnVisibilityChange={handleColumnVisibilityToggle}
            onRowClick={handleRowClick}
            onRowContextMenu={handleRowContextMenu}
            onRowDoubleClick={handleRowDoubleClick}
            onRowDragStart={handleRowDragStart}
            onSortingChange={handleSortingChange}
            selectedTrackIds={Object.keys(selectedTracks)}
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
          onEditMetadata={handleEditMetadata}
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

      {/* Edit Metadata dialog */}
      <EditMetadataDialog
        onClose={() => setEditMetadataTrackId(null)}
        open={editMetadataTrackId !== null}
        trackId={editMetadataTrackId}
      />

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

// Shields Playlists from MainLayout re-renders (drawer toggle,
// notifications, player sync, etc.). Props are primitive + stable
// useCallback, so the default shallow compare is sufficient.
export default React.memo(Playlists);
