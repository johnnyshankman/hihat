import { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import MinimizeIcon from '@mui/icons-material/Remove';
import MaximizeIcon from '@mui/icons-material/CropSquare';
import RestoreIcon from '@mui/icons-material/FilterNone';

export default function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <Box sx={{ display: 'flex', gap: '8px', WebkitAppRegion: 'no-drag' }}>
      <Tooltip title="Close">
        <IconButton
          onClick={() => window.electron.window.close()}
          size="small"
          sx={{
            width: '12px',
            height: '12px',
            bgcolor: (t) => t.palette.grey[500],
            '&:hover': {
              bgcolor: '#ff5f57',
              '& .MuiSvgIcon-root': {
                opacity: 1,
                color: 'black',
              },
            },
            padding: 0,
          }}
        >
          <CloseIcon
            sx={{
              fontSize: '8px',
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
          />
        </IconButton>
      </Tooltip>
      <Tooltip title="Minimize">
        <IconButton
          onClick={() => window.electron.window.minimize()}
          size="small"
          sx={{
            width: '12px',
            height: '12px',
            bgcolor: (t) => t.palette.grey[500],
            '&:hover': {
              bgcolor: '#ffbd2e',
              '& .MuiSvgIcon-root': {
                opacity: 1,
                color: 'black',
              },
            },
            padding: 0,
          }}
        >
          <MinimizeIcon
            sx={{
              fontSize: '8px',
              opacity: 0,
              transition: 'opacity 0.2s',
            }}
          />
        </IconButton>
      </Tooltip>
      <Tooltip title={isMaximized ? 'Restore' : 'Maximize'}>
        <IconButton
          onClick={() => {
            // NOTE: badly named function, it actually toggles the maximize state, it doesn't just maximize.
            window.electron.window.maximize();
            setIsMaximized(!isMaximized);
          }}
          size="small"
          sx={{
            width: '12px',
            height: '12px',
            bgcolor: (t) => t.palette.grey[500],
            '&:hover': {
              bgcolor: '#28c940',
              '& .MuiSvgIcon-root': {
                opacity: 1,
                color: 'black',
              },
            },
            padding: 0,
          }}
        >
          {isMaximized ? (
            <RestoreIcon
              sx={{
                fontSize: '8px',
                opacity: 0,
                transition: 'opacity 0.2s',
              }}
            />
          ) : (
            <MaximizeIcon
              sx={{
                fontSize: '8px',
                opacity: 0,
                transition: 'opacity 0.2s',
              }}
            />
          )}
        </IconButton>
      </Tooltip>
    </Box>
  );
}
