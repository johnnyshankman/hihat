import { useMutation } from '@tanstack/react-query';
import useUIStore from '../stores/uiStore';

/**
 * Show the OS directory picker. Modeled as a mutation (not a query) since
 * it's user-triggered and one-shot — there is no idempotent "current
 * selection" to cache.
 */
export function useSelectDirectory() {
  return useMutation({
    mutationFn: () => window.electron.dialog.selectDirectory(),
    onError: (err) => {
      console.error('Failed to open directory picker:', err);
      useUIStore
        .getState()
        .showNotification('Failed to open directory picker', 'error');
    },
  });
}

/** Show the OS file/directory multi-selection picker. */
export function useSelectFiles() {
  return useMutation({
    mutationFn: () => window.electron.dialog.selectFiles(),
    onError: (err) => {
      console.error('Failed to open file picker:', err);
      useUIStore
        .getState()
        .showNotification('Failed to open file picker', 'error');
    },
  });
}
