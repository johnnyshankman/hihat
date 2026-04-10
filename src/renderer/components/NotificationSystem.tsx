import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useUIStore } from '../stores';

const ACCENT_COLORS: Record<string, string> = {
  success: '#28c940',
  error: '#ff5f57',
  warning: '#ffbd2e',
  info: 'rgba(255,255,255,0.4)',
};

/**
 * NotificationSystem component
 *
 * Compact notification panel anchored above the player bar.
 * Uses colored left-border accents instead of MUI Alert.
 */
export default function NotificationSystem() {
  const notifications = useUIStore((state) => state.notifications);
  const removeNotification = useUIStore((state) => state.removeNotification);
  const clearAllNotifications = useUIStore(
    (state) => state.clearAllNotifications,
  );
  const isExpanded = useUIStore((state) => state.notificationPanelOpen);
  const setIsExpanded = useUIStore((state) => state.setNotificationPanelOpen);

  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());
  const previousCountRef = useRef(notifications.length);

  // Auto-expand when a new notification arrives
  useEffect(() => {
    if (notifications.length > previousCountRef.current) {
      setIsExpanded(true);
    }
    previousCountRef.current = notifications.length;
  }, [notifications.length, setIsExpanded]);

  // Auto-collapse when all notifications are cleared
  useEffect(() => {
    if (notifications.length === 0) {
      setIsExpanded(false);
    }
  }, [notifications.length, setIsExpanded]);

  const handleClearAll = useCallback(() => {
    clearAllNotifications();
  }, [clearAllNotifications]);

  const handleDismiss = useCallback(
    (id: string) => {
      setDismissingIds((prev) => new Set(prev).add(id));
      setTimeout(() => {
        removeNotification(id);
        setDismissingIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      }, 200);
    },
    [removeNotification],
  );

  if (!isExpanded) {
    return null;
  }

  return (
    <Box
      data-testid="notification-panel"
      sx={(theme) => ({
        position: 'fixed',
        top: 44,
        right: 8,
        zIndex: 2001,
        width: '320px',
        maxHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#1a1a1a',
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
        animation: 'panelSlideIn 0.2s ease-out',
        '@keyframes panelSlideIn': {
          from: {
            transform: 'translateY(-8px)',
            opacity: 0,
          },
          to: {
            transform: 'translateY(0)',
            opacity: 1,
          },
        },
      })}
    >
      {/* Header */}
      <Box
        sx={(theme) => ({
          px: '10px',
          py: '6px',
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '32px',
        })}
      >
        <Typography
          sx={{
            fontSize: '13px',
            color: 'text.secondary',
            fontWeight: 500,
            userSelect: 'none',
          }}
          variant="body2"
        >
          {notifications.length} notification
          {notifications.length !== 1 ? 's' : ''}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {notifications.length > 0 && (
            <Typography
              component="span"
              data-testid="notification-clear-all"
              onClick={handleClearAll}
              sx={{
                fontSize: '12px',
                color: 'text.secondary',
                cursor: 'pointer',
                userSelect: 'none',
                '&:hover': {
                  color: 'text.primary',
                },
              }}
              variant="body2"
            >
              Clear
            </Typography>
          )}
          <IconButton
            data-testid="notification-close"
            onClick={() => setIsExpanded(false)}
            size="small"
            sx={{
              color: 'text.secondary',
              padding: '2px',
              '&:hover': { color: 'text.primary' },
            }}
          >
            <CloseIcon sx={{ fontSize: '16px' }} />
          </IconButton>
        </Box>
      </Box>

      {/* Notification list */}
      <Box
        sx={{
          flexGrow: 1,
          overflowY: 'auto',
          p: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          maxHeight: '340px',
          '&::-webkit-scrollbar': {
            width: '6px',
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: 'rgba(255,255,255,0.15)',
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: 'rgba(255,255,255,0.25)',
            },
          },
        }}
      >
        {notifications.map((notification) => (
          <Box
            key={notification.id}
            data-testid="notification-item"
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              px: '8px',
              py: '6px',
              borderLeft: `3px solid ${ACCENT_COLORS[notification.type] || ACCENT_COLORS.info}`,
              borderBottom: `1px solid ${theme.palette.divider}`,
              borderRadius: '4px',
              minHeight: '32px',
              opacity: dismissingIds.has(notification.id) ? 0 : 1,
              transition: 'opacity 0.2s ease-out',
              animation: 'rowSlideIn 0.3s ease-out',
              '@keyframes rowSlideIn': {
                from: {
                  transform: 'translateX(30px)',
                  opacity: 0,
                },
                to: {
                  transform: 'translateX(0)',
                  opacity: 1,
                },
              },
            })}
          >
            <Typography
              sx={{
                fontSize: '13px',
                color: 'text.primary',
                flex: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={notification.message}
              variant="body2"
            >
              {notification.message}
            </Typography>
            <IconButton
              data-testid="notification-dismiss"
              onClick={() => handleDismiss(notification.id)}
              size="small"
              sx={{
                color: 'text.secondary',
                padding: '2px',
                opacity: 0.4,
                flexShrink: 0,
                '&:hover': {
                  opacity: 1,
                  color: 'text.primary',
                },
              }}
            >
              <CloseIcon sx={{ fontSize: '14px' }} />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
