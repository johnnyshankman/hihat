import React, { useState } from 'react';
import { Tooltip } from '@mui/material';
import ViewSidebarRoundedIcon from '@mui/icons-material/ViewSidebarRounded';
import { useTheme } from '@mui/material/styles';

interface SidebarToggleProps {
  isOpen: boolean;
  onToggle: () => void;
}

function SidebarToggle({ isOpen, onToggle }: SidebarToggleProps) {
  const theme = useTheme();
  const [isHovered, setIsHovered] = useState(false);
  // Only render the button when the sidebar is closed
  if (isOpen) return null;

  return (
    <Tooltip title="Show Sidebar">
      <button
        onClick={onToggle}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          backgroundColor: 'transparent',
          border: 'none',
          padding: 0,
          margin: 0,
          color: isHovered
            ? theme.palette.text.primary
            : theme.palette.text.secondary,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'color 0.2s ease',
        }}
        type="button"
      >
        <ViewSidebarRoundedIcon sx={{ fontSize: 20 }} />
      </button>
    </Tooltip>
  );
}

export default SidebarToggle;
