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
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Checkbox from '@mui/material/Checkbox';
import ListItemText from '@mui/material/ListItemText';
import { type TableData } from '../utils/tableConfig';
import '../styles/virtualTable.css';

const STATIC_ROW_HEIGHT = 22;

// Case-insensitive "contains" filter across title, artist, album, genre
const globalFilterFn: FilterFn<TableData> = (row, _columnId, filterValue) => {
  const search = String(filterValue).toLowerCase();
  const { title, artist, album, genre, albumArtist } = row.original;
  return (
    title.toLowerCase().includes(search) ||
    artist.toLowerCase().includes(search) ||
    album.toLowerCase().includes(search) ||
    genre.toLowerCase().includes(search) ||
    albumArtist.toLowerCase().includes(search)
  );
};

interface VirtualTableProps {
  browserPanel?: React.ReactNode;
  columnOrder?: string[];
  columns: ColumnDef<TableData>[];
  columnVisibility: VisibilityState;
  data: TableData[];
  emptyState: React.ReactNode;
  getRowClassName: (row: Row<TableData>, index: number) => string;
  globalFilter: string;
  initialColumnSizing?: ColumnSizingState;
  onColumnOrderChange?: (newOrder: string[]) => void;
  onColumnSizingPersist?: (sizing: ColumnSizingState) => void;
  onColumnVisibilityChange: (columnId: string, visible: boolean) => void;
  onRowClick: (row: Row<TableData>, index: number, e: React.MouseEvent) => void;
  onRowContextMenu: (
    row: Row<TableData>,
    index: number,
    e: React.MouseEvent,
  ) => void;
  onRowDoubleClick: (row: Row<TableData>, index: number) => void;
  onRowDragStart?: (trackId: string, selectedIds: string[]) => string[];
  onSortingChange: OnChangeFn<SortingState>;
  selectedTrackIds?: string[];
  sorting: SortingState;
  tableRef?: React.MutableRefObject<Table<TableData> | null>;
  toolbar: React.ReactNode;
  virtualizerRef?: React.MutableRefObject<Virtualizer<
    HTMLDivElement,
    Element
  > | null>;
}

