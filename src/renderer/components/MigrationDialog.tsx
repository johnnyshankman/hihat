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
    const unsubscribeStart = window.electron.migration.onStart(() => {
      setOpen(true);
      setIsComplete(false);
      setProgress({
        phase: 'starting',
        message: 'Starting migration from hihat v1...',
      });
    });

    const unsubscribeProgress = window.electron.migration.onProgress((data) => {
      setProgress(data);
    });

    const unsubscribeComplete = window.electron.migration.onComplete((data) => {
      setProgress({
        phase: 'complete',
        message: 'Migration complete!',
        tracksCount: data.tracksCount,
        playlistsCount: data.playlistsCount,
      });
      setIsComplete(true);
    });

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
      data-testid="migration-dialog"
      fullWidth
      maxWidth="sm"
      open={open}
      slotProps={{
        paper: {
          sx: {
            bgcolor: 'background.paper',
          },
        },
      }}
    >
      <DialogTitle>
        <Typography component="div" variant="h6">
          {isComplete ? 'Migration Complete' : 'Migrating from hihat v1'}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography gutterBottom variant="body1">
            {getPhaseDescription()}
          </Typography>

          {!isComplete && (
            <Box sx={{ mt: 3, mb: 2 }}>
              <LinearProgress />
            </Box>
          )}

          {progress.message && (
            <Typography
              color="text.secondary"
              data-testid="migration-message"
              sx={{ mt: 2 }}
              variant="body2"
            >
              {progress.message}
            </Typography>
          )}

          {isComplete && progress.tracksCount !== undefined && (
            <Box sx={{ mt: 3 }}>
              <Typography color="success.main" variant="body2">
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
              color="text.secondary"
              sx={{ mt: 2, display: 'block' }}
              variant="caption"
            >
              Please wait while we transfer your library. This may take a few
              moments.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button
          data-testid="migration-continue-button"
          disabled={!isComplete}
          onClick={handleClose}
          variant="contained"
        >
          {isComplete ? 'Continue' : 'Migrating...'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
