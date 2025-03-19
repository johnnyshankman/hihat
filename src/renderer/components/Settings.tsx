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
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import { useSettingsStore, useUIStore, useLibraryStore } from '../stores';
import ConfirmationDialog from './ConfirmationDialog';
import SidebarToggle from './SidebarToggle';
import type { Channels } from '../../types/ipc';

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
  // Get state and actions from settings store
  const settings = useSettingsStore((state) => state.settings);
  const updateColumnVisibility = useSettingsStore(
    (state) => state.updateColumnVisibility,
  );
  const updateTheme = useSettingsStore((state) => state.updateTheme);

  // Get state and actions from UI store
  const setPreviewTheme = useUIStore((state) => state.setTheme);

  // Get actions from library store
  const scanLibrary = useLibraryStore((state) => state.scanLibrary);
  const isScanning = useLibraryStore((state) => state.isScanning);

  const [libraryPath, setLibraryPath] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [columnVisibility, setColumnVisibility] = useState({
    title: true,
    artist: true,
    album: true,
    albumArtist: false,
    genre: true,
    duration: true,
    playCount: true,
    dateAdded: true,
    lastPlayed: false,
  });
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  // New state for path confirmation dialog
  const [pathDialogOpen, setPathDialogOpen] = useState(false);
  // Reference to store the original path for restoration if canceled
  const originalPathRef = useRef('');

  // Scanning state
  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatus, setScanStatus] = useState('');

  // Add a ref to track the last time we updated the UI for scan progress
  const lastUpdateTime = useRef(0);

  // Reference to track if settings have been loaded
  const settingsLoaded = useRef(false);

  // Load settings when component mounts
  useEffect(() => {
    if (settings) {
      setLibraryPath(settings.libraryPath || '');
      originalPathRef.current = settings.libraryPath || '';
      setTheme(settings.theme || 'light');
      if (settings.columns) {
        setColumnVisibility(settings.columns);
      }
      settingsLoaded.current = true;
    }

    // Clear any preview theme when component unmounts
    return () => {
      setPreviewTheme(null);
    };
  }, [settings, setPreviewTheme]);

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

    // Clean up event listeners
    return () => {
      unsubScanProgress();
      unsubScanComplete();
    };
  }, []);

  const handleLibraryPathChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setLibraryPath(event.target.value);
  };

  const handleThemeChange = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';

    // Update local state
    setTheme(newTheme);

    // Set the preview theme to immediately see the change
    setPreviewTheme(newTheme);

    // Update in context and save to database immediately
    updateTheme(newTheme);
  };

  const handleColumnVisibilityChange = (
    column: keyof typeof columnVisibility,
  ) => {
    const newValue = !columnVisibility[column];

    // Update local state
    setColumnVisibility({
      ...columnVisibility,
      [column]: newValue,
    });

    // Update in context and save to database immediately
    updateColumnVisibility(column, newValue);
  };

  const handleSelectLibraryPath = async () => {
    const result =
      (await window.electron.dialog.selectDirectory()) as DirectorySelectionResult;
    if (!result.canceled && result.filePaths.length > 0) {
      setLibraryPath(result.filePaths[0]);
    }
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

  // Modified to show the confirmation dialog first
  const handleSaveLibraryPath = async () => {
    try {
      if (!settings) return;

      // Validate library path
      if (!libraryPath) {
        setSnackbarMessage('Please set a library path');
        setSnackbarOpen(true);
        return;
      }

      // Check if the library path exists
      const pathExists =
        await window.electron.fileSystem.fileExists(libraryPath);
      if (!pathExists) {
        setSnackbarMessage('The specified library path does not exist');
        setSnackbarOpen(true);
        return;
      }

      // Store the original path in case the user cancels
      originalPathRef.current = settings.libraryPath || '';

      // Open the confirmation dialog
      setPathDialogOpen(true);
    } catch (error) {
      console.error('Error validating library path:', error);
      setSnackbarMessage('Error validating library path');
      setSnackbarOpen(true);
    }
  };

  // New function to handle confirmation of library path change
  const handleConfirmPathChange = async () => {
    try {
      setPathDialogOpen(false);

      if (!settings) return;

      // Make sure we're using the correct ID
      const updatedSettings = {
        ...settings,
        id: 'app-settings', // Ensure we're using the correct ID
        libraryPath,
        // We don't update theme here as it's saved automatically
      };

      const result = await window.electron.settings.update(updatedSettings);

      if (result) {
        setSnackbarMessage('Library path saved successfully');
        setSnackbarOpen(true);

        // Automatically start scanning the library
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
      } else {
        setSnackbarMessage('Failed to save library path');
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

  if (!settings) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography>Loading settings...</Typography>
      </Box>
    );
  }

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
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <SidebarToggle isOpen={drawerOpen} onToggle={onDrawerToggle} />
            <Typography variant="h6">Settings</Typography>
          </Box>
        </Toolbar>
      </AppBar>

      <Box sx={{ p: 2, WebkitAppRegion: 'no-drag' }}>
        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography gutterBottom variant="h6">
            Library
          </Typography>
          <FormControl fullWidth sx={{ mb: 2 }}>
            <TextField
              helperText="Click 'Save' after changing this field"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton edge="end" onClick={handleSelectLibraryPath}>
                      <FolderIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
              label="Folder"
              onChange={handleLibraryPathChange}
              value={libraryPath}
            />
          </FormControl>
          <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
            <Button
              color="error"
              onClick={handleSaveLibraryPath}
              startIcon={<SaveIcon />}
              variant="contained"
            >
              Save
            </Button>
            <Button
              color="primary"
              disabled={!libraryPath || isScanning}
              onClick={handleRescanLibrary}
              startIcon={<RefreshIcon />}
              variant="contained"
            >
              {isScanning ? 'Scanning...' : 'Scan Folder'}
            </Button>
          </Box>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography gutterBottom variant="h6">
            Appearance
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
            <Typography color="text.secondary" variant="caption">
              Settings are saved automatically
            </Typography>
          </FormGroup>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography gutterBottom variant="h6">
            Column Visibility
          </Typography>
          <Typography
            color="text.secondary"
            sx={{ display: 'block', mb: 2 }}
            variant="caption"
          >
            Settings are saved automatically
          </Typography>
          <FormGroup>
            <FormControlLabel
              control={
                <Switch
                  checked={columnVisibility.title}
                  onChange={() => handleColumnVisibilityChange('title')}
                />
              }
              label="Title"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columnVisibility.artist}
                  onChange={() => handleColumnVisibilityChange('artist')}
                />
              }
              label="Artist"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columnVisibility.album}
                  onChange={() => handleColumnVisibilityChange('album')}
                />
              }
              label="Album"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columnVisibility.albumArtist}
                  onChange={() => handleColumnVisibilityChange('albumArtist')}
                />
              }
              label="Album Artist"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columnVisibility.genre}
                  onChange={() => handleColumnVisibilityChange('genre')}
                />
              }
              label="Genre"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columnVisibility.duration}
                  onChange={() => handleColumnVisibilityChange('duration')}
                />
              }
              label="Duration"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columnVisibility.playCount}
                  onChange={() => handleColumnVisibilityChange('playCount')}
                />
              }
              label="Play Count"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columnVisibility.dateAdded}
                  onChange={() => handleColumnVisibilityChange('dateAdded')}
                />
              }
              label="Date Added"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={columnVisibility.lastPlayed}
                  onChange={() => handleColumnVisibilityChange('lastPlayed')}
                />
              }
              label="Last Played"
            />
          </FormGroup>
        </Paper>

        <Paper sx={{ p: 3, mb: 3 }}>
          <Typography gutterBottom variant="h6">
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
              This will delete all data and reset the application to its initial
              state. Use this for development and testing purposes only.
            </Typography>
          </Box>
        </Paper>
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
        message="Updating your library folder will automatically start a scan to add new songs to your library. This may take some time depending on the size of your library. Do you want to continue?"
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
