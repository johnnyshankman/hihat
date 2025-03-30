/**
 * Backup Handlers
 *
 * This module provides handlers for backing up music library files using rsync.
 */

import path from 'path';
import type { IpcMainEvent } from 'electron';
import Rsync from 'rsync';
import * as db from '../db';

/**
 * Backup the user's library to the specified directory using rsync
 * @param backupPath - Path to backup the library to
 * @param event - IPC event to reply with progress or completion
 */
const backupLibrary = async (backupPath: string, event: IpcMainEvent) => {
  try {
    // Get user settings for library path
    const settings = await db.getSettings();
    const { libraryPath } = settings;

    if (!libraryPath) {
      event.reply('backup-library-error', 'Library path is not set');
      return;
    }

    // Validate that backup path is not the same as library path
    if (
      backupPath === libraryPath ||
      backupPath.startsWith(libraryPath + path.sep)
    ) {
      event.reply(
        'backup-library-error',
        'Cannot backup to the same folder or its subfolder',
      );
      return;
    }

    console.log('backupLibrary called');

    // Set up rsync
    const rsync = new Rsync();

    rsync
      .set('ignore-existing') // Don't overwrite existing files
      .flags(['v', 'P', 'r', 'h']) // Verbose, Progress, Recursive, Human-readable
      .source(libraryPath + path.sep) // Ensure trailing slash to copy contents
      .destination(backupPath);

    // Execute the command
    // eslint-disable-next-line no-console
    rsync.execute(
      (error, _code, cmd) => {
        // eslint-disable-next-line no-console
        console.log('rsync command:', cmd);

        if (error) {
          // eslint-disable-next-line no-console
          console.error('rsync error:', error);
          event.reply('backup-library-error', error.message || 'Unknown error');
          return;
        }

        // Backup successful
        event.reply('backup-library-success');
      },
      (stdout) => {
        // eslint-disable-next-line no-console
        console.log('rsync stdout:', stdout.toString());
      },
      (stderr) => {
        // eslint-disable-next-line no-console
        console.log('rsync stderr:', stderr.toString());
      },
    );
  } catch (error: unknown) {
    // eslint-disable-next-line no-console
    console.error('Error in backupLibrary:', error);
    event.reply(
      'backup-library-error',
      (error as Error).message || 'Unknown error occurred during backup',
    );
  }
};

export default backupLibrary;
