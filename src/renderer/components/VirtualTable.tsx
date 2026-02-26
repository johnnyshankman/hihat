import React, { useRef, useEffect, useCallback } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
  type VisibilityState,
  type Row,
  type Table,
  type FilterFn,
  type ColumnSizingState,
} from '@tanstack/react-table';
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { useTheme } from '@mui/material/styles';
import { type TableData } from '../utils/tableConfig';
import '../styles/virtualTable.css';

const STATIC_ROW_HEIGHT = 22;

// Case-insensitive "contains" filter across title, artist, album, genre
const globalFilterFn: FilterFn<TableData> = (row, _columnId, filterValue) => {
  const search = String(filterValue).toLowerCase();
  const { title, artist, album, genre } = row.original;
  return (
    title.toLowerCase().includes(search) ||
    artist.toLowerCase().includes(search) ||
    album.toLowerCase().includes(search) ||
    genre.toLowerCase().includes(search)
  );
};

interface VirtualTableProps {
  data: TableData[];
  columns: ColumnDef<TableData>[];
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  globalFilter: string;
  columnVisibility: VisibilityState;
  initialColumnSizing?: ColumnSizingState;
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  onColumnSizingPersist?: (sizing: ColumnSizingState) => void;
  virtualizerRef?: React.MutableRefObject<Virtualizer<
    HTMLDivElement,
    Element
  > | null>;
  tableRef?: React.MutableRefObject<Table<TableData> | null>;
  onRowClick: (row: Row<TableData>, index: number, e: React.MouseEvent) => void;
  onRowDoubleClick: (row: Row<TableData>, index: number) => void;
  onRowContextMenu: (
    row: Row<TableData>,
    index: number,
    e: React.MouseEvent,
  ) => void;
  getRowClassName: (row: Row<TableData>, index: number) => string;
  toolbar: React.ReactNode;
  emptyState: React.ReactNode;
}

