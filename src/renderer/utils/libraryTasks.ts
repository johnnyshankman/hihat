import useUIStore from '../stores/uiStore';
import useLibraryTaskStore from '../stores/libraryTaskStore';

/**
 * Starters for the long-running library tasks. Plain functions rather
 * than mutation hooks: a task outlives whatever started it (the Settings
 * drawer can close mid-scan), and its progress and outcome arrive as
 * main-process events that `useLibraryTaskEvents` feeds into
 * `libraryTaskStore`. These only report failures that never became a
 * task the panel can show, such as another task already running.
 */

function reportStartFailure(message: string): void {
  // A task that started and then failed is shown in the progress panel.
  if (useLibraryTaskStore.getState().task?.phase === 'error') return;
  useUIStore.getState().showNotification(message, 'warning');
}

export async function startRescan(
  libraryPath: string,
  options: { replaceExisting?: boolean } = {},
): Promise<void> {
  try {
    const result = await window.electron.library.scan(libraryPath, options);
    if (!result.success) reportStartFailure(result.message);
  } catch (error) {
    console.error('Error scanning library:', error);
    reportStartFailure('Failed to scan library');
  }
}

export async function startImport(files: string[]): Promise<void> {
  try {
    const result = await window.electron.library.import(files);
    if (!result.success) reportStartFailure(result.message);
  } catch (error) {
    console.error('Error importing files:', error);
    reportStartFailure('Failed to import files');
  }
}

/** Fire-and-forget; progress and the outcome arrive as events. */
export function startBackup(backupPath: string): void {
  window.electron.backup.start(backupPath);
}
