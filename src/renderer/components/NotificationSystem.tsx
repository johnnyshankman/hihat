import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import {
  Close as CloseIcon,
  NotificationsNoneOutlined as BellIcon,
} from '@mui/icons-material';
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

  const isEmpty = notifications.length === 0;

  return (
    <Box
      data-testid="notification-panel"
      sx={{
        position: 'fixed',
        top: 44,
        right: 8,
        zIndex: 2001,
        width: '320px',
        maxHeight: '400px',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#141414',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.04) inset, 0 12px 40px rgba(0,0,0,0.7)',
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
      }}
    >
      {/* Header */}
      <Box
        sx={{
          px: '12px',
          py: '8px',
          backgroundColor: '#1c1c1c',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          boxShadow: '0 2px 6px rgba(0,0,0,0.35)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: '36px',
          position: 'relative',
          zIndex: 1,
        }}
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

      {/* Empty state */}
      {isEmpty && (
        <Box
          data-testid="notification-empty-state"
          sx={{
            px: '16px',
            py: '28px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            backgroundColor: '#141414',
            animation: 'emptyFadeIn 0.32s ease-out',
            '@keyframes emptyFadeIn': {
              from: { opacity: 0, transform: 'translateY(-2px)' },
              to: { opacity: 1, transform: 'translateY(0)' },
            },
          }}
        >
          <Box
            sx={{
              position: 'relative',
              width: '52px',
              height: '52px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              '&::before': {
                content: '""',
                position: 'absolute',
                inset: '-6px',
                borderRadius: '50%',
                border: '1px solid rgba(255,255,255,0.04)',
              },
            }}
          >
            <BellIcon
              sx={{
                fontSize: '22px',
                color: 'rgba(255,255,255,0.32)',
              }}
            />
          </Box>
          <Typography
            sx={{
              fontSize: '13px',
              fontWeight: 500,
              color: 'rgba(255,255,255,0.75)',
              letterSpacing: '0.2px',
              userSelect: 'none',
            }}
          >
            You&apos;re all caught up
          </Typography>
          <Typography
            sx={{
              fontSize: '11px',
              color: 'rgba(255,255,255,0.35)',
              userSelect: 'none',
              textAlign: 'center',
              lineHeight: 1.4,
            }}
          >
            New notifications will appear here
          </Typography>
        </Box>
      )}

      {/* Notification list */}
      {!isEmpty && (
        <Box
          sx={{
            flexGrow: 1,
            overflowY: 'auto',
            p: '8px',
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
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                px: '8px',
                py: '6px',
                backgroundColor: 'rgba(255,255,255,0.02)',
                borderLeft: `3px solid ${ACCENT_COLORS[notification.type] || ACCENT_COLORS.info}`,
                borderRadius: '4px',
                minHeight: '32px',
                opacity: dismissingIds.has(notification.id) ? 0 : 1,
                transition:
                  'opacity 0.2s ease-out, background-color 0.15s ease',
                '&:hover': {
                  backgroundColor: 'rgba(255,255,255,0.04)',
                },
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
              }}
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
      )}
    </Box>
  );
}
