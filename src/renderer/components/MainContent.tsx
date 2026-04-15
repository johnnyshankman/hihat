import { Box } from '@mui/material';
import { useUIStore } from '../stores';
import Library from './Library';
import Playlists from './Playlists';

export default function MainContent() {
  const currentView = useUIStore((state) => state.currentView);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 100px)',
        width: '100%',
        WebkitAppRegion: 'drag',
        '& button, & input, & a, & [role="button"], & .MuiTableContainer-root, & .MuiDataGrid-root, & .MuiSlider-root':
          {
            WebkitAppRegion: 'no-drag',
          },
      }}
    >
      {currentView === 'library' && <Library />}
      {currentView === 'playlists' && <Playlists />}
    </Box>
  );
}
