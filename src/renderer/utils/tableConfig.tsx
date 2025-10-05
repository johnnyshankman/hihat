import { Theme, Box, Typography } from '@mui/material';
import {
  MRT_VisibilityState as MrtVisibilityState,
  MRT_Cell as MrtCell,
  MRT_ColumnDef as MrtColumnDef,
} from 'material-react-table';
import { Row, Updater } from '@tanstack/react-table';
import {
  sortByTitle,
  sortByArtist,
  sortByAlbum,
  sortByGenre,
  sortByDuration,
  sortByPlayCount,
  sortByDateAdded,
  sortByLastPlayed,
} from './sortingFunctions';

const STATIC_ROW_HEIGHT = 23;

// Custom formatter for duration in seconds
export const formatDurationFromSeconds = (seconds: number): string => {
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
export interface TableData {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  duration: number;
  playCount: number;
  dateAdded?: string;
  lastPlayed?: string | null;
  albumArtist: string;
  trackNumber: number | null;
}

// Define common column definitions
export const getCommonColumnDefs = (): MrtColumnDef<TableData>[] => [
  {
    accessorKey: 'title',
    header: 'Title',
    size: 350,
    sortingFn: (rowA: Row<TableData>, rowB: Row<TableData>) =>
      sortByTitle(rowA.original, rowB.original, false),
  },
  {
    accessorKey: 'artist',
    header: 'Artist',
    size: 200,
    sortingFn: (rowA: Row<TableData>, rowB: Row<TableData>) =>
      sortByArtist(rowA.original, rowB.original, false),
  },
  {
    accessorKey: 'album',
    header: 'Album',
    size: 200,
    sortingFn: (rowA: Row<TableData>, rowB: Row<TableData>) =>
      sortByAlbum(rowA.original, rowB.original, false),
  },
  {
    accessorKey: 'genre',
    header: 'Genre',
    size: 120,
    sortingFn: (rowA: Row<TableData>, rowB: Row<TableData>) =>
      sortByGenre(rowA.original, rowB.original, false),
    Cell: ({ cell }: { cell: MrtCell<TableData> }) => {
      const value = cell.getValue<string>();
      if (value === 'Unknown Genre') {
        return '-';
      }
      return value;
    },
  },
  {
    accessorKey: 'duration',
    header: 'Duration',
    size: 80,
    Cell: ({ cell }: { cell: MrtCell<TableData> }) =>
      formatDurationFromSeconds(cell.getValue<number>()),
    sortingFn: (rowA: Row<TableData>, rowB: Row<TableData>) =>
      sortByDuration(rowA.original, rowB.original, false),
  },
  {
    accessorKey: 'playCount',
    header: 'Plays',
    size: 80,
    Cell: ({ cell }: { cell: MrtCell<TableData> }) => {
      const value = cell.getValue<number>();
      return value === 0 ? '-' : value;
    },
    sortingFn: (rowA: Row<TableData>, rowB: Row<TableData>) =>
      sortByPlayCount(rowA.original, rowB.original, false),
  },
  {
    accessorKey: 'lastPlayed',
    header: 'Last Played',
    size: 120,
    Cell: ({ cell }: { cell: MrtCell<TableData> }) => {
      const date = cell.getValue<string>();
      return date ? new Date(date).toLocaleDateString() : '-';
    },
    sortingFn: (rowA: Row<TableData>, rowB: Row<TableData>) =>
      sortByLastPlayed(rowA.original, rowB.original, false),
  },
  {
    accessorKey: 'dateAdded',
    header: 'Date Added',
    size: 120,
    Cell: ({ cell }: { cell: MrtCell<TableData> }) => {
      const date = cell.getValue<string>();
      return date ? new Date(date).toLocaleDateString() : '';
    },
    sortingFn: (rowA: Row<TableData>, rowB: Row<TableData>) =>
      sortByDateAdded(rowA.original, rowB.original, false),
  },
  {
    accessorKey: 'trackNumber',
    header: 'Track #',
    size: 80,
    enableHiding: true,
    enableColumnFilter: false,
    enableGlobalFilter: false,
  },
];

// Common table styling configuration
export const getCommonTableConfig = (_drawerOpen: boolean) => ({
  // Pagination and toolbar settings
  enablePagination: false,
  enableBottomToolbar: false,
  enableColumnResizing: true,
  enableSorting: true,
  enableColumnFilters: true,
  enableGlobalFilter: true,
  enableDensityToggle: false,
  enableFullScreenToggle: false,
  enableRowVirtualization: true,

  // Row virtualization settings
  rowVirtualizerOptions: {
    overscan: 20,
    estimateSize: () => STATIC_ROW_HEIGHT,
    paddingStart: 0,
    paddingEnd: 0,
  },

  // Layout settings
  layoutMode: 'grid' as const,
  positionToolbarAlertBanner: 'bottom' as const,
  memoMode: 'cells' as const,
  defaultDisplayColumn: { size: 150 },
  globalFilterFn: 'contains' as const,

  // Initial state
  initialState: {
    density: 'compact' as const,
    columnVisibility: {
      trackNumber: false,
    },
  },

  // MUI component props
  muiTopToolbarProps: {
    elevation: 0,
    sx: {
      backgroundColor: (theme: Theme) => theme.palette.background.paper,
      borderBottom: '1px solid',
      borderColor: (theme: Theme) => theme.palette.divider,
      minHeight: '64px',
      padding: '8px',
      display: 'flex',
      alignItems: 'center',
      overflow: 'visible',
      flexWrap: 'wrap',
      gap: '8px',
    },
  },

  muiTableBodyCellProps: {
    sx: {
      borderBottom: 'none',
    },
  },

  muiTableHeadProps: {
    sx: {
      borderBottom: '1px solid',
      borderColor: (theme: Theme) => theme.palette.divider,
      opacity: 1.0,
    },
  },

  muiTableHeadCellProps: {
    sx: {
      backgroundColor: (theme: Theme) => theme.palette.background.paper,
    },
  },

  muiSearchTextFieldProps: {
    variant: 'outlined' as const,
    size: 'small' as const,
  },

  muiFilterTextFieldProps: {
    sx: {
      height: '40px',
      '& .MuiInputBase-root': {
        height: '40px',
      },
      m: 0,
    },
  },

  muiToolbarAlertBannerProps: {
    sx: {
      maxHeight: '40px',
    },
  },

  muiTableContainerProps: {
    sx: {
      height: 'calc(100% - 100px)',
      flexGrow: 1,
      width: '100%',
      overflow: 'auto',
      display: 'flex',
      flexDirection: 'column',
      padding: 0,
      margin: 0,
      backgroundColor: (theme: Theme) => theme.palette.background.default,
      '&::-webkit-scrollbar': {
        width: '8px',
        height: '8px',
      },
      '&::-webkit-scrollbar-track': {
        backgroundColor: 'transparent',
      },
      '&::-webkit-scrollbar-thumb': {
        backgroundColor: (theme: Theme) =>
          theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(0,0,0,0.1)',
        borderRadius: '0px',
        '&:hover': {
          backgroundColor: (theme: Theme) =>
            theme.palette.mode === 'dark'
              ? 'rgba(255,255,255,0.2)'
              : 'rgba(0,0,0,0.2)',
        },
      },
      '&::-webkit-scrollbar-corner': {
        backgroundColor: (theme: Theme) =>
          theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.1)'
            : 'rgba(0,0,0,0.1)',
        borderRadius: '0px',
      },
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
    },
  },

  muiTableProps: {
    sx: {
      width: '100%',
      tableLayout: 'fixed',
      height: 'auto',
    },
  },
});

