import React, { useState, useEffect, useRef } from 'react';
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
  Snackbar,
  Alert,
  AppBar,
  Toolbar,
  Dialog,
  DialogTitle,
  DialogContent,
  LinearProgress,
  Grid,
  Divider,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import BackupIcon from '@mui/icons-material/Backup';
import { useSettingsStore } from '../stores';
import ConfirmationDialog from './ConfirmationDialog';
import SidebarToggle from './SidebarToggle';
import type { Channels } from '../../types/ipc';
import useLibraryStore from '../stores/libraryStore';

// Define the type for the dialog result
interface DirectorySelectionResult {
  canceled: boolean;
  filePaths: string[];
}

// Define the props for the Settings component
interface SettingsProps {
  drawerOpen: boolean;
  onDrawerToggle: () => void;
}

export default function Settings({
  drawerOpen,
  onDrawerToggle,
}: SettingsProps) {
  // settings store stuff
  const libraryPath = useSettingsStore((state) => state.libraryPath);
  const theme = useSettingsStore((state) => state.theme);
  const columns = useSettingsStore((state) => state.columns);
  const updateColumnVisibility = useSettingsStore(
    (state) => state.setColumnVisibility,
  );
  const loadLibrary = useLibraryStore((state) => state.loadLibrary);
  const setLibraryPath = useSettingsStore((state) => state.setLibraryPath);
  const updateTheme = useSettingsStore((state) => state.setTheme);
  // library store stuff
  const scanLibrary = useLibraryStore((state) => state.scanLibrary);
  const importFiles = useLibraryStore((state) => state.importFiles);
  const isScanning = useLibraryStore((state) => state.isScanning);

  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  const [backupDialogOpen, setBackupDialogOpen] = useState(false);
  const [isBackupInProgress, setIsBackupInProgress] = useState(false);
  // Reference to store the original path for restoration if canceled
  const originalPathRef = useRef('');

  // Scanning state
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');
  const [backupStatus, setBackupStatus] = useState('');

  // Add a ref to track the last time we updated the UI for scan progress
  const lastUpdateTime = useRef(0);

  // Listen for scan progress events
  useEffect(() => {
    // Throttle updates to once every 1000ms (1 second)
    const updateThreshold = 1000; // milliseconds

    const handleScanProgress = (...args: unknown[]) => {
      const data = args[0] as {
        total: number;
        processed: number;
        current: string;
      };

      const now = Date.now();
      // Only update the UI if enough time has passed since the last update
      // or if this is the first file, every 50th file, or the last file
      if (
        now - lastUpdateTime.current > updateThreshold ||
        data.processed === 1 ||
        data.processed % 50 === 0 ||
        data.processed === data.total
      ) {
        setScanProgress((data.processed / data.total) * 100); // Convert to percentage
        setScanStatus(data.current);
        lastUpdateTime.current = now;
      }
    };

    const handleScanComplete = () => {
      setScanStatus('Complete');
      setScanProgress(100);
      setSnackbarMessage('Library scan completed successfully');
      setSnackbarOpen(true);
    };

    // Register event listeners
    const unsubScanProgress = window.electron.ipcRenderer.on(
      'library:scanProgress' as Channels,
      handleScanProgress,
    );

    const unsubScanComplete = window.electron.ipcRenderer.on(
      'library:scanComplete' as Channels,
      handleScanComplete,
    );

    // Listen for backup success or failure
    const unsubBackupSuccess = window.electron.ipcRenderer.on(
      'backup-library-success' as Channels,
      () => {
        setBackupDialogOpen(false);
        setIsBackupInProgress(false);
        setBackupStatus('');
        setSnackbarMessage('Library backup completed successfully');
        setSnackbarOpen(true);
      },
    );

    const unsubBackupError = window.electron.ipcRenderer.on(
      'backup-library-error' as Channels,
      (...args: unknown[]) => {
        const message = args[0] as string;
        setIsBackupInProgress(false);
        setBackupStatus('');
        setSnackbarMessage(`Backup failed: ${message}`);
        setSnackbarOpen(true);
      },
    );

    // Clean up event listeners
    return () => {
      unsubScanProgress();
      unsubScanComplete();
      unsubBackupSuccess();
      unsubBackupError();
    };
  }, []);

  const handleThemeChange = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';

    // Update in store and save to database immediately
    updateTheme(newTheme);
  };

  const handleColumnVisibilityChange = (column: keyof typeof columns) => {
    const newValue = !columns[column];

    // Update in store and save to database immediately
    updateColumnVisibility(column, newValue);
  };

  const handleRescanLibrary = async () => {
    if (!libraryPath) {
      setSnackbarMessage('Please set a library path first');
      setSnackbarOpen(true);
      return;
    }

    try {
      // Reset scan state
      setScanProgress(0);
      setScanStatus('');

      // Start the scan
      await scanLibrary(libraryPath);
    } catch (error) {
      console.error('Error scanning library:', error);
      setScanStatus('Failed');
      setSnackbarMessage(
        error instanceof Error ? error.message : 'Error scanning library',
      );
      setSnackbarOpen(true);
    }
  };

  const handleAddSongs = async () => {
    if (!libraryPath) {
      setSnackbarMessage('Please set a library path first');
      setSnackbarOpen(true);
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

      // Reset scan state
      setScanProgress(0);
      setScanStatus('');

      // Import the selected files
      await importFiles(result.filePaths);
    } catch (error) {
      console.error('Error importing files:', error);
      setScanStatus('Failed');
      setSnackbarMessage(
        error instanceof Error ? error.message : 'Error importing files',
      );
      setSnackbarOpen(true);
    }
  };

  const handleBackupLibrary = async () => {
    if (!libraryPath) {
      setSnackbarMessage('Please set a library path first');
      setSnackbarOpen(true);
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
        setSnackbarMessage('Cannot backup to the same folder or its subfolder');
        setSnackbarOpen(true);
        return;
      }

      // Show backup dialog
      setBackupDialogOpen(true);
      setIsBackupInProgress(true);
      setBackupStatus('Backing up library...');

      // Send IPC message to backup the library
      window.electron.ipcRenderer.sendMessage(
        'menu-backup-library',
        backupPath,
      );
    } catch (error) {
      console.error('Error backing up library:', error);
      setIsBackupInProgress(false);
      setBackupStatus('');
      setSnackbarMessage(
        error instanceof Error ? error.message : 'Error backing up library',
      );
      setSnackbarOpen(true);
    }
  };

  // Modified to show the confirmation dialog first
  const handleSaveLibraryPath = async () => {
    try {
      // Check if the library path exists
      const pathExists =
        await window.electron.fileSystem.fileExists(libraryPath);

      if (!pathExists) {
        setSnackbarMessage('The specified library path does not exist');
        setSnackbarOpen(true);
        setLibraryPath(originalPathRef.current);
        return;
      }

      // Open the confirmation dialog
      setPathDialogOpen(true);
    } catch (error) {
      console.error('Error validating library path:', error);
      setSnackbarMessage('Error validating library path');
      setSnackbarOpen(true);
    }
  };

  const handleSelectLibraryPath = async () => {
    originalPathRef.current = libraryPath;
    const result =
      (await window.electron.dialog.selectDirectory()) as DirectorySelectionResult;
    if (!result.canceled && result.filePaths.length > 0) {
      setLibraryPath(result.filePaths[0]);
    } else {
      setLibraryPath(originalPathRef.current);
    }

    handleSaveLibraryPath();
  };

  // New function to handle confirmation of library path change
  const handleConfirmPathChange = async () => {
    try {
      setPathDialogOpen(false);

      setSnackbarMessage('Library path saved successfully');
      setSnackbarOpen(true);

      try {
        // Reset scan state
        setScanProgress(0);
        setScanStatus('');

        // First, reset tracks in the database
        const resetResult = await window.electron.library.resetTracks();
        if (!resetResult.success) {
          console.error('Failed to reset tracks:', resetResult.message);
          setSnackbarMessage(`Failed to reset tracks: ${resetResult.message}`);
          setSnackbarOpen(true);
          return;
        }

        // Reload the library to clear the tracks in the UI
        await loadLibrary();

        // Now start the scan with the new library path
        await scanLibrary(libraryPath);
      } catch (error) {
        console.error('Error scanning library:', error);
        setScanStatus('Failed');
        setSnackbarMessage(
          error instanceof Error ? error.message : 'Error scanning library',
        );
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error saving library path:', error);
      setSnackbarMessage('Error saving library path');
      setSnackbarOpen(true);
    }
  };

  // New function to handle cancellation of library path change
  const handleCancelPathChange = () => {
    setPathDialogOpen(false);
    // Revert to the original path
    setLibraryPath(originalPathRef.current);
  };

  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  const handleResetDatabase = async () => {
    setResetDialogOpen(true);
  };

  const handleConfirmReset = async () => {
    try {
      setResetDialogOpen(false);
      const result = await window.electron.library.resetDatabase();

      if (result.success) {
        setSnackbarMessage('Database reset successfully. Restarting app...');
        setSnackbarOpen(true);

        // Wait a moment to show the success message before restarting
        setTimeout(async () => {
          await window.electron.app.restart();
        }, 1500);
      } else {
        setSnackbarMessage(`Failed to reset database: ${result.message}`);
        setSnackbarOpen(true);
      }
    } catch (error) {
      console.error('Error resetting database:', error);
      setSnackbarMessage('Error resetting database');
      setSnackbarOpen(true);
    }
  };

  const handleCancelReset = () => {
    setResetDialogOpen(false);
  };

  const getScanStatusText = () => {
    if (scanStatus === 'Failed') return 'Scan Failed';
    if (scanStatus === 'Complete') return 'Scan Complete';
    return 'Scanning...';
  };

  return (
    <Box sx={{ height: '100%', width: '100%', overflow: 'auto' }}>
      {/* Settings Header with Save Button for Library Path */}
      <AppBar
        color="default"
        elevation={1}
        position="sticky"
        sx={{ mb: 2, height: '62px' }}
      >
        <Toolbar sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SidebarToggle isOpen={drawerOpen} onToggle={onDrawerToggle} />
            <Typography variant="h1">Settings</Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, WebkitAppRegion: 'no-drag' }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Grid container spacing={3}>
            {/* Library Path Section */}
            <Grid item xs={12}>
              <Typography gutterBottom variant="h2">
                Library Location
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
                variant="caption"
              >
                Where hihat looks for your music library.
              </Typography>
              <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
                <TextField
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          edge="end"
                          onClick={handleSelectLibraryPath}
                        >
                          <FolderIcon />
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  label="Folder"
                  onChange={handleSaveLibraryPath}
                  value={libraryPath}
                />
              </FormControl>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            {/* Library Operations Section */}
            <Grid item sm={6} xs={12}>
              <Typography gutterBottom variant="h2">
                Library Management
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
                variant="caption"
              >
                Manage your music library.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  color="primary"
                  disabled={!libraryPath || isScanning}
                  fullWidth
                  onClick={handleRescanLibrary}
                  startIcon={<RefreshIcon />}
                  variant="contained"
                >
                  {isScanning ? 'Scanning...' : 'Rescan Library'}
                </Button>
                <Typography
                  color="text.secondary"
                  sx={{ display: 'block', fontSize: '0.75rem' }}
                >
                  Scan your existing library directory for any new changes and
                  update your hihat library.
                </Typography>
              </Box>
            </Grid>

            <Grid item sm={6} xs={12}>
              <Typography gutterBottom variant="h2">
                Import Music
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
                variant="caption"
              >
                Add music to your library.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  color="primary"
                  disabled={!libraryPath || isScanning}
                  fullWidth
                  onClick={handleAddSongs}
                  startIcon={<AddIcon />}
                  variant="outlined"
                >
                  Add Songs
                </Button>
                <Typography
                  color="text.secondary"
                  sx={{ display: 'block', fontSize: '0.75rem' }}
                >
                  Select music files to import directly into your hihat library.
                  hihat will deduplicate songs automatically.
                </Typography>
              </Box>
            </Grid>

            <Grid item xs={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            {/* Backup Section */}
            <Grid item xs={12}>
              <Typography gutterBottom variant="h2">
                Library Backup
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
                variant="caption"
              >
                Create a backup of your music library to an external drive or
                another location.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  color="secondary"
                  disabled={!libraryPath || isScanning || isBackupInProgress}
                  onClick={handleBackupLibrary}
                  startIcon={<BackupIcon />}
                  variant="contained"
                >
                  {isBackupInProgress ? 'Backing Up...' : 'Backup Library'}
                </Button>
                <Typography
                  color="text.secondary"
                  sx={{ display: 'block', fontSize: '0.75rem' }}
                >
                  Uses rsync to efficiently copy your music files to another
                  location while preserving file structure and metadata.
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography gutterBottom variant="h2">
            Appearance
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ display: 'block', mb: 2 }}
            variant="caption"
          >
            The default appearance of hihat.
          </Typography>

          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={theme === 'dark'}
                  onChange={handleThemeChange}
                />
              }
              label="Dark Theme"
            />
          </FormGroup>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography gutterBottom variant="h2">
            Column Visibility
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ display: 'block', mb: 2 }}
            variant="caption"
          >
            The default visibility of columns in the library and playlists
            views.
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
              label="Duration"
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

        {/*
          Development section containing helpful tools for developers
          that should not be exposed in production
        */}
        {process.env.NODE_ENV === 'development' && (
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography gutterBottom variant="h2">
              Development
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button
                color="error"
                onClick={handleResetDatabase}
                startIcon={<WarningIcon />}
                sx={{ mb: 2 }}
                variant="contained"
              >
                Reset Database
              </Button>
              <Typography color="text.secondary" variant="body2">
                This will delete all data and reset the application to its
                initial state. Use this for development and testing purposes
                only.
              </Typography>
            </Box>
          </Paper>
        )}
      </Box>

      {/* Scanning progress dialog */}
      <Dialog fullWidth maxWidth="sm" open={isScanning}>
        <DialogTitle>Library Scanner</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography gutterBottom variant="body1">
              Status: {getScanStatusText()}
            </Typography>
            <LinearProgress
              sx={{ mt: 2 }}
              value={scanProgress}
              variant="determinate"
            />
            <Typography sx={{ mt: 1 }} variant="body2">
              {scanStatus}
            </Typography>
          </Box>
          {scanStatus === 'Complete' && (
            <Paper
              elevation={0}
              sx={{
                p: 2,
                bgcolor: 'background.default',
                maxHeight: '150px',
                overflow: 'auto',
                mb: 2,
              }}
            >
              <Typography
                component="div"
                sx={{ fontFamily: 'monospace' }}
                variant="body2"
              >
                Scan completed successfully
              </Typography>
            </Paper>
          )}
        </DialogContent>
      </Dialog>

      {/* Backup progress dialog */}
      <Dialog fullWidth maxWidth="sm" open={backupDialogOpen}>
        <DialogTitle>Library Backup</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography gutterBottom variant="body1">
              Status:{' '}
              {isBackupInProgress ? 'Backing up library...' : 'Complete'}
            </Typography>
            <LinearProgress
              sx={{ mt: 2 }}
              value={isBackupInProgress ? undefined : 100}
              variant={isBackupInProgress ? 'indeterminate' : 'determinate'}
            />
            <Typography sx={{ mt: 1 }} variant="body2">
              {backupStatus}
            </Typography>
          </Box>
        </DialogContent>
      </Dialog>

      <Snackbar
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        autoHideDuration={6000}
        onClose={handleCloseSnackbar}
        open={snackbarOpen}
      >
        <Alert
          key="settings-alert"
          onClose={handleCloseSnackbar}
          severity="success"
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>

      {/* Library path confirmation dialog */}
      <ConfirmationDialog
        cancelText="Cancel"
        confirmButtonColor="primary"
        confirmText="Save and Scan"
        message="Changing your library folder will reset your current music library. All existing songs will be removed from your library before scanning the new location. This action cannot be undone and may take some time depending on the size of your new library. Do you want to continue?"
        onCancel={handleCancelPathChange}
        onConfirm={handleConfirmPathChange}
        open={pathDialogOpen}
        title="Update Library Folder"
      />

      {/* Reset database confirmation dialog */}
      <ConfirmationDialog
        cancelText="Cancel"
        confirmButtonColor="error"
        confirmText="Reset Database"
        message="This will delete all data and reset the application to its initial state. This action cannot be undone. Are you sure you want to continue?"
        onCancel={handleCancelReset}
        onConfirm={handleConfirmReset}
        open={resetDialogOpen}
        title="Reset Database"
      />
    </Box>
  );
}