export default function VirtualTable({
  browserPanel,
  columnOrder,
  columns,
  columnVisibility,
  data,
  emptyState,
  getRowClassName,
  globalFilter,
  initialColumnSizing,
  onColumnOrderChange,
  onColumnSizingPersist,
  onColumnVisibilityChange,
  onRowClick,
  onRowContextMenu,
  onRowDoubleClick,
  onRowDragStart,
  onSortingChange,
  selectedTrackIds,
  sorting,
  tableRef,
  toolbar,
  virtualizerRef,
}: VirtualTableProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isResizingRef = useRef(false);
  const theme = useTheme();

  // Track container width for filler column
  const [containerWidth, setContainerWidth] = React.useState(0);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver((entries) => {
      entries.forEach((entry) => {
        setContainerWidth(entry.contentRect.width);
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

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
      columnOrder: columnOrder || undefined,
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

    // Alternating row color — semantic token defined in materialTheme.ts
    // so the value lives with the rest of the palette, not inline here.
    root.style.setProperty('--vt-bg-even', theme.palette.tableStripe);

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

  // Drag-and-drop column reorder state
  const [dragColumnId, setDragColumnId] = React.useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = React.useState<string | null>(null);
  const isDraggingRef = useRef(false);

  // Header right-click context menu for column visibility
  const [headerMenuPos, setHeaderMenuPos] = React.useState<{
    top: number;
    left: number;
  } | null>(null);

  // Header sort handler
  const handleHeaderClick = useCallback(
    (columnId: string) => {
      if (isResizingRef.current || isDraggingRef.current) return;
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

  // Header right-click handler for column visibility menu
  const handleHeaderContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setHeaderMenuPos({ top: e.clientY, left: e.clientX });
  }, []);

  const handleCloseHeaderMenu = useCallback(() => {
    setHeaderMenuPos(null);
  }, []);

  // Columns available for visibility toggling (exclude trackNumber)
  const hideableColumns = React.useMemo(
    () =>
      columns.filter((col) => {
        const id =
          (col as { accessorKey?: string }).accessorKey ||
          (col as { id?: string }).id ||
          '';
        return id !== 'trackNumber';
      }),
    [columns],
  );

  // Get all header groups
  const headerGroups = table.getHeaderGroups();

  // Calculate total column width for the table
  const totalColumnWidth = table
    .getVisibleFlatColumns()
    .reduce((sum, col) => sum + col.getSize(), 0);

  // Filler column width to extend row backgrounds to container edge
  const fillerWidth = Math.max(0, containerWidth - totalColumnWidth);

  // Number of visible columns (for spacer colSpan)
  const visibleColumnCount = table.getVisibleFlatColumns().length;
  const totalColSpan = visibleColumnCount + (fillerWidth > 0 ? 1 : 0);

  // Row drag-and-drop (constant for all rows)
  const isDraggable = !!onRowDragStart;

  return (
    <div className="vt-paper">
      <div className="vt-toolbar">{toolbar}</div>
      {browserPanel}
      <div
        ref={scrollContainerRef}
        className="vt-container"
        data-testid="vt-container"
      >
        {rows.length > 0 ? (
          <table
            className="vt-table"
            style={{ width: Math.max(totalColumnWidth + fillerWidth, 100) }}
          >
            <thead className="vt-thead">
              {headerGroups.map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const sortDir = header.column.getIsSorted();
                    const isDragging = dragColumnId === header.column.id;
                    const isDropTarget =
                      dropTargetId === header.column.id &&
                      dragColumnId !== header.column.id;
                    let ariaSort: 'ascending' | 'descending' | undefined;
                    if (sortDir === 'asc') ariaSort = 'ascending';
                    else if (sortDir === 'desc') ariaSort = 'descending';
                    return (
                      <th
                        key={header.id}
                        aria-sort={ariaSort}
                        className={`vt-th${sortDir ? ' vt-th-sorted' : ''}${isDragging ? ' vt-th-dragging' : ''}${isDropTarget ? ' vt-th-drop-target' : ''}`}
                        draggable
                        onClick={() => handleHeaderClick(header.column.id)}
                        onContextMenu={handleHeaderContextMenu}
                        onDragEnd={() => {
                          isDraggingRef.current = false;
                          setDragColumnId(null);
                          setDropTargetId(null);
                        }}
                        onDragLeave={() => {
                          setDropTargetId(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          setDropTargetId(header.column.id);
                        }}
                        onDragStart={(e) => {
                          if (isResizingRef.current) {
                            e.preventDefault();
                            return;
                          }
                          isDraggingRef.current = true;
                          setDragColumnId(header.column.id);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (
                            dragColumnId &&
                            dragColumnId !== header.column.id &&
                            onColumnOrderChange
                          ) {
                            const currentOrder =
                              columnOrder ||
                              table.getAllLeafColumns().map((c) => c.id);
                            const newOrder = [...currentOrder];
                            const fromIndex = newOrder.indexOf(dragColumnId);
                            const toIndex = newOrder.indexOf(header.column.id);
                            newOrder.splice(
                              toIndex,
                              0,
                              newOrder.splice(fromIndex, 1)[0],
                            );
                            onColumnOrderChange(newOrder);
                          }
                          setDragColumnId(null);
                          setDropTargetId(null);
                        }}
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
                          draggable={false}
                          onDoubleClick={() => header.column.resetSize()}
                          onDragStart={(e) => e.preventDefault()}
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
                  {fillerWidth > 0 && (
                    /* eslint-disable-next-line jsx-a11y/control-has-associated-label */
                    <th
                      className="vt-th vt-th-filler"
                      style={{ width: fillerWidth }}
                    />
                  )}
                </tr>
              ))}
            </thead>
            <tbody>
              {paddingTop > 0 && (
                <tr aria-hidden="true">
                  {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                  <td
                    colSpan={totalColSpan}
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
                    draggable={isDraggable || undefined}
                    onClick={(e) => onRowClick(row, virtualRow.index, e)}
                    onContextMenu={(e) =>
                      onRowContextMenu(row, virtualRow.index, e)
                    }
                    onDoubleClick={() =>
                      onRowDoubleClick(row, virtualRow.index)
                    }
                    onDragStart={
                      isDraggable
                        ? (e) => {
                            const ids = onRowDragStart!(
                              row.original.id,
                              selectedTrackIds || [],
                            );
                            e.dataTransfer.setData(
                              'application/x-hihat-tracks',
                              JSON.stringify(ids),
                            );
                            e.dataTransfer.effectAllowed = 'copy';
                            // Create drag preview
                            const preview = document.createElement('div');
                            preview.style.cssText =
                              'position:absolute;top:-1000px;padding:4px 8px;background:#333;color:#fff;border-radius:4px;font-size:12px;white-space:nowrap;';
                            preview.textContent =
                              ids.length > 1
                                ? `${ids.length} tracks`
                                : row.original.title;
                            document.body.appendChild(preview);
                            e.dataTransfer.setDragImage(preview, 0, 0);
                            requestAnimationFrame(() => preview.remove());
                          }
                        : undefined
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
                    {fillerWidth > 0 && (
                      /* eslint-disable-next-line jsx-a11y/control-has-associated-label */
                      <td
                        className="vt-td vt-td-filler"
                        style={{ width: fillerWidth }}
                      />
                    )}
                  </tr>
                );
              })}
              {paddingBottom > 0 && (
                <tr aria-hidden="true">
                  {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
                  <td
                    colSpan={totalColSpan}
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
      <Menu
        anchorPosition={
          headerMenuPos
            ? { top: headerMenuPos.top, left: headerMenuPos.left }
            : undefined
        }
        anchorReference="anchorPosition"
        onClose={handleCloseHeaderMenu}
        open={headerMenuPos !== null}
      >
        {hideableColumns.map((col) => {
          const id =
            (col as { accessorKey?: string }).accessorKey ||
            (col as { id?: string }).id ||
            '';
          const isVisible = columnVisibility[id] !== false;
          return (
            <MenuItem
              key={id}
              dense
              onClick={() => onColumnVisibilityChange(id, !isVisible)}
            >
              <Checkbox checked={isVisible} size="small" />
              <ListItemText>{col.header as string}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </div>
  );
}
