import React, { useState } from 'react';
import {
  IconButton,
  Menu,
  MenuItem,
  Checkbox,
  ListItemText,
  Tooltip,
} from '@mui/material';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import { type ColumnDef } from '@tanstack/react-table';
import { type TableData } from '../utils/tableConfig';

interface ColumnVisibilityMenuProps {
  columns: ColumnDef<TableData>[];
  columnVisibility: Record<string, boolean>;
  onToggle: (columnId: string, visible: boolean) => void;
}

function ColumnVisibilityMenu({
  columns,
  columnVisibility,
  onToggle,
}: ColumnVisibilityMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  // Filter to only hideable columns (exclude trackNumber which is always hidden)
  const hideableColumns = columns.filter((col) => {
    const id =
      (col as { accessorKey?: string }).accessorKey ||
      (col as { id?: string }).id ||
      '';
    return id !== 'trackNumber';
  });

  return (
    <>
      <Tooltip title="Show/Hide columns">
        <IconButton
          aria-label="Show/Hide columns"
          onClick={handleClick}
          sx={{
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <ViewColumnOutlinedIcon />
        </IconButton>
      </Tooltip>
      <Menu anchorEl={anchorEl} onClose={handleClose} open={open}>
        {hideableColumns.map((col) => {
          const id =
            (col as { accessorKey?: string }).accessorKey ||
            (col as { id?: string }).id ||
            '';
          const isVisible = columnVisibility[id] !== false;
          return (
            <MenuItem key={id} dense onClick={() => onToggle(id, !isVisible)}>
              <Checkbox checked={isVisible} size="small" />
              <ListItemText>{col.header as string}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

export default ColumnVisibilityMenu;
