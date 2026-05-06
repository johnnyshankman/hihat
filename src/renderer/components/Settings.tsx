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
import { useUIStore } from '../stores';
import {
  useScanLibrary,
  useImportFiles,
  useResetDatabase,
  useResetTracks,
  useSettings,
  useUpdateSettings,
  getSettingsSnapshot,
  DEFAULT_COLUMNS,
} from '../queries';
import ConfirmationDialog from './ConfirmationDialog';

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
  const updateSettings = useUpdateSettings();
  // Library / scan / reset mutations via TanStack Query. Each hook
  // owns success/error toasts and cache invalidation so the rest of
  // this component just drives UI off `isPending`.
  const scanLibraryMutation = useScanLibrary();
  const importFilesMutation = useImportFiles();
  const resetDatabaseMutation = useResetDatabase();
  const resetTracksMutation = useResetTracks();
  const isScanning =
    scanLibraryMutation.isPending || importFilesMutation.isPending;

  // ui store stuff
  const showNotification = useUIStore((state) => state.showNotification);

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

    const handleScanProgress = (data: {
      total: number;
      processed: number;
      current: string;
    }) => {
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
      showNotification('Library scan completed successfully', 'success');

      // Reset scan state after a delay
      setTimeout(() => {
        setScanProcessedFiles([]);
        scanProcessedFilesRef.current = [];
        setScanCurrentFile('');
        setScanTransferInfo(null);
      }, 3000);
    };

    // Register event listeners via the typed preload wrappers.
    const unsubScanProgress =
      window.electron.library.onScanProgress(handleScanProgress);
    const unsubScanComplete =
      window.electron.library.onScanComplete(handleScanComplete);

    // Listen for backup success or failure
    const unsubBackupSuccess = window.electron.backup.onSuccess(() => {
      setBackupDialogOpen(false);
      setIsBackupInProgress(false);
      setBackupStatus('');
      setBackupProgress(100);
      setProcessedFiles([]);
      processedFilesRef.current = [];
      showNotification('Library backup completed successfully', 'success');
    });

    const unsubBackupError = window.electron.backup.onError((message) => {
      setIsBackupInProgress(false);
      setBackupStatus('');
      showNotification(`Backup failed: ${message}`, 'error');
    });

    // Listen for backup progress updates
    const unsubBackupProgress = window.electron.backup.onProgress((data) => {
      setBackupStatus(data.status);
      setBackupPhase(data.phase);

      if (data.phase === 'transferring') {
        if (data.currentFile) {
          setBackupCurrentFile(data.currentFile);

          if (!processedFilesRef.current.includes(data.currentFile)) {
            const updatedFiles = [
              data.currentFile,
              ...processedFilesRef.current,
            ].slice(0, 20);
            processedFilesRef.current = updatedFiles;
            setProcessedFiles(updatedFiles);
          }
        }

        if (data.progress !== undefined) {
          setBackupProgress(data.progress);
        }

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
        setBackupStatus(`Found ${data.totalFiles} files to backup`);
      } else if (data.phase === 'scanning' && data.filesProcessed) {
        setBackupStatus(`Scanning files: ${data.filesProcessed} processed`);
      }
    });

    return () => {
      unsubScanProgress();
      unsubScanComplete();
      unsubBackupSuccess();
      unsubBackupError();
      unsubBackupProgress();
    };
  }, [scanPhase, showNotification]);

  const handleThemeChange = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    updateSettings.mutate({ theme: newTheme });
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

  const handleRescanLibrary = async () => {
    if (!libraryPath) {
      showNotification('Please set a library path first', 'warning');
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

      // Start the scan via the mutation. isScanning above flips on
      // automatically; the scan-complete push event invalidates the
      // tracks query and shows the success notification.
      await scanLibraryMutation.mutateAsync(libraryPath);
    } catch (error) {
      console.error('Error scanning library:', error);
      setScanStatus('Failed');
      setScanPhase('error');
      // Hook already toasts via uiStore on failure.
    }
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

      // Reset scan state
      setScanProgress(0);
      setScanStatus('Preparing to import...');
      setScanPhase('preparing');
      setScanCurrentFile('');
      setScanTransferInfo(null);
      setScanProcessedFiles([]);
      scanProcessedFilesRef.current = [];
      scanStartTime.current = 0;

      // Import the selected files via the mutation. Hook invalidates
      // tracks + playlists on success.
      await importFilesMutation.mutateAsync(result.filePaths);
    } catch (error) {
      console.error('Error importing files:', error);
      setScanStatus('Failed');
      setScanPhase('error');
      // Hook already toasts via uiStore on failure.
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

      // Show backup dialog
      setBackupDialogOpen(true);
      setIsBackupInProgress(true);
      setBackupStatus('Backing up library...');

      // Trigger the backup; progress / success / error arrive via the
      // backup.on* subscriptions above.
      window.electron.backup.start(backupPath);
    } catch (error) {
      console.error('Error backing up library:', error);
      setIsBackupInProgress(false);
      setBackupStatus('');
      showNotification(
        error instanceof Error ? error.message : 'Error backing up library',
        'error',
      );
    }
  };

  const handleSelectLibraryPath = async () => {
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

  // New function to handle confirmation of library path change
  const handleConfirmPathChange = async () => {
    try {
      setPathDialogOpen(false);

      showNotification('Library path saved successfully', 'success');

      try {
        // Reset scan state
        setScanProgress(0);
        setScanStatus('');

        // First, reset tracks in the database via the mutation.
        const resetResult = await resetTracksMutation.mutateAsync();
        if (!resetResult.success) {
          console.error('Failed to reset tracks:', resetResult.message);
          showNotification(
            `Failed to reset tracks: ${resetResult.message}`,
            'error',
          );
          return;
        }

        await scanLibraryMutation.mutateAsync(libraryPath);
      } catch (error) {
        console.error('Error scanning library:', error);
        setScanStatus('Failed');
        showNotification(
          error instanceof Error ? error.message : 'Error scanning library',
          'error',
        );
      }
    } catch (error) {
      console.error('Error saving library path:', error);
      showNotification('Error saving library path', 'error');
    }
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
          WebkitAppRegion: 'drag',
        }}
      >
        <Typography
          color="text.primary"
          sx={{ userSelect: 'none' }}
          variant="h1"
        >
          Settings
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ WebkitAppRegion: 'no-drag' }}
        >
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
