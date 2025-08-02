import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Badge,
  IconButton,
  Paper,
  Typography,
  Button,
  Collapse,
  Fade,
} from '@mui/material';
import {
  Notifications as NotificationsIcon,
  Close as CloseIcon,
  ClearAll as ClearAllIcon,
} from '@mui/icons-material';
import { useUIStore } from '../stores';

/**
 * NotificationSystem component
 *
 * Displays notifications in a collapsible panel with a badge counter
 * Handles large amounts of notifications elegantly with scrolling
 */
export default function NotificationSystem() {
  const notifications = useUIStore((state) => state.notifications);
  const removeNotification = useUIStore((state) => state.removeNotification);
  const clearAllNotifications = useUIStore(
    (state) => state.clearAllNotifications,
  );

  const [isExpanded, setIsExpanded] = useState(false);
  const [hasNewNotifications, setHasNewNotifications] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousCountRef = useRef(notifications.length);

  // Auto-expand when first notification arrives, but not for subsequent ones
  useEffect(() => {
    if (notifications.length > 0 && previousCountRef.current === 0) {
      setIsExpanded(true);
      setHasNewNotifications(true);
    } else if (notifications.length > previousCountRef.current) {
      setHasNewNotifications(true);
    }
    previousCountRef.current = notifications.length;
  }, [notifications.length]);

  // Auto-collapse when all notifications are cleared
  useEffect(() => {
    if (notifications.length === 0) {
      setIsExpanded(false);
    }
  }, [notifications.length]);

  // Clear "new" indicator when panel is expanded
  useEffect(() => {
    if (isExpanded) {
      const timer = setTimeout(() => {
        setHasNewNotifications(false);
      }, 500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isExpanded]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    if (!isExpanded) {
      setHasNewNotifications(false);
    }
  };

  const handleClearAll = () => {
    clearAllNotifications();
    setIsExpanded(false);
  };

  if (notifications.length === 0 && !isExpanded) {
    return null;
  }

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 1,
      }}
    >
      {/* Notification Badge/Toggle */}
      <Fade in={notifications.length > 0 || isExpanded}>
        <IconButton
          onClick={handleToggle}
          sx={{
            backgroundColor: 'primary.main',
            color: 'white',
            '&:hover': {
              backgroundColor: 'primary.dark',
            },
            animation: hasNewNotifications
              ? 'pulse 1s ease-in-out infinite'
              : 'none',
            '@keyframes pulse': {
              '0%': {
                transform: 'scale(1)',
                boxShadow: '0 0 0 0 rgba(33, 150, 243, 0.7)',
              },
              '70%': {
                transform: 'scale(1.05)',
                boxShadow: '0 0 0 10px rgba(33, 150, 243, 0)',
              },
              '100%': {
                transform: 'scale(1)',
                boxShadow: '0 0 0 0 rgba(33, 150, 243, 0)',
              },
            },
          }}
        >
          <Badge badgeContent={notifications.length} color="error">
            <NotificationsIcon />
          </Badge>
        </IconButton>
      </Fade>

      {/* Notification Panel */}
      <Collapse in={isExpanded}>
        <Paper
          elevation={8}
          sx={{
            width: '400px',
            maxHeight: '400px',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'background.paper',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 2,
              borderBottom: 1,
              borderColor: 'divider',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="h6">
              Notifications ({notifications.length})
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {notifications.length > 0 && (
                <Button
                  onClick={handleClearAll}
                  size="small"
                  startIcon={<ClearAllIcon />}
                  variant="text"
                >
                  Clear All
                </Button>
              )}
              <IconButton onClick={() => setIsExpanded(false)} size="small">
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          {/* Scrollable Notification List */}
          <Box
            ref={scrollContainerRef}
            sx={{
              flexGrow: 1,
              overflowY: 'auto',
              p: 2,
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
              maxHeight: '320px',
              '&::-webkit-scrollbar': {
                width: '8px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'action.hover',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'action.selected',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: 'action.disabled',
                },
              },
            }}
          >
            {notifications.length === 0 ? (
              <Typography
                color="text.secondary"
                sx={{ textAlign: 'center', py: 4 }}
                variant="body2"
              >
                No notifications
              </Typography>
            ) : (
              notifications.map((notification) => (
                <Alert
                  key={notification.id}
                  onClose={() => removeNotification(notification.id)}
                  severity={notification.type}
                  sx={{
                    width: '100%',
                    animation: 'slideIn 0.3s ease-out',
                    '@keyframes slideIn': {
                      from: {
                        transform: 'translateX(50px)',
                        opacity: 0,
                      },
                      to: {
                        transform: 'translateX(0)',
                        opacity: 1,
                      },
                    },
                  }}
                >
                  {notification.message}
                </Alert>
              ))
            )}
          </Box>
        </Paper>
      </Collapse>
    </Box>
  );
}