function VirtualTable({
  data,
  columns,
  sorting,
  onSortingChange,
  globalFilter,
  columnVisibility,
  initialColumnSizing,
  onColumnVisibilityChange: _onColumnVisibilityChange,
  onColumnSizingPersist,
  virtualizerRef,
  tableRef,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  getRowClassName,
  toolbar,
  emptyState,
}: VirtualTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const theme = useTheme();

  // Column sizing state for resizing
  const [columnSizing, setColumnSizing] = React.useState<ColumnSizingState>(
    () => initialColumnSizing || {},
  );

  // Debounced persistence of column sizing
  const isInitialRender = useRef(true);
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return undefined;
    }
    if (!onColumnSizingPersist) return undefined;

    const timer = setTimeout(() => {
      onColumnSizingPersist(columnSizing);
    }, 500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columnSizing]);

  // Build visibility state with trackNumber always hidden
  const visibilityState: VisibilityState = {
    ...columnVisibility,
    trackNumber: false,
  };

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility: visibilityState,
      columnSizing,
    },
    onSortingChange,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn,
    columnResizeMode: 'onChange',
    columnResizeDirection: 'ltr',
  });

  const { rows } = table.getRowModel();

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollContainerRef.current,
    estimateSize: () => STATIC_ROW_HEIGHT,
    overscan: 20,
  });

  // Expose table and virtualizer instances to parent via refs
  useEffect(() => {
    if (virtualizerRef) {
      virtualizerRef.current = virtualizer;
    }
  }, [virtualizer, virtualizerRef]);

  useEffect(() => {
    if (tableRef) {
      tableRef.current = table;
    }
  });

  // Sync MUI theme palette to CSS custom properties
  useEffect(() => {
    const root = document.documentElement;
    const isDark = theme.palette.mode === 'dark';

    root.style.setProperty('--vt-bg-default', theme.palette.background.default);
    root.style.setProperty('--vt-bg-paper', theme.palette.background.paper);
    root.style.setProperty('--vt-divider', theme.palette.divider);
    root.style.setProperty('--vt-text-primary', theme.palette.text.primary);
    root.style.setProperty('--vt-text-secondary', theme.palette.text.secondary);

    // Alternating row colors
    root.style.setProperty(
      '--vt-bg-even',
      isDark ? theme.palette.grey.A700 : theme.palette.grey[50],
    );

    // Selected row
    root.style.setProperty(
      '--vt-bg-selected',
      isDark ? theme.palette.grey[600] : theme.palette.grey[400],
    );

    // Scrollbar
    root.style.setProperty(
      '--vt-scrollbar-thumb',
      isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
    );
    root.style.setProperty(
      '--vt-scrollbar-thumb-hover',
      isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
    );

    // Playing stripe gradients
    root.style.setProperty(
      '--vt-stripe-playing',
      isDark
        ? `repeating-linear-gradient(45deg, rgba(255,255,255,0.04), rgba(255,255,255,0.04) 10px, rgba(255,255,255,0.10) 10px, rgba(255,255,255,0.10) 20px)`
        : `repeating-linear-gradient(45deg, rgba(0,0,0,0.04), rgba(0,0,0,0.04) 10px, rgba(0,0,0,0.10) 10px, rgba(0,0,0,0.10) 20px)`,
    );

    // Playing + selected stripe gradients
    root.style.setProperty(
      '--vt-stripe-playing-selected',
      isDark
        ? `repeating-linear-gradient(45deg, ${theme.palette.grey[600]}, ${theme.palette.grey[600]} 10px, ${theme.palette.grey[700]} 10px, ${theme.palette.grey[700]} 20px)`
        : `repeating-linear-gradient(45deg, ${theme.palette.grey[400]}, ${theme.palette.grey[400]} 10px, ${theme.palette.grey[300]} 10px, ${theme.palette.grey[300]} 20px)`,
    );
  }, [theme]);

  const virtualItems = virtualizer.getVirtualItems();

  // Compute top/bottom spacer heights for virtualization
  const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
  const paddingBottom =
    virtualItems.length > 0
      ? virtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end
      : 0;

  // Header sort handler
  const handleHeaderClick = useCallback(
    (columnId: string) => {
      if (isResizingRef.current) return;
      const currentSort = sorting.find((s) => s.id === columnId);
      if (!currentSort) {
        onSortingChange([{ id: columnId, desc: false }]);
      } else if (!currentSort.desc) {
        onSortingChange([{ id: columnId, desc: true }]);
      } else {
        onSortingChange([{ id: columnId, desc: false }]);
      }
    },
    [sorting, onSortingChange],
  );

  // Get all header groups
  const headerGroups = table.getHeaderGroups();

  // Calculate total column width for the table
  const totalColumnWidth = table
    .getVisibleFlatColumns()
    .reduce((sum, col) => sum + col.getSize(), 0);

  // Number of visible columns (for spacer colSpan)
  const visibleColumnCount = table.getVisibleFlatColumns().length;

  return (
    <div className="vt-paper">
      <div className="vt-toolbar">{toolbar}</div>
      <div
        ref={scrollContainerRef}
        className="vt-container"
        data-testid="vt-container"
      >
        {rows.length > 0 ? (
          <table
            className="vt-table"
            style={{ width: Math.max(totalColumnWidth, 100) }}
          >
            <thead className="vt-thead">
              {headerGroups.map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sortDir = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        className={`vt-th${sortDir ? ' vt-th-sorted' : ''}`}
                        onClick={() => handleHeaderClick(header.column.id)}
                        style={{ width: header.getSize() }}
                      >
                        <span className="vt-th-content">
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {sortDir && (
                            <span className="vt-sort-indicator">
                              {sortDir === 'asc' ? '▲' : '▼'}
                            </span>
                          )}
                        </span>
                        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
                        <div
                          className={`vt-th-resize-handle${
                            header.column.getIsResizing() ? ' vt-resizing' : ''
                          }`}
                          onDoubleClick={() => header.column.resetSize()}
                          onMouseDown={(e) => {
                            isResizingRef.current = true;
                            document.addEventListener(
                              'mouseup',
                              () => {
                                setTimeout(() => {
                                  isResizingRef.current = false;
                                }, 0);
                              },
                              { once: true },
                            );
                            header.getResizeHandler()(e);
                          }}
                          onTouchStart={header.getResizeHandler()}
                        />
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr aria-hidden="true">
                  {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                  <td
                    colSpan={visibleColumnCount}
                    style={{ height: paddingTop, padding: 0, border: 'none' }}
                  />
                </tr>
              )}
              {virtualItems.map((virtualRow) => {
                const row = rows[virtualRow.index];
                return (
                  <tr
                    key={row.id}
                    className={getRowClassName(row, virtualRow.index)}
                    data-track-id={row.original.id}
                    onClick={(e) => onRowClick(row, virtualRow.index, e)}
                    onContextMenu={(e) =>
                      onRowContextMenu(row, virtualRow.index, e)
                    }
                    onDoubleClick={() =>
                      onRowDoubleClick(row, virtualRow.index)
                    }
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="vt-td"
                        style={{ width: cell.column.getSize() }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr aria-hidden="true">
                  {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                  <td
                    colSpan={visibleColumnCount}
                    style={{
                      height: paddingBottom,
                      padding: 0,
                      border: 'none',
                    }}
                  />
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          emptyState
        )}
      </div>
    </div>
  );
}

export default VirtualTable;
