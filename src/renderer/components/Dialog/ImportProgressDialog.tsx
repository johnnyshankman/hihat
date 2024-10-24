import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { TinyText } from '../SimpleStyledMaterialUIComponents';

interface ImportProgressDialogProps {
  open: boolean;
  songsImported: number;
  totalSongs: number;
  estimatedTimeRemainingString: string;
}

export default function ImportProgressDialog({
  open,
  songsImported,
  totalSongs,
  estimatedTimeRemainingString,
}: ImportProgressDialogProps) {
  return (
    <Dialog
      className="flex flex-col items-center justify-center content-center p-10"
      open={open}
    >
      <div className="flex flex-col items-center px-20 pb-6">
        <DialogTitle>Importing Songs</DialogTitle>
        <Box sx={{ width: '100%', marginBottom: '12px' }}>
          <LinearProgress
            color="inherit"
            value={(songsImported / totalSongs) * 100}
            variant={
              songsImported === totalSongs ? 'indeterminate' : 'determinate'
            }
          />
        </Box>
        <div className="flex w-full justify-center mt-1 px-2 ">
          <h4>{`${songsImported} / ${totalSongs}`}</h4>
        </div>
        <div className="flex w-full justify-center pt-2 pb-1 px-2">
          <TinyText>{`${
            estimatedTimeRemainingString || 'Calculating...'
          }`}</TinyText>
        </div>
      </div>
    </Dialog>
  );
}
