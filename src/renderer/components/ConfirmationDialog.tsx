import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Typography,
} from '@mui/material';

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  confirmButtonColor:
    | 'primary'
    | 'secondary'
    | 'error'
    | 'info'
    | 'success'
    | 'warning';
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmationDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmButtonColor = 'primary',
  onConfirm,
  onCancel,
}: ConfirmationDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      aria-labelledby="confirmation-dialog-title"
      aria-describedby="confirmation-dialog-description"
    >
      <DialogTitle id="confirmation-dialog-title">
        <Typography variant="h6" component="span">
          {title}
        </Typography>
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="confirmation-dialog-description">
          {message}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} color="primary">
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          color={confirmButtonColor}
          variant="contained"
          autoFocus
        >
          {confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmationDialog;
