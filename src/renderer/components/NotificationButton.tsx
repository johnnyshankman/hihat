import React from 'react';
import { Badge, IconButton, Tooltip } from '@mui/material';
import NotificationsIcon from '@mui/icons-material/Notifications';
import { useUIStore } from '../stores';

export default function NotificationButton() {
  const notifications = useUIStore((state) => state.notifications);
  const panelOpen = useUIStore((state) => state.notificationPanelOpen);
  const setPanelOpen = useUIStore((state) => state.setNotificationPanelOpen);

  return (
    <Tooltip
      arrow
      placement="bottom"
      title={panelOpen ? 'Hide Notifications' : 'Show Notifications'}
    >
      <IconButton
        aria-label="Show/Hide notifications"
        data-testid="notification-button"
        onClick={() => setPanelOpen(!panelOpen)}
        size="small"
        sx={{
          color: panelOpen ? 'text.primary' : 'text.secondary',
          '&:hover': {
            color: 'text.primary',
          },
          WebkitAppRegion: 'no-drag',
        }}
      >
        <Badge
          badgeContent={notifications.length}
          color="error"
          invisible={notifications.length === 0}
          sx={{
            '& .MuiBadge-badge': {
              fontSize: '0.65rem',
              height: '16px',
              minWidth: '16px',
              padding: '0 4px',
            },
          }}
        >
          <NotificationsIcon sx={{ fontSize: 20 }} />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
