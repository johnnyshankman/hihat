import React, { useState, useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Paper,
  Typography,
  Button,
  Collapse,
  IconButton,
} from '@mui/material';
import {
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
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousCountRef = useRef(notifications.length);

  // Auto-expand when first notification arrives, but not for subsequent ones
  useEffect(() => {
    if (notifications.length > 0 && previousCountRef.current === 0) {
      setIsExpanded(true);
    }
    previousCountRef.current = notifications.length;
  }, [notifications.length]);

  // Auto-collapse when all notifications are cleared
  useEffect(() => {
    if (notifications.length === 0) {
      setIsExpanded(false);
    }
  }, [notifications.length]);

  // Listen for toggle events from the Player component
  useEffect(() => {
    const handleToggleEvent = () => {
      setIsExpanded((prev) => !prev);
    };

    window.addEventListener('toggleNotificationPanel', handleToggleEvent);
    return () => {
      window.removeEventListener('toggleNotificationPanel', handleToggleEvent);
    };
  }, []);

  const handleClearAll = () => {
    clearAllNotifications();
    setIsExpanded(false);
  };

  if (notifications.length === 0 && !isExpanded) {
    return null;
  }

  return (
    <>
      {/* Notification Panel */}
      {isExpanded && (
        <Box
          sx={{
            position: 'fixed',
            bottom: 60,
            right: 24,
            zIndex: 2001,
          }}
        >
          <Collapse in={isExpanded}>
            <Paper
              elevation={8}
              sx={{
                width: '400px',
                maxHeight: '400px',
                display: 'flex',
                flexDirection: 'column',
                backgroundColor: (theme) => theme.palette.background.paper,
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
                      disableElevation
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
      )}
    </>
  );
}
