import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  FormControlLabel,
  FormGroup,
  Switch,
  Button,
  TextField,
  InputAdornment,
  IconButton,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import BackupIcon from '@mui/icons-material/Backup';
import CloseIcon from '@mui/icons-material/Close';
import { useUIStore } from '../stores';
import useLibraryTaskStore, {
  selectTaskRunning,
} from '../stores/libraryTaskStore';
import {
  useResetDatabase,
  useSettings,
  useUpdateSettings,
  getSettingsSnapshot,
  DEFAULT_COLUMNS,
} from '../queries';
import { startBackup, startImport, startRescan } from '../utils/libraryTasks';
import { mutedIconButtonSx } from '../styles/iconButtonStyles';
import ConfirmationDialog from './ConfirmationDialog';

const TASK_LABELS = { scan: 'rescan', import: 'import', backup: 'backup' };

// Define the props for the Settings component
interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  // Settings come from TanStack Query. Module-level fallbacks keep
  // first-render UI consistent before the cache resolves.
  const settings = useSettings().data;
  const libraryPath = settings?.libraryPath ?? '';
  const theme = settings?.theme ?? 'dark';
  const columns = settings?.columns ?? DEFAULT_COLUMNS;
  const sortArtistByAlbumArtist = settings?.sortArtistByAlbumArtist ?? true;
  const updateSettings = useUpdateSettings();
  const resetDatabaseMutation = useResetDatabase();

  // Rescans, imports and backups run in the background with progress in
  // LibraryTaskPanel. One runs at a time, and the music folder and reset
  // controls are locked while it does: changing either mid-task would
  // pull the library out from under it.
  const taskRunning = useLibraryTaskStore(selectTaskRunning);
  const runningKind = useLibraryTaskStore((state) =>
    selectTaskRunning(state) ? state.task?.kind : undefined,
  );

  // ui store stuff
  const showNotification = useUIStore((state) => state.showNotification);

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  // Reference to store the original path for restoration if canceled
  const originalPathRef = useRef('');

  const handleThemeChange = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    updateSettings.mutate({ theme: newTheme });
  };

  const handleSortArtistByAlbumArtistChange = () => {
    updateSettings.mutate({
      sortArtistByAlbumArtist: !sortArtistByAlbumArtist,
    });
  };

  const handleColumnVisibilityChange = (column: keyof typeof columns) => {
    // Read current columns at click time from the cache (post-onMutate
    // optimistic merge) so rapid checkbox clicks see the previous
    // optimistic state instead of stale closure data.
    const current = getSettingsSnapshot()?.columns ?? columns;
    updateSettings.mutate({
      columns: { ...current, [column]: !current[column] },
    });
  };

  const handleRescanLibrary = () => {
    if (!libraryPath) {
      showNotification('Please set a library path first', 'warning');
      return;
    }
    startRescan(libraryPath);
  };

  const handleAddSongs = async () => {
    if (!libraryPath) {
      showNotification('Please set a library path first', 'warning');
      return;
    }

    try {
      const result = await window.electron.dialog.selectFiles();
      if (
        result.canceled ||
        !result.filePaths ||
        result.filePaths.length === 0
      ) {
        return;
      }
      startImport(result.filePaths);
    } catch (error) {
      console.error('Error importing files:', error);
      showNotification('Failed to import files', 'error');
    }
  };

  const handleBackupLibrary = async () => {
    if (!libraryPath) {
      showNotification('Please set a library path first', 'warning');
      return;
    }

    try {
      const result = await window.electron.dialog.selectDirectory();
      if (
        result.canceled ||
        !result.filePaths ||
        result.filePaths.length === 0
      ) {
        return;
      }

      const backupPath = result.filePaths[0];

      if (backupPath === libraryPath || backupPath.startsWith(libraryPath)) {
        showNotification(
          'Cannot backup to the same folder or its subfolder',
          'warning',
        );
        return;
      }

      startBackup(backupPath);
    } catch (error) {
      console.error('Error backing up library:', error);
      showNotification(
        error instanceof Error ? error.message : 'Error backing up library',
        'error',
      );
    }
  };

  const handleSelectLibraryPath = async () => {
    if (taskRunning) return;
    originalPathRef.current = libraryPath;
    try {
      const result = await window.electron.dialog.selectDirectory();
      if ('error' in result) {
        showNotification(result.error, 'error');
        return;
      }

      const newLibraryPath =
        !result.canceled && result.filePaths.length > 0
          ? result.filePaths[0]
          : originalPathRef.current;

      // Check if the library path exists
      const pathExists =
        await window.electron.fileSystem.fileExists(newLibraryPath);

      if (!pathExists) {
        showNotification('The specified library path does not exist', 'error');
        updateSettings.mutate({ libraryPath: originalPathRef.current });
        return;
      }

      updateSettings.mutate({ libraryPath: newLibraryPath });
      setPathDialogOpen(true);
    } catch (error) {
      console.error('Error validating library path:', error);
      showNotification('Error validating library path', 'error');
    }
  };

  // Confirming a music folder change clears the old library and scans
  // the new folder as one background task. The current library stays on
  // screen until the new one is ready.
  const handleConfirmPathChange = () => {
    setPathDialogOpen(false);
    showNotification('Library path saved successfully', 'success');
    startRescan(libraryPath, { replaceExisting: true });
  };

  // New function to handle cancellation of library path change
  const handleCancelPathChange = () => {
    setPathDialogOpen(false);
    // Revert to the original path
    updateSettings.mutate({ libraryPath: originalPathRef.current });
  };

  const handleResetDatabase = async () => {
    setResetDialogOpen(true);
  };

  const handleConfirmReset = async () => {
    try {
      setResetDialogOpen(false);
      const result = await resetDatabaseMutation.mutateAsync();

      if (result.success) {
        showNotification(
          'Database reset successfully. Restarting app...',
          'success',
        );

        // Wait a moment to show the success message before restarting
        setTimeout(async () => {
          await window.electron.app.restart();
        }, 1500);
      } else {
        showNotification(
          `Failed to reset database: ${result.message}`,
          'error',
        );
      }
    } catch (error) {
      console.error('Error resetting database:', error);
      showNotification('Error resetting database', 'error');
    }
  };

  const handleCancelReset = () => {
    setResetDialogOpen(false);
  };

  const busyCaption = taskRunning && (
    <Typography
      color="text.secondary"
      data-testid="settings-task-locked"
      sx={{ display: 'block', fontSize: '0.75rem', fontStyle: 'italic' }}
    >
      Available when the current{' '}
      {runningKind ? TASK_LABELS[runningKind] : 'task'} finishes.
    </Typography>
  );

  return (
    <Box
      data-testid="settings-view"
      sx={{ height: '100%', width: '100%', overflow: 'auto' }}
    >
      {/* Settings Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 2,
          py: 0.5,
          // Match the library/playlist top toolbar height (.vt-toolbar
          // min-height: 44px in virtualTable.css) so the Settings header
          // lines up with every other header in the app.
          minHeight: 44,
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          position: 'sticky',
          top: 0,
          backgroundColor: (t) => t.palette.background.paper,
          zIndex: 1,
          WebkitAppRegion: 'drag',
        }}
      >
        <Typography
          color="text.primary"
          sx={{ userSelect: 'none' }}
          variant="h2"
        >
          Settings
        </Typography>
        <IconButton
          aria-label="Close settings"
          data-testid="settings-close"
          onClick={onClose}
          size="small"
          sx={{ ...mutedIconButtonSx, WebkitAppRegion: 'no-drag' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>

      <Paper elevation={1} sx={{ WebkitAppRegion: 'no-drag', p: 2 }}>
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography gutterBottom variant="h3">
            Music Folder
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ display: 'block', mb: 2 }}
            variant="caption"
          >
            The folder on your computer where your music files live. hihat scans
            this folder and all its subfolders.
          </Typography>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <TextField
              disabled={taskRunning}
              label="Folder"
              onChange={handleSelectLibraryPath}
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        aria-label="Choose music folder"
                        disabled={taskRunning}
                        edge="end"
                        onClick={handleSelectLibraryPath}
                      >
                        <FolderIcon />
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
              value={libraryPath}
            />
          </FormControl>
          {busyCaption && <Box sx={{ mt: 1 }}>{busyCaption}</Box>}
        </Paper>

        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography gutterBottom variant="h3">
            Import Music
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography
              color="text.secondary"
              sx={{ display: 'block', fontSize: '0.75rem' }}
            >
              Add new songs or entire folders to your library. Files are copied
              into your Music Folder, so the originals stay right where they
              are. Duplicates are skipped automatically.
            </Typography>
            <Button
              color="primary"
              disabled={!libraryPath || taskRunning}
              fullWidth
              onClick={handleAddSongs}
              startIcon={<AddIcon />}
              variant="contained"
            >
              {runningKind === 'import' ? 'Importing…' : 'Add Songs'}
            </Button>
          </Box>
        </Paper>

        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography gutterBottom variant="h3">
            Rescan Library
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Typography
              color="text.secondary"
              sx={{ display: 'block', fontSize: '0.75rem' }}
            >
              Check your music folder for any new, changed, or removed files and
              update your library to match.
            </Typography>
            <Button
              color="primary"
              disabled={!libraryPath || taskRunning}
              fullWidth
              onClick={handleRescanLibrary}
              startIcon={<RefreshIcon />}
              variant="contained"
            >
              {runningKind === 'scan' ? 'Scanning…' : 'Rescan Library'}
            </Button>
          </Box>
        </Paper>

        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography gutterBottom variant="h3">
            Backup Library
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ display: 'block', mb: 2 }}
            variant="caption"
          >
            Copy your music library to an external drive or another folder. Only
            new and changed files are copied each time, so backups after the
            first one are fast. Your existing backup files are never removed.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Button
              color="primary"
              disabled={!libraryPath || taskRunning}
              onClick={handleBackupLibrary}
              startIcon={<BackupIcon />}
              variant="contained"
            >
              {runningKind === 'backup' ? 'Backing Up…' : 'Backup Library'}
            </Button>
          </Box>
        </Paper>

        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography gutterBottom variant="h3">
            Appearance
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ display: 'block', mb: 2 }}
            variant="caption"
          >
            Switch between dark and light themes. The dark theme is easier on
            the eyes, and the light theme has a classic iTunes feel.
          </Typography>

          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={theme === 'dark'}
                  data-testid="theme-toggle"
                  onChange={handleThemeChange}
                />
              }
              label="Dark Theme"
            />
          </FormGroup>
        </Paper>

        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography gutterBottom variant="h3">
            Sorting
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ display: 'block', mb: 2 }}
            variant="caption"
          >
            This causes the Artist column to sort itself by Album Artist
            instead. This keeps multi-artist songs in their original
            album&apos;s order, instead of grouping them at the end of the
            album.
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={sortArtistByAlbumArtist}
                  data-testid="sort-artist-by-album-artist-toggle"
                  onChange={handleSortArtistByAlbumArtistChange}
                />
              }
              label="Sort Artist by Album Artist"
            />
          </FormGroup>
        </Paper>

        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography gutterBottom variant="h3">
            Column Visibility
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ display: 'block', mb: 2 }}
            variant="caption"
          >
            Choose which columns appear in your library and playlist tables. You
            can also right-click any column header to toggle visibility.
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={columns.title}
                  onChange={() => handleColumnVisibilityChange('title')}
                />
              }
              label="Title"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columns.artist}
                  onChange={() => handleColumnVisibilityChange('artist')}
                />
              }
              label="Artist"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columns.album}
                  onChange={() => handleColumnVisibilityChange('album')}
                />
              }
              label="Album"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columns.albumArtist}
                  onChange={() => handleColumnVisibilityChange('albumArtist')}
                />
              }
              label="Album Artist"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columns.genre}
                  onChange={() => handleColumnVisibilityChange('genre')}
                />
              }
              label="Genre"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columns.duration}
                  onChange={() => handleColumnVisibilityChange('duration')}
                />
              }
              label="Time"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columns.playCount}
                  onChange={() => handleColumnVisibilityChange('playCount')}
                />
              }
              label="Play Count"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columns.dateAdded}
                  onChange={() => handleColumnVisibilityChange('dateAdded')}
                />
              }
              label="Date Added"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columns.lastPlayed}
                  onChange={() => handleColumnVisibilityChange('lastPlayed')}
                />
              }
              label="Last Played"
            />
          </FormGroup>
        </Paper>

        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography gutterBottom variant="h3">
            Reset
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Button
              color="error"
              disabled={taskRunning}
              onClick={handleResetDatabase}
              startIcon={<WarningIcon />}
              sx={{ mb: 2 }}
              variant="contained"
            >
              Reset Database
            </Button>
            <Typography color="text.secondary" variant="body2">
              Start fresh by clearing your hihat database — play counts,
              playlists, and settings will be removed. Your actual music files
              are never touched.
            </Typography>
            {busyCaption && <Box sx={{ mt: 1 }}>{busyCaption}</Box>}
          </Box>
        </Paper>
      </Paper>

      {/* Library path confirmation dialog */}
      <ConfirmationDialog
        cancelText="Cancel"
        confirmButtonColor="primary"
        confirmText="Scan New Folder"
        message="Switching your music folder will clear your current library and scan the new location. This may take a few minutes for large collections. Your play counts and playlists will be kept."
        onCancel={handleCancelPathChange}
        onConfirm={handleConfirmPathChange}
        open={pathDialogOpen}
        title="Change Music Folder"
      />

      {/* Reset database confirmation dialog */}
      <ConfirmationDialog
        cancelText="Cancel"
        confirmButtonColor="error"
        confirmText="Reset Database"
        message="This will clear your play counts, playlists, and settings, and restart hihat with a clean slate. Your music files will not be deleted."
        onCancel={handleCancelReset}
        onConfirm={handleConfirmReset}
        open={resetDialogOpen}
        title="Reset hihat"
      />
    </Box>
  );
}
