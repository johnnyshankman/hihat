import React from 'react';
import { IconButton, Tooltip } from '@mui/material';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';

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
        onClick={onToggle}
        size="small"
        sx={{
          color: 'text.secondary',
          '&:hover': {
            color: 'text.primary',
          },
        }}
      >
        <ViewSidebarRoundedIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Tooltip>
  );
}

export default SidebarToggle;