// Common empty state renderer
export const getCommonEmptyStateRenderer = (drawerOpen: boolean) => () => ({
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
        {/* This will be overridden by the component */}
        Empty State
      </Typography>
      <Typography
        sx={{
          color: 'text.secondary',
          textAlign: 'center',
          maxWidth: '400px',
        }}
        variant="body2"
      >
        {/* This will be overridden by the component */}
        Empty state description
      </Typography>
    </Box>
  ),
});

// Common column visibility handler
export const getCommonColumnVisibilityHandler = (
  columnVisibility: Record<string, boolean> | null,
  updateColumnVisibility: (column: string, visible: boolean) => void,
) => {
  return (updaterOrValue: Updater<MrtVisibilityState>) => {
    if (!columnVisibility) return;

    let updatedColumnVisibility: MrtVisibilityState;

    if (typeof updaterOrValue === 'function') {
      const currentMrtVisibility =
        columnVisibility as unknown as MrtVisibilityState;
      updatedColumnVisibility = updaterOrValue(currentMrtVisibility);
    } else {
      updatedColumnVisibility = updaterOrValue;
    }

    const currentVisibility = columnVisibility;

    Object.keys(updatedColumnVisibility).forEach((column) => {
      const isCurrentlyVisible =
        !!currentVisibility[column as keyof typeof currentVisibility];
      const willBeVisible = !!updatedColumnVisibility[column];

      if (isCurrentlyVisible !== willBeVisible) {
        updateColumnVisibility(column, willBeVisible);
      }
    });
  };
};

