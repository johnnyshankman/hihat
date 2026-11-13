import { useRef } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Fade,
  IconButton,
  LinearProgress,
  Paper,
  Typography,
} from '@mui/material';
import BackupRoundedIcon from '@mui/icons-material/BackupRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import LibraryAddRoundedIcon from '@mui/icons-material/LibraryAddRounded';
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded';
import SyncRoundedIcon from '@mui/icons-material/SyncRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import type { InterruptedLibraryTask, LibraryTaskKind } from '../../types/ipc';
import { getSettingsSnapshot, useTracks } from '../queries';
import useLibraryTaskStore, {
  LibraryTaskView,
} from '../stores/libraryTaskStore';
import { duration, easing } from '../styles/motion';
import { formatEta } from '../utils/formatters';
import { startBackup, startRescan } from '../utils/libraryTasks';

// Sits just above the 100px player bar (MainLayout's PlayerWrapper).
const PLAYER_HEIGHT = 100;
const GUTTER = 12;

const COPY: Record<
  LibraryTaskKind,
  { running: string; done: string; failed: string; interrupted: string }
> = {
  scan: {
    running: 'Rescanning library',
    done: 'Rescan complete',
    failed: 'Rescan failed',
    interrupted: "Last rescan didn't finish",
  },
  import: {
    running: 'Importing songs',
    done: 'Import complete',
    failed: 'Import failed',
    interrupted: "Last import didn't finish",
  },
  backup: {
    running: 'Backing up library',
    done: 'Backup complete',
    failed: 'Backup failed',
    interrupted: "Last backup didn't finish",
  },
};

const KIND_ICONS: Record<LibraryTaskKind, typeof SyncRoundedIcon> = {
  scan: SyncRoundedIcon,
  import: LibraryAddRoundedIcon,
  backup: BackupRoundedIcon,
};

function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

function percent(task: LibraryTaskView): number {
  return task.total > 0 ? (task.processed / task.total) * 100 : 0;
}

function progressLine(task: LibraryTaskView): string {
  if (task.total === 0) return task.status ?? 'Getting ready…';
  const counts = `${task.processed.toLocaleString()} of ${task.total.toLocaleString()} files`;
  const eta =
    task.progressStartedAt > 0
      ? formatEta(
          Date.now() - task.progressStartedAt,
          task.processed,
          task.total,
        )
      : '';
  return eta ? `${counts} · about ${eta} left` : counts;
}

function RunningBody({ task }: { task: LibraryTaskView }) {
  const determinate = task.total > 0;
  return (
    <>
      <LinearProgress
        data-testid="library-task-progress"
        sx={{ borderRadius: 2, height: 4, my: 1.25 }}
        value={percent(task)}
        variant={determinate ? 'determinate' : 'indeterminate'}
      />
      <Typography color="text.secondary" variant="body2">
        {progressLine(task)}
      </Typography>
      {task.kind === 'backup' && task.currentFile && (
        <Typography
          color="text.secondary"
          noWrap
          sx={{ mt: 0.5 }}
          title={task.currentFile}
          variant="caption"
        >
          {fileName(task.currentFile)}
        </Typography>
      )}
    </>
  );
}

function InterruptedBody({
  interrupted,
}: {
  interrupted: InterruptedLibraryTask;
}) {
  const dismiss = () => {
    useLibraryTaskStore.getState().setInterrupted(null);
    window.electron.library.dismissInterruptedTask().catch((error) => {
      console.error('Error dismissing interrupted task:', error);
    });
  };
  const libraryPath = getSettingsSnapshot()?.libraryPath;
  const isBackup = interrupted.kind === 'backup';
  const canRetry = isBackup ? !!interrupted.backupPath : !!libraryPath;
  const retry = () => {
    if (isBackup && interrupted.backupPath) {
      startBackup(interrupted.backupPath);
    } else if (libraryPath) {
      startRescan(libraryPath);
    }
  };

  return (
    <>
      <Typography color="text.secondary" sx={{ mt: 0.75 }} variant="body2">
        {isBackup
          ? 'Files already copied are safe in your backup. Run it again to copy the rest.'
          : 'Songs found so far were kept. Rescan to finish updating your library.'}
      </Typography>
      <Box
        sx={{ display: 'flex', gap: 1, justifyContent: 'flex-end', mt: 1.5 }}
      >
        <Button
          color="inherit"
          data-testid="library-task-dismiss"
          onClick={dismiss}
          size="small"
          sx={{ color: 'text.secondary' }}
        >
          Dismiss
        </Button>
        {canRetry && (
          <Button
            data-testid="library-task-retry"
            disableElevation
            onClick={retry}
            size="small"
            variant="contained"
          >
            {isBackup ? 'Back up again' : 'Rescan now'}
          </Button>
        )}
      </Box>
    </>
  );
}

/**
 * Progress for the running library task, pinned above the player in the
 * bottom-right corner. Replaces the modal dialogs that used to lock the
 * app during rescans, imports and backups. Also reports a task the
 * previous run never finished, with a one-click way to finish it.
 */
