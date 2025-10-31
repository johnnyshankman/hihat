import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  LinearProgress,
} from '@mui/material';

interface MigrationProgress {
  phase: 'starting' | 'reading' | 'converting' | 'importing' | 'complete';
  message: string;
  tracksCount?: number;
  playlistsCount?: number;
}

export default function MigrationDialog() {
  const [open, setOpen] = useState(false);
  const [progress, setProgress] = useState<MigrationProgress>({
    phase: 'starting',
    message: 'Preparing migration...',
  });
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    // Listen for migration start event
    const handleMigrationStart = () => {
      setOpen(true);
      setIsComplete(false);
      setProgress({
        phase: 'starting',
        message: 'Starting migration from hihat v1...',
      });
    };

    // Listen for migration progress events
    const handleMigrationProgress = (...args: unknown[]) => {
      const data = args[0] as MigrationProgress;
      setProgress(data);
    };

    // Listen for migration complete event
    const handleMigrationComplete = (...args: unknown[]) => {
      const data = args[0] as {
        tracksCount: number;
        playlistsCount: number;
      };
      setProgress({
        phase: 'complete',
        message: 'Migration complete!',
        tracksCount: data.tracksCount,
        playlistsCount: data.playlistsCount,
      });
      setIsComplete(true);
    };

    // Register IPC listeners - on() returns a cleanup function
    const unsubscribeStart = window.electron.ipcRenderer.on(
      'migration:start',
      handleMigrationStart,
    );
    const unsubscribeProgress = window.electron.ipcRenderer.on(
      'migration:progress',
      handleMigrationProgress,
    );
    const unsubscribeComplete = window.electron.ipcRenderer.on(
      'migration:complete',
      handleMigrationComplete,
    );

    // Cleanup by calling the unsubscribe functions
    return () => {
      unsubscribeStart();
      unsubscribeProgress();
      unsubscribeComplete();
    };
  }, []);

  const handleClose = () => {
    setOpen(false);
    // Reload the window to show the migrated data
    window.location.reload();
  };

  const getPhaseDescription = () => {
    switch (progress.phase) {
      case 'starting':
        return 'Initializing migration process...';
      case 'reading':
        return 'Reading your hihat v1 library data...';
      case 'converting':
        return 'Converting tracks and playlists to new format...';
      case 'importing':
        return 'Importing data into hihat v2 database...';
      case 'complete':
        return 'Your library has been successfully migrated!';
      default:
        return 'Processing...';
    }
  };

  return (
    <Dialog
      open={open}
      disableEscapeKeyDown
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: 'background.paper',
        },
      }}
      data-testid="migration-dialog"
    >
      <DialogTitle>
        <Typography variant="h6" component="div">
          {isComplete ? 'Migration Complete' : 'Migrating from hihat v1'}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography variant="body1" gutterBottom>
            {getPhaseDescription()}
          </Typography>

          {!isComplete && (
            <Box sx={{ mt: 3, mb: 2 }}>
              <LinearProgress />
            </Box>
          )}

          {progress.message && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 2 }}
              data-testid="migration-message"
            >
              {progress.message}
            </Typography>
          )}

          {isComplete && progress.tracksCount !== undefined && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="body2" color="success.main">
                Successfully migrated {progress.tracksCount} tracks
                {progress.playlistsCount && progress.playlistsCount > 0
                  ? ` and ${progress.playlistsCount} playlists`
                  : ''}
                !
              </Typography>
            </Box>
          )}

          {!isComplete && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ mt: 2, display: 'block' }}
            >
              Please wait while we transfer your library. This may take a few
              moments.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={handleClose}
          variant="contained"
          disabled={!isComplete}
          data-testid="migration-continue-button"
        >
          {isComplete ? 'Continue' : 'Migrating...'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
