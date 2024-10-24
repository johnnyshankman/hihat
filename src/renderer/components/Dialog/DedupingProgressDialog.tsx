import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import { TinyText } from '../SimpleStyledMaterialUIComponents';

interface DedupingProgressDialogProps {
  open: boolean;
}

export default function DedupingProgressDialog({
  open,
}: DedupingProgressDialogProps) {
  return (
    <Dialog
      className="flex flex-col items-center justify-center content-center p-10"
      open={open}
    >
      <div className="flex flex-col items-center px-20 pb-6">
        <DialogTitle>Deduplicating Songs</DialogTitle>
        <Box sx={{ width: '100%', marginBottom: '12px' }}>
          <LinearProgress color="inherit" variant="indeterminate" />
        </Box>
        <div className="flex w-full justify-center pt-2 pb-1 px-2">
          <TinyText>This operation will take three to five minutes</TinyText>
        </div>
      </div>
    </Dialog>
  );
}
