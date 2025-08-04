import { Theme, Box, Typography } from '@mui/material';
import {
  MRT_VisibilityState as MrtVisibilityState,
  MRT_SortingState as MrtSortingState,
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
export const getCommonColumnDefs = (
  sorting: MrtSortingState,
): MrtColumnDef<TableData>[] => [
  {
    accessorKey: 'title',
    header: 'Title',
    size: 350,
    sortingFn: (
      rowA: Row<TableData>,
      rowB: Row<TableData>,
      _columnId: string,
    ) => {
      const columnSorting = sorting.find((sort) => sort.id === 'title');
      const isDescending = columnSorting ? columnSorting.desc : false;
      return sortByTitle(rowA.original, rowB.original, isDescending);
    },
  },
  {
    accessorKey: 'artist',
    header: 'Artist',
    size: 200,
    sortingFn: (
      rowA: Row<TableData>,
      rowB: Row<TableData>,
      _columnId: string,
    ) => {
      const columnSorting = sorting.find((sort) => sort.id === 'artist');
      const isDescending = columnSorting ? columnSorting.desc : false;
      return sortByArtist(rowA.original, rowB.original, isDescending);
    },
  },
  {
    accessorKey: 'album',
    header: 'Album',
    size: 200,
    sortingFn: (
      rowA: Row<TableData>,
      rowB: Row<TableData>,
      _columnId: string,
    ) => {
      const columnSorting = sorting.find((sort) => sort.id === 'album');
      const isDescending = columnSorting ? columnSorting.desc : false;
      return sortByAlbum(rowA.original, rowB.original, isDescending);
    },
  },
  {
    accessorKey: 'genre',
    header: 'Genre',
    size: 120,
    sortingFn: (
      rowA: Row<TableData>,
      rowB: Row<TableData>,
      _columnId: string,
    ) => {
      const columnSorting = sorting.find((sort) => sort.id === 'genre');
      const isDescending = columnSorting ? columnSorting.desc : false;
      return sortByGenre(rowA.original, rowB.original, isDescending);
    },
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
    sortingFn: (
      rowA: Row<TableData>,
      rowB: Row<TableData>,
      _columnId: string,
    ) => {
      const columnSorting = sorting.find((sort) => sort.id === 'duration');
      const isDescending = columnSorting ? columnSorting.desc : false;
      return sortByDuration(rowA.original, rowB.original, isDescending);
    },
  },
  {
    accessorKey: 'playCount',
    header: 'Plays',
    size: 80,
    Cell: ({ cell }: { cell: MrtCell<TableData> }) => {
      const value = cell.getValue<number>();
      return value === 0 ? '-' : value;
    },
    sortingFn: (
      rowA: Row<TableData>,
      rowB: Row<TableData>,
      _columnId: string,
    ) => {
      const columnSorting = sorting.find((sort) => sort.id === 'playCount');
      const isDescending = columnSorting ? columnSorting.desc : false;
      return sortByPlayCount(rowA.original, rowB.original, isDescending);
    },
  },
  {
    accessorKey: 'lastPlayed',
    header: 'Last Played',
    size: 120,
    Cell: ({ cell }: { cell: MrtCell<TableData> }) => {
      const date = cell.getValue<string>();
      return date ? new Date(date).toLocaleDateString() : '-';
    },
    sortingFn: (
      rowA: Row<TableData>,
      rowB: Row<TableData>,
      _columnId: string,
    ) => {
      const columnSorting = sorting.find((sort) => sort.id === 'lastPlayed');
      const isDescending = columnSorting ? columnSorting.desc : false;
      return sortByLastPlayed(rowA.original, rowB.original, isDescending);
    },
  },
  {
    accessorKey: 'dateAdded',
    header: 'Date Added',
    size: 120,
    Cell: ({ cell }: { cell: MrtCell<TableData> }) => {
      const date = cell.getValue<string>();
      return date ? new Date(date).toLocaleDateString() : '';
    },
    sortingFn: (
      rowA: Row<TableData>,
      rowB: Row<TableData>,
      _columnId: string,
    ) => {
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
    sx: {
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
      backgroundColor: (theme: Theme) => theme.palette.background.paper,
    },
  },

  muiTableProps: {
    sx: {
      width: '100%',
      tableLayout: 'fixed',
      height: 'auto',
      backgroundColor: (theme: Theme) => theme.palette.background.default,
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
) => ({
  cursor: 'pointer', // show you can click on the row
  height: `${STATIC_ROW_HEIGHT}px`, // get the height perfectly in line with the MRT configuration
  userSelect: 'none', // get rid of text selection
  // set a default background color
  backgroundColor: (theme: Theme) => theme.palette.background.default,
  // alternate background colors for readability
  '&:nth-of-type(odd)': {
    backgroundColor: (theme: Theme) =>
      theme.palette.mode === 'dark'
        ? theme.palette.grey.A700
        : theme.palette.grey[50],
  },
  // override the background color for the selected tracks
  ...(selectedTrackIds?.includes(rowId) && {
    backgroundColor: (theme: Theme) =>
      theme.palette.mode === 'dark'
        ? `${theme.palette.grey[600]} !important`
        : `${theme.palette.grey[400]} !important`,
  }),
  // override the background color for the currently playing track
  ...(currentTrackId === rowId &&
    playbackSource === expectedSource &&
    (!playbackSourcePlaylistId ||
      playbackSourcePlaylistId === selectedPlaylistId) && {
      backgroundColor: (theme: Theme) => theme.palette.background.default,
      filter: 'invert(1)',
    }),
});
