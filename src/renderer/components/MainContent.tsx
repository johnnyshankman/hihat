import { useEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useUIStore } from '../stores';
import { fadeIn } from '../styles/motion';
import Library from './Library';
import Playlists from './Playlists';

export default function MainContent() {
  const currentView = useUIStore((state) => state.currentView);

  // Fade between views on switch, but not on the initial mount — the
  // table handles its own entrance when the library first loads.
  const hasMountedRef = useRef(false);
  useEffect(() => {
    hasMountedRef.current = true;
  }, []);

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
      <Box
        key={currentView}
        sx={{
          animation: hasMountedRef.current ? fadeIn('fast') : 'none',
          display: 'flex',
          flex: 1,
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {currentView === 'library' && <Library />}
        {currentView === 'playlists' && <Playlists />}
      </Box>
    </Box>
  );
}
