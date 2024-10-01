import React from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import { TinyText } from '../SimpleStyledMaterialUIComponents';

interface BackupConfirmationDialogProps {
  open: boolean;
  onClose: () => void;
  onBackup: () => void;
}

export default function BackupConfirmationDialog(
  props: BackupConfirmationDialogProps,
) {
  const { open, onClose, onBackup } = props;

  return (
    <Dialog
      className="flex flex-col items-center justify-center content-center p-10"
      open={open}
    >
      <div className="flex flex-col items-center pb-4 max-w-[400px]">
        <DialogTitle>Backup Library</DialogTitle>
        <DialogContent>
          <div className="flex w-full justify-center px-2">
            <TinyText as="div">
              This feature creates a copy of your music library in a folder you
              choose, like on an external hard drive. It&apos;s smart enough to:
              <ol className="list-decimal pl-6 space-y-2 mt-2">
                <li>Only copy new or changed files, saving time and space.</li>
                <li>Keep your backup folder in sync with your main library.</li>
                <li>Let you easily update your backup whenever you want.</li>
              </ol>
              <p className="mt-4">
                This way, you can protect your music collection without worrying
                about duplicate files or complicated backups.
              </p>
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
              onClick={onBackup}
              type="button"
            >
              Backup
            </button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