export default function LibraryTaskPanel() {
  const task = useLibraryTaskStore((state) => state.task);
  const interrupted = useLibraryTaskStore((state) => state.interrupted);
  const minimized = useLibraryTaskStore((state) => state.minimized);
  const setMinimized = useLibraryTaskStore((state) => state.setMinimized);
  const dismiss = useLibraryTaskStore((state) => state.dismiss);
  const libraryIsEmpty = useTracks().data?.tracks.length === 0;

  // The welcome screen shows the first scan's progress inline; don't
  // repeat it here.
  const welcomeShowsTask = libraryIsEmpty && task?.kind === 'scan';
  const content = task && !welcomeShowsTask ? task : null;
  const visible = !!content || (!task && !!interrupted);

  // Keep the last content mounted while the panel fades out.
  const lastRendered = useRef<{
    task: LibraryTaskView | null;
    interrupted: InterruptedLibraryTask | null;
  }>({ task: null, interrupted: null });
  if (visible) lastRendered.current = { task: content, interrupted };
  const shown = lastRendered.current;
  const shownTask = shown.task;
  const shownKind = shownTask?.kind ?? shown.interrupted?.kind ?? 'scan';
  const KindIcon = KIND_ICONS[shownKind];

  let title = '';
  let icon = <KindIcon fontSize="small" />;
  if (shownTask?.phase === 'running') {
    title = `${COPY[shownKind].running}…`;
  } else if (shownTask?.phase === 'done') {
    title = COPY[shownKind].done;
    icon = <CheckCircleRoundedIcon color="success" fontSize="small" />;
  } else if (shownTask?.phase === 'error') {
    title = COPY[shownKind].failed;
    icon = <ErrorOutlineRoundedIcon color="error" fontSize="small" />;
  } else if (shown.interrupted) {
    title = COPY[shownKind].interrupted;
    icon = <WarningAmberRoundedIcon color="warning" fontSize="small" />;
  }

  const running = shownTask?.phase === 'running';
  const collapsed = running && minimized;

  return (
    <Fade in={visible} timeout={220} unmountOnExit>
      <Paper
        aria-label={title}
        aria-live="polite"
        data-phase={shownTask?.phase ?? 'interrupted'}
        data-testid="library-task-panel"
        elevation={8}
        role="status"
        sx={{
          animation: `hihat-task-panel-in ${duration.base} ${easing.out} both`,
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: '10px',
          bottom: PLAYER_HEIGHT + GUTTER,
          position: 'fixed',
          px: 1.75,
          py: collapsed ? 1 : 1.5,
          right: GUTTER,
          WebkitAppRegion: 'no-drag',
          width: collapsed ? 'auto' : 320,
          // Above the Settings drawer (1200) so progress stays in view
          // while it's open; below modals (1300).
          zIndex: 1250,
          // Fade owns opacity (in and out); this only adds the rise.
          '@keyframes hihat-task-panel-in': {
            from: { transform: 'translateY(8px)' },
            to: { transform: 'translateY(0)' },
          },
        }}
      >
        {collapsed && shownTask ? (
          <Box
            aria-label="Show progress"
            component="button"
            data-testid="library-task-expand"
            onClick={() => setMinimized(false)}
            sx={{
              alignItems: 'center',
              background: 'none',
              border: 0,
              color: 'text.primary',
              cursor: 'pointer',
              display: 'flex',
              font: 'inherit',
              gap: 1,
              p: 0,
            }}
          >
            <CircularProgress
              size={16}
              thickness={5}
              value={percent(shownTask)}
              variant={shownTask.total > 0 ? 'determinate' : 'indeterminate'}
            />
            <Typography variant="body2">
              {COPY[shownKind].running}
              {shownTask.total > 0
                ? ` · ${Math.floor(percent(shownTask))}%`
                : '…'}
            </Typography>
          </Box>
        ) : (
          <>
            <Box sx={{ alignItems: 'center', display: 'flex', gap: 1 }}>
              <Box sx={{ color: 'text.secondary', display: 'flex' }}>
                {icon}
              </Box>
              <Typography
                data-testid="library-task-title"
                sx={{ flex: 1, fontWeight: 600 }}
                variant="body2"
              >
                {title}
              </Typography>
              {running && (
                <IconButton
                  aria-label="Minimize progress"
                  data-testid="library-task-minimize"
                  onClick={() => setMinimized(true)}
                  size="small"
                  sx={{ mr: -0.75 }}
                >
                  <RemoveRoundedIcon fontSize="small" />
                </IconButton>
              )}
              {shownTask?.phase === 'error' && (
                <IconButton
                  aria-label="Dismiss"
                  data-testid="library-task-close"
                  onClick={dismiss}
                  size="small"
                  sx={{ mr: -0.75 }}
                >
                  <CloseRoundedIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            {running && shownTask && <RunningBody task={shownTask} />}
            {(shownTask?.phase === 'done' || shownTask?.phase === 'error') && (
              <Typography
                color="text.secondary"
                sx={{ mt: 0.75 }}
                variant="body2"
              >
                {shownTask.message}
              </Typography>
            )}
            {!shownTask && shown.interrupted && (
              <InterruptedBody interrupted={shown.interrupted} />
            )}
          </>
        )}
      </Paper>
    </Fade>
  );
}
