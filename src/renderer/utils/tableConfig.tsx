import { type ColumnDef, type Row } from '@tanstack/react-table';
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

export const STATIC_ROW_HEIGHT = 22;

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

// Define common column definitions for TanStack Table
export const getCommonColumnDefs = (): ColumnDef<TableData>[] => [
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
    cell: ({ cell }) => {
      const value = cell.getValue<string>();
      if (value === 'Unknown Genre') {
        return '-';
      }
      return value;
    },
  },
  {
    accessorKey: 'duration',
    header: 'Time',
    size: 80,
    cell: ({ cell }) => formatDurationFromSeconds(cell.getValue<number>()),
    sortingFn: (rowA: Row<TableData>, rowB: Row<TableData>) =>
      sortByDuration(rowA.original, rowB.original, false),
  },
  {
    accessorKey: 'playCount',
    header: 'Plays',
    size: 80,
    cell: ({ cell }) => {
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
    cell: ({ cell }) => {
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
    cell: ({ cell }) => {
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
  },
];

// Returns a CSS class string for row styling
export const getRowClassName = (
  rowId: string,
  currentTrackId: string | undefined,
  selectedTrackIds: string[] | undefined,
  playbackSource: string,
  expectedSource: string,
  playbackSourcePlaylistId?: string,
  selectedPlaylistId?: string,
  rowIndex?: number,
): string => {
  const isPlaying =
    currentTrackId === rowId &&
    playbackSource === expectedSource &&
    (!playbackSourcePlaylistId ||
      playbackSourcePlaylistId === selectedPlaylistId);

  const isSelected = selectedTrackIds?.includes(rowId);
  const isEvenRow = rowIndex !== undefined && rowIndex % 2 === 0;

  const classes = ['vt-row'];

  if (isEvenRow) {
    classes.push('vt-row-even');
  } else {
    classes.push('vt-row-odd');
  }

  if (isPlaying && isSelected) {
    classes.push('vt-row-playing-selected');
  } else if (isPlaying) {
    classes.push('vt-row-playing');
  } else if (isSelected) {
    classes.push('vt-row-selected');
  }

  return classes.join(' ');
};
