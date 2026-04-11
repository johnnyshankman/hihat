import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import { mutedIconButtonSx } from '../styles/iconButtonStyles';

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

function SidebarToggle({ isOpen, onToggle }: SidebarToggleProps) {
  // Only render the button when the sidebar is closed
  if (isOpen) return null;

  return (
    <Tooltip title="Show Sidebar">
      <IconButton
        data-testid="sidebar-toggle"
        onClick={onToggle}
        size="small"
        sx={{
          ...mutedIconButtonSx,
          height: '100%',
          padding: 0,
        }}
      >
        <ViewSidebarRoundedIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );
}

export default SidebarToggle;
