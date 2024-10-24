import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { TinyText } from '../SimpleStyledMaterialUIComponents';

interface ConfirmDedupingDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function ConfirmDedupingDialog(
  props: ConfirmDedupingDialogProps,
) {
  const { open, onClose, onConfirm } = props;

  return (
    <Dialog
      className="flex flex-col items-center justify-center content-center p-10"
      open={open}
    >
      <div className="flex flex-col items-center pb-4 max-w-[400px]">
        <DialogTitle>Deduplicate Library</DialogTitle>
        <DialogContent>
          <div className="flex w-full justify-center px-2">
            <TinyText>
              This will find any duplicate song files with identical title,
              artist, and album and keep only the highest quality version of
              each song. That way your library will contain only the best
              quality files.
            </TinyText>
          </div>
        </DialogContent>
        <div className="flex flex-row">
          <div className="flex w-full justify-center pt-2 pb-1 px-2">
            <button
              className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
              onClick={onClose}
              type="button"
            >
              Cancel
            </button>
          </div>
          <div className="flex w-full justify-center pt-2 pb-1 px-2">
            <button
              className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
              onClick={onConfirm}
              type="button"
            >
              Deduplicate
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
