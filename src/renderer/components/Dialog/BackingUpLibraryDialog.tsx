import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { TinyText } from '../SimpleStyledMaterialUIComponents';

interface BackingUpLibraryDialogProps {
  open: boolean;
}

export default function BackingUpLibraryDialog({
  open,
}: BackingUpLibraryDialogProps) {
  return (
    <Dialog
      className="flex flex-col items-center justify-center content-center p-10"
      open={open}
    >
      <div className="flex flex-col items-center pb-4 max-w-[240px]">
        <DialogTitle>Backing Up</DialogTitle>
        <DialogContent>
          <div className="flex w-full justify-center px-2 flex-col gap-6">
            <TinyText className="text-center">
              Syncing your library with the chosen folder. This may take a while
              so go grab some tea!
            </TinyText>
            <Box sx={{ width: '100%', marginBottom: '12px' }}>
              <LinearProgress color="inherit" variant="indeterminate" />
            </Box>
          </div>
        </DialogContent>
      </div>
    </Dialog>
  );
}
