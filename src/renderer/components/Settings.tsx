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
  Dialog,
  DialogTitle,
  DialogContent,
  LinearProgress,
  Divider,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import FolderIcon from '@mui/icons-material/Folder';
import WarningIcon from '@mui/icons-material/Warning';
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import BackupIcon from '@mui/icons-material/Backup';
import CloseIcon from '@mui/icons-material/Close';
import { useSettingsAndPlaybackStore } from '../stores';
import ConfirmationDialog from './ConfirmationDialog';
import type { Channels } from '../../types/ipc';
import useLibraryStore from '../stores/libraryStore';

// Define the type for the dialog result
interface DirectorySelectionResult {
  canceled: boolean;
  filePaths: string[];
}

// Define the props for the Settings component
interface SettingsProps {
  onClose: () => void;
}

export default function Settings({ onClose }: SettingsProps) {
  // settings store stuff
  const libraryPath = useSettingsAndPlaybackStore((state) => state.libraryPath);
  const theme = useSettingsAndPlaybackStore((state) => state.theme);
  const columns = useSettingsAndPlaybackStore((state) => state.columns);
  const updateColumnVisibility = useSettingsAndPlaybackStore(
    (state) => state.setColumnVisibility,
  );
  const setLibraryPath = useSettingsAndPlaybackStore(
    (state) => state.setLibraryPath,
  );
  const updateTheme = useSettingsAndPlaybackStore((state) => state.setTheme);
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
  const [_scanStatus, setScanStatus] = useState('');
  const [scanPhase, setScanPhase] = useState('preparing');
  const [scanCurrentFile, setScanCurrentFile] = useState('');
  const [scanTransferInfo, setScanTransferInfo] = useState<{
    current: number;
    total: number;
    remaining: number;
    estimatedTimeRemaining: string;
  } | null>(null);
  const [_scanProcessedFiles, setScanProcessedFiles] = useState<string[]>([]);
  const scanProcessedFilesRef = useRef<string[]>([]);
  const scanStartTime = useRef<number>(0);

  const [_backupStatus, setBackupStatus] = useState('');
  // Add backup progress state
  const [backupProgress, setBackupProgress] = useState(0);
  const [backupCurrentFile, setBackupCurrentFile] = useState('');
  const [backupPhase, setBackupPhase] = useState('preparing');
  const [backupTransferInfo, setBackupTransferInfo] = useState<{
    current: number;
    total: number;
    remaining: number;
    speed: string;
  } | null>(null);
  // Track the last processed file for display in the completed log
  const [_processedFiles, setProcessedFiles] = useState<string[]>([]);
  const processedFilesRef = useRef<string[]>([]);

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
        // Set scan phase to processing
        if (scanPhase === 'preparing' && data.processed > 0) {
          setScanPhase('processing');
          scanStartTime.current = now;
        }

        // Update progress
        setScanProgress((data.processed / data.total) * 100); // Convert to percentage
        setScanStatus(`Scanning: ${data.processed} of ${data.total} files`);

        // Update current file
        setScanCurrentFile(data.current);

        // Add to processed files (but limit to last 20 for performance)
        if (!scanProcessedFilesRef.current.includes(data.current)) {
          const updatedFiles = [
            data.current,
            ...scanProcessedFilesRef.current,
          ].slice(0, 20);
          scanProcessedFilesRef.current = updatedFiles;
          setScanProcessedFiles(updatedFiles);
        }

        // Calculate ETA
        if (data.processed > 0 && scanStartTime.current > 0) {
          const elapsedTime = now - scanStartTime.current;
          const filesPerMs = data.processed / elapsedTime;
          const remainingFiles = data.total - data.processed;
          const estimatedRemainingMs = remainingFiles / filesPerMs;

          // Format estimated time remaining
          let estimatedTimeRemaining = '';
          if (estimatedRemainingMs < 60000) {
            // Less than a minute
            estimatedTimeRemaining = `${Math.ceil(estimatedRemainingMs / 1000)} seconds`;
          } else if (estimatedRemainingMs < 3600000) {
            // Less than an hour
            estimatedTimeRemaining = `${Math.ceil(estimatedRemainingMs / 60000)} minutes`;
          } else {
            // Hours or more
            const hours = Math.floor(estimatedRemainingMs / 3600000);
            const minutes = Math.ceil((estimatedRemainingMs % 3600000) / 60000);
            estimatedTimeRemaining = `${hours} hour${hours !== 1 ? 's' : ''} ${minutes} minute${minutes !== 1 ? 's' : ''}`;
          }

          // Update transfer info
          setScanTransferInfo({
            current: data.processed,
            total: data.total,
            remaining: remainingFiles,
            estimatedTimeRemaining,
          });
        }

        lastUpdateTime.current = now;
      }
    };

    const handleScanComplete = () => {
      setScanStatus('Complete');
      setScanProgress(100);
      setScanPhase('complete');
      setSnackbarMessage('Library scan completed successfully');
      setSnackbarOpen(true);

      // Reset scan state after a delay
      setTimeout(() => {
        setScanProcessedFiles([]);
        scanProcessedFilesRef.current = [];
        setScanCurrentFile('');
        setScanTransferInfo(null);
      }, 3000);
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
        setBackupProgress(100);
        setProcessedFiles([]);
        processedFilesRef.current = [];
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

    // Listen for backup progress updates
    const unsubBackupProgress = window.electron.ipcRenderer.on(
      'backup-library-progress' as Channels,
      (...args: unknown[]) => {
        const data = args[0] as {
          phase: string;
          status: string;
          currentFile?: string;
          progress?: number;
          currentTransfer?: number;
          remaining?: number;
          total?: number;
          transferSpeed?: string;
          filesProcessed?: number;
          totalFiles?: number;
        };

        // Update backup status
        setBackupStatus(data.status);
        setBackupPhase(data.phase);

        // Handle different phases
        if (data.phase === 'transferring') {
          // Update current file if provided
          if (data.currentFile) {
            setBackupCurrentFile(data.currentFile);

            // Add to processed files (but limit to last 20 for performance)
            if (!processedFilesRef.current.includes(data.currentFile)) {
              const updatedFiles = [
                data.currentFile,
                ...processedFilesRef.current,
              ].slice(0, 20);
              processedFilesRef.current = updatedFiles;
              setProcessedFiles(updatedFiles);
            }
          }

          // Update progress if provided
          if (data.progress !== undefined) {
            setBackupProgress(data.progress);
          }

          // Update transfer info if provided
          if (
            data.currentTransfer !== undefined &&
            data.total !== undefined &&
            data.remaining !== undefined
          ) {
            setBackupTransferInfo({
              current: data.currentTransfer,
              total: data.total,
              remaining: data.remaining,
              speed: data.transferSpeed || '',
            });
          }
        } else if (data.phase === 'counting' && data.totalFiles) {
          // Just update status for counting phase
          setBackupStatus(`Found ${data.totalFiles} files to backup`);
        } else if (data.phase === 'scanning' && data.filesProcessed) {
          // Update status for scanning phase
          setBackupStatus(`Scanning files: ${data.filesProcessed} processed`);
        }
      },
    );

    // Clean up event listeners
    return () => {
      unsubScanProgress();
      unsubScanComplete();
      unsubBackupSuccess();
      unsubBackupError();
      unsubBackupProgress();
    };
  }, [scanPhase]);

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
      setScanStatus('Preparing to scan...');
      setScanPhase('preparing');
      setScanCurrentFile('');
      setScanTransferInfo(null);
      setScanProcessedFiles([]);
      scanProcessedFilesRef.current = [];
      scanStartTime.current = 0;

      // Start the scan
      await scanLibrary(libraryPath);
    } catch (error) {
      console.error('Error scanning library:', error);
      setScanStatus('Failed');
      setScanPhase('error');
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
      setScanStatus('Preparing to import...');
      setScanPhase('preparing');
      setScanCurrentFile('');
      setScanTransferInfo(null);
      setScanProcessedFiles([]);
      scanProcessedFilesRef.current = [];
      scanStartTime.current = 0;

      // Import the selected files
      await importFiles(result.filePaths);
    } catch (error) {
      console.error('Error importing files:', error);
      setScanStatus('Failed');
      setScanPhase('error');
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

  const handleSelectLibraryPath = async () => {
    originalPathRef.current = libraryPath;
    const result =
      (await window.electron.dialog.selectDirectory()) as DirectorySelectionResult;

    let newLibraryPath = '';
    if (!result.canceled && result.filePaths.length > 0) {
      // eslint-disable-next-line prefer-destructuring
      newLibraryPath = result.filePaths[0];
    } else {
      // reset back to original path
      newLibraryPath = originalPathRef.current;
    }

    try {
      // Check if the library path exists
      const pathExists =
        await window.electron.fileSystem.fileExists(newLibraryPath);

      if (!pathExists) {
        setSnackbarMessage('The specified library path does not exist');
        setSnackbarOpen(true);
        setLibraryPath(originalPathRef.current);
        return;
      }

      setLibraryPath(newLibraryPath);
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
    if (scanPhase === 'error') return 'Scan Failed';
    if (scanPhase === 'complete') return 'Scan Complete';

    switch (scanPhase) {
      case 'preparing':
        return 'Preparing...';
      case 'processing':
        return 'Scanning...';
      default:
        return 'In Progress...';
    }
  };

  // Function to generate the backup status text
  const getBackupStatusText = () => {
    if (!isBackupInProgress) return 'Complete';

    switch (backupPhase) {
      case 'preparing':
        return 'Preparing...';
      case 'counting':
        return 'Counting files...';
      case 'scanning':
        return 'Scanning files...';
      case 'transferring':
        return 'Copying files...';
      case 'error':
        return 'Error';
      default:
        return 'In Progress...';
    }
  };

  // Function to extract just the filename for display
  const getFileName = (filePath: string) => {
    const parts = filePath.split('/');
    return parts[parts.length - 1] || filePath;
  };

  // Helper functions for backup progress
  const getProgressValue = () => {
    if (!isBackupInProgress) {
      return 100;
    }

    if (backupPhase === 'transferring') {
      return backupProgress;
    }

    return undefined;
  };

  const getProgressVariant = () => {
    if (isBackupInProgress && backupPhase !== 'transferring') {
      return 'indeterminate';
    }
    return 'determinate';
  };

  // Helper functions for scan progress
  const getScanProgressValue = () => {
    if (scanPhase === 'complete' || scanPhase === 'error') {
      return 100;
    }

    return scanProgress;
  };

  const getScanProgressVariant = () => {
    if (scanPhase === 'preparing') {
      return 'indeterminate';
    }
    return 'determinate';
  };

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
          py: 1.35,
          borderBottom: (t) => `1px solid ${t.palette.divider}`,
          position: 'sticky',
          top: 0,
          backgroundColor: (t) => t.palette.background.paper,
          zIndex: 1,
        }}
      >
        <Typography color="text.primary" variant="h1">
          Settings
        </Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Paper elevation={1} sx={{ WebkitAppRegion: 'no-drag', p: 2 }}>
        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Grid container spacing={3}>
            {/* Library Path Section */}
            <Grid size={12}>
              <Typography gutterBottom variant="h2">
                Music Folder
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
                variant="caption"
              >
                The folder on your computer where your music files live. hihat
                scans this folder and all its subfolders.
              </Typography>
              <FormControl fullWidth sx={{ mt: 1 }}>
                <TextField
                  label="Folder"
                  onChange={handleSelectLibraryPath}
                  slotProps={{
                    input: {
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
                    },
                  }}
                  value={libraryPath}
                />
              </FormControl>
            </Grid>

            <Grid size={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            <Grid size={12}>
              <Typography gutterBottom variant="h2">
                Import Music
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography
                  color="text.secondary"
                  sx={{ display: 'block', fontSize: '0.75rem' }}
                >
                  Add new songs or entire folders to your library. Files are
                  copied into your Music Folder, so the originals stay right
                  where they are. Duplicates are skipped automatically.
                </Typography>
                <Button
                  color="primary"
                  disabled={!libraryPath || isScanning}
                  fullWidth
                  onClick={handleAddSongs}
                  startIcon={<AddIcon />}
                  variant="contained"
                >
                  Add Songs
                </Button>
              </Box>
            </Grid>

            <Grid size={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            {/* Library Operations Section */}
            <Grid size={12}>
              <Typography gutterBottom variant="h2">
                Rescan Library
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Typography
                  color="text.secondary"
                  sx={{ display: 'block', fontSize: '0.75rem' }}
                >
                  Check your music folder for any new, changed, or removed files
                  and update your library to match.
                </Typography>
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
              </Box>
            </Grid>

            <Grid size={12}>
              <Divider sx={{ my: 2 }} />
            </Grid>

            {/* Backup Section */}
            <Grid size={12}>
              <Typography gutterBottom variant="h2">
                Backup Library
              </Typography>
              <Typography
                color="text.secondary"
                sx={{ display: 'block', mb: 2 }}
                variant="caption"
              >
                Copy your music library to an external drive or another folder.
                Only new and changed files are copied each time, so backups
                after the first one are fast. Your existing backup files are
                never removed.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Button
                  color="primary"
                  disabled={!libraryPath || isScanning || isBackupInProgress}
                  onClick={handleBackupLibrary}
                  startIcon={<BackupIcon />}
                  variant="contained"
                >
                  {isBackupInProgress ? 'Backing Up...' : 'Backup Library'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Paper>

        <Paper elevation={2} sx={{ p: 2, mb: 2 }}>
          <Typography gutterBottom variant="h2">
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
          <Typography gutterBottom variant="h2">
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
          <Typography gutterBottom variant="h2">
            Reset
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
              Start fresh by clearing your hihat database — play counts,
              playlists, and settings will be removed. Your actual music files
              are never touched.
            </Typography>
          </Box>
        </Paper>
      </Paper>

      {/* Scanning progress dialog */}
      <Dialog fullWidth maxWidth="sm" open={isScanning}>
        <DialogTitle>
          {scanPhase === 'complete' ? 'Scan Complete' : getScanStatusText()}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <LinearProgress
              sx={{ mt: 1, mb: 2 }}
              value={getScanProgressValue()}
              variant={getScanProgressVariant()}
            />

            {scanPhase === 'processing' && scanTransferInfo && (
              <Typography color="text.secondary" variant="body2">
                {scanTransferInfo.current.toLocaleString()} of{' '}
                {scanTransferInfo.total.toLocaleString()} songs
              </Typography>
            )}

            {scanPhase === 'processing' && scanCurrentFile && (
              <Typography
                color="text.secondary"
                sx={{
                  mt: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                variant="body2"
              >
                {getFileName(scanCurrentFile)}
              </Typography>
            )}

            {scanPhase === 'complete' && scanTransferInfo && (
              <Typography color="text.secondary" variant="body2">
                Added {scanTransferInfo.total.toLocaleString()} songs.
              </Typography>
            )}
          </Box>
        </DialogContent>
      </Dialog>

      {/* Backup progress dialog */}
      <Dialog fullWidth maxWidth="sm" open={backupDialogOpen}>
        <DialogTitle>
          {!isBackupInProgress ? 'Backup Complete' : getBackupStatusText()}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <LinearProgress
              sx={{ mt: 1, mb: 2 }}
              value={getProgressValue()}
              variant={getProgressVariant()}
            />

            {backupPhase === 'transferring' && backupTransferInfo && (
              <Typography color="text.secondary" variant="body2">
                {backupTransferInfo.current.toLocaleString()} of{' '}
                {backupTransferInfo.total.toLocaleString()} files
              </Typography>
            )}

            {backupPhase === 'transferring' && backupCurrentFile && (
              <Typography
                color="text.secondary"
                sx={{
                  mt: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                variant="body2"
              >
                {getFileName(backupCurrentFile)}
              </Typography>
            )}
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
