import React, { useEffect, forwardRef } from 'react';
import { Snackbar, Alert, Stack, SnackbarProps } from '@mui/material';
import { useUIStore } from '../stores';

/**
 * Custom Snackbar component that filters out unsupported props
 * This prevents the "ownerState" prop from being passed to ClickAwayListener
 */
const CustomSnackbar = forwardRef<HTMLDivElement, SnackbarProps>(
  (props, ref) => {
    // Extract only the props we need to pass to Snackbar
    const { children, open, autoHideDuration, onClose, anchorOrigin, sx, key } =
      props;

    return (
      <Snackbar
        key={key}
        ref={ref}
        anchorOrigin={anchorOrigin}
        autoHideDuration={autoHideDuration}
        onClose={onClose}
        open={open}
        sx={sx}
      >
        {children}
      </Snackbar>
    );
  },
);

CustomSnackbar.displayName = 'CustomSnackbar';

/**
 * NotificationSystem component
 *
 * Displays notifications from the UIStore as Snackbars
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

  return (
    <Stack
      spacing={2}
      sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 2000 }}
    >
      {visibleNotifications.map((notification) => (
        <CustomSnackbar
          key={notification.id}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          autoHideDuration={notification.autoHideDuration}
          onClose={() => removeNotification(notification.id)}
          open
          sx={{ position: 'static', mb: 1 }}
        >
          <Alert
            onClose={() => removeNotification(notification.id)}
            severity={notification.type}
            sx={{ width: '100%' }}
            variant="filled"
          >
            {notification.message}
          </Alert>
        </CustomSnackbar>
      ))}
    </Stack>
  );
}
