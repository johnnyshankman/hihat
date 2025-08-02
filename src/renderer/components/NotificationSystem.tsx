import React, { useEffect } from 'react';
import { Alert, Box } from '@mui/material';
import { useUIStore } from '../stores';

/**
 * NotificationSystem component
 *
 * Displays notifications from the UIStore as stacked Alerts
 * Limited to showing only the latest 3 notifications at a time
 * Automatically dismisses older notifications that are not visible
 */
export default function NotificationSystem() {
  const notifications = useUIStore((state) => state.notifications);
  const removeNotification = useUIStore((state) => state.removeNotification);

  // Limit to the most recent 3 notifications
  const visibleNotifications = notifications.slice(-3);

  // Automatically dismiss notifications that are not visible
  useEffect(() => {
    // Find notifications that are not in the visible set
    const notVisibleNotifications = notifications.filter(
      (notification) =>
        !visibleNotifications.some(
          (visibleNotification) => visibleNotification.id === notification.id,
        ),
    );

    // Dismiss each notification that's not visible
    notVisibleNotifications.forEach((notification) => {
      removeNotification(notification.id);
    });
  }, [notifications, visibleNotifications, removeNotification]);

  // Auto-dismiss notifications after their duration
  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];

    visibleNotifications.forEach((notification) => {
      if (notification.autoHideDuration) {
        const timer = setTimeout(() => {
          removeNotification(notification.id);
        }, notification.autoHideDuration);
        timers.push(timer);
      }
    });

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [visibleNotifications, removeNotification]);

  return (
    <Box
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {visibleNotifications.map((notification) => (
        <Alert
          key={notification.id}
          onClose={() => removeNotification(notification.id)}
          severity={notification.type}
          sx={{
            width: '100%',
            minWidth: '300px',
            color: 'white',
            animation: 'slideIn 0.3s ease-out',
            '@keyframes slideIn': {
              from: {
                transform: 'translateX(100%)',
                opacity: 0,
              },
              to: {
                transform: 'translateX(0)',
                opacity: 1,
              },
            },
          }}
          variant="filled"
        >
          {notification.message}
        </Alert>
      ))}
    </Box>
  );
}