// Common row styling
export const getCommonRowStyling = (
  rowId: string,
  currentTrackId: string | undefined,
  selectedTrackIds: string[] | undefined,
  playbackSource: string,
  expectedSource: string,
  playbackSourcePlaylistId?: string,
  selectedPlaylistId?: string,
  rowIndex?: number,
) => {
  const isPlaying =
    currentTrackId === rowId &&
    playbackSource === expectedSource &&
    (!playbackSourcePlaylistId ||
      playbackSourcePlaylistId === selectedPlaylistId);

  const isSelected = selectedTrackIds?.includes(rowId);

  // Determine if this row should have alternating background based on actual data index
  const isEvenRow = rowIndex !== undefined && rowIndex % 2 === 0;

  return {
    cursor: 'pointer', // show you can click on the row
    height: `${STATIC_ROW_HEIGHT}px`, // get the height perfectly in line with the MRT configuration
    userSelect: 'none', // get rid of text selection
    // set background color based on actual row index in data, not DOM position
    backgroundColor: (theme: Theme) => {
      if (!isEvenRow) {
        return theme.palette.background.default;
      }
      return theme.palette.mode === 'dark'
        ? theme.palette.grey.A700
        : theme.palette.grey[50];
    },
    // Style for selected tracks only
    ...(isSelected &&
      !isPlaying && {
        backgroundColor: (theme: Theme) =>
          theme.palette.mode === 'dark'
            ? `${theme.palette.grey[600]} !important`
            : `${theme.palette.grey[400]} !important`,
      }),
    // Style for currently playing track only (not selected) - subtle animated stripes
    ...(isPlaying &&
      !isSelected && {
        position: 'relative' as const,
        overflow: 'hidden' as const,
        backgroundColor: 'transparent !important',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '200%',
          height: '100%',
          backgroundImage: (theme: Theme) =>
            theme.palette.mode === 'dark'
              ? `repeating-linear-gradient(
                45deg,
                rgba(255, 255, 255, 0.04),
                rgba(255, 255, 255, 0.04) 10px,
                rgba(255, 255, 255, 0.10) 10px,
                rgba(255, 255, 255, 0.10) 20px
              )`
              : `repeating-linear-gradient(
                45deg,
                rgba(0, 0, 0, 0.04),
                rgba(0, 0, 0, 0.04) 10px,
                rgba(0, 0, 0, 0.10) 10px,
                rgba(0, 0, 0, 0.10) 20px
              )`,
          animation: 'moveStripes 52s linear infinite',
          pointerEvents: 'none',
          zIndex: 0,
        },
        // Ensure content appears above the animated background
        '& > td': {
          position: 'relative',
          zIndex: 1,
        },
        '@keyframes moveStripes': {
          '0%': {
            transform: 'translateX(0)',
          },
          '100%': {
            transform: 'translateX(50%)',
          },
        },
      }),
    // Style for currently playing AND selected track (animated diagonal stripes pattern)
    ...(isPlaying &&
      isSelected && {
        position: 'relative' as const,
        overflow: 'hidden' as const,
        backgroundColor: 'transparent !important',
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: '-100%',
          width: '200%',
          height: '100%',
          backgroundImage: (theme: Theme) =>
            theme.palette.mode === 'dark'
              ? `repeating-linear-gradient(
                45deg,
                ${theme.palette.grey[600]},
                ${theme.palette.grey[600]} 10px,
                ${theme.palette.grey[700]} 10px,
                ${theme.palette.grey[700]} 20px
              )`
              : `repeating-linear-gradient(
                45deg,
                ${theme.palette.grey[400]},
                ${theme.palette.grey[400]} 10px,
                ${theme.palette.grey[300]} 10px,
                ${theme.palette.grey[300]} 20px
              )`,
          animation: 'moveStripes 52s linear infinite',
          pointerEvents: 'none',
          zIndex: 0,
        },
        // Ensure content appears above the animated background
        '& > td': {
          position: 'relative',
          zIndex: 1,
        },
        '@keyframes moveStripes': {
          '0%': {
            transform: 'translateX(0)',
          },
          '100%': {
            transform: 'translateX(50%)',
          },
        },
      }),
  };
};
