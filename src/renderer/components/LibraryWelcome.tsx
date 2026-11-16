import { Box, Button, LinearProgress, Typography } from '@mui/material';
import LibraryMusicIcon from '@mui/icons-material/LibraryMusic';
import FolderOpenRoundedIcon from '@mui/icons-material/FolderOpenRounded';
import { useSettings, useUpdateSettings } from '../queries';
import { useUIStore } from '../stores';
import useLibraryTaskStore from '../stores/libraryTaskStore';
import { fadeIn } from '../styles/motion';
import { startRescan } from '../utils/libraryTasks';

/**
 * Empty-library state for the Library view. Walks a new user through
 * picking their music folder and shows the first scan's progress inline,
 * so they never have to find Settings to get started.
 */
export default function LibraryWelcome() {
  const libraryPath = useSettings().data?.libraryPath ?? '';
  const updateSettings = useUpdateSettings();
  const showNotification = useUIStore((state) => state.showNotification);
  // The first scan runs as a background library task like any other; its
  // progress shows here instead of in LibraryTaskPanel.
  const scanTask = useLibraryTaskStore((state) =>
    state.task?.kind === 'scan' ? state.task : null,
  );
  const isScanning = scanTask?.phase === 'running';
  const scanError = scanTask?.phase === 'error' ? scanTask.message : null;
  const progress =
    isScanning && scanTask.total > 0
      ? { processed: scanTask.processed, total: scanTask.total }
      : null;

  // The scan-complete push event refreshes the tracks query, which swaps
  // this panel for the table.
  const startScan = (path: string) => {
    useLibraryTaskStore.getState().dismiss();
    startRescan(path);
  };

  const handleChooseFolder = async () => {
    const result = await window.electron.dialog.selectDirectory();
    if ('error' in result) {
      showNotification(result.error, 'error');
      return;
    }
    if (result.canceled || result.filePaths.length === 0) return;

    const [path] = result.filePaths;
    await updateSettings.mutateAsync({ libraryPath: path });
    startScan(path);
  };

  let body;
  if (isScanning) {
    const pct = progress ? (progress.processed / progress.total) * 100 : 0;
    body = (
      <Box
        data-testid="welcome-scan-progress"
        sx={{ width: '100%', maxWidth: 360, animation: fadeIn('fast') }}
      >
        <Typography sx={{ fontWeight: 500, mb: 2 }} variant="h6">
          Building your library…
        </Typography>
        {/* Always determinate: switching from indeterminate makes MUI
            animate the bar back from full width. */}
        <LinearProgress
          sx={{ borderRadius: 2, height: 4, mb: 1.5 }}
          value={pct}
          variant="determinate"
        />
        <Typography color="text.secondary" variant="body2">
          {progress
            ? `${progress.processed.toLocaleString()} of ${progress.total.toLocaleString()} files`
            : 'Looking for music…'}
        </Typography>
      </Box>
    );
  } else {
    body = (
      <Box sx={{ animation: fadeIn('fast') }}>
        <Typography sx={{ fontWeight: 500, mb: 1 }} variant="h6">
          Welcome to hihat
        </Typography>
        <Typography
          color="text.secondary"
          sx={{ maxWidth: 380, mx: 'auto', mb: 3 }}
          variant="body2"
        >
          {libraryPath
            ? 'Your music folder is set. Scan it to build your library.'
            : 'Choose the folder where your music lives and hihat will build your library from it.'}
        </Typography>
        {scanError && (
          <Typography
            color="error"
            data-testid="welcome-scan-error"
            sx={{ maxWidth: 380, mx: 'auto', mb: 2 }}
            variant="body2"
          >
            {scanError}
          </Typography>
        )}
        {libraryPath && (
          <Typography
            color="text.secondary"
            data-testid="welcome-library-path"
            sx={{
              display: 'block',
              fontFamily: 'monospace',
              maxWidth: 380,
              mb: 2,
              mx: 'auto',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={libraryPath}
            variant="caption"
          >
            {libraryPath}
          </Typography>
        )}
        <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
          {libraryPath ? (
            <>
              <Button
                data-testid="welcome-scan"
                disableElevation
                onClick={() => startScan(libraryPath)}
                variant="contained"
              >
                Scan library
              </Button>
              <Button
                color="inherit"
                data-testid="welcome-choose-folder"
                onClick={handleChooseFolder}
                sx={{ color: 'text.secondary' }}
              >
                Choose a different folder
              </Button>
            </>
          ) : (
            <Button
              data-testid="welcome-choose-folder"
              disableElevation
              onClick={handleChooseFolder}
              startIcon={<FolderOpenRoundedIcon />}
              variant="contained"
            >
              Choose music folder
            </Button>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      data-testid="library-welcome"
      sx={{
        alignItems: 'center',
        animation: fadeIn('base'),
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        justifyContent: 'center',
        minHeight: 320,
        px: 4,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          alignItems: 'center',
          backgroundColor: 'action.hover',
          borderRadius: '16px',
          display: 'flex',
          height: 72,
          justifyContent: 'center',
          mb: 3,
          width: 72,
        }}
      >
        <LibraryMusicIcon sx={{ color: 'text.secondary', fontSize: 36 }} />
      </Box>
      {body}
    </Box>
  );
}
