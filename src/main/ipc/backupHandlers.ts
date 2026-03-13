/**
 * Backup Handlers
 *
 * This module provides handlers for backing up music library files using rsync.
 */

import path from 'path';
import type { IpcMainEvent } from 'electron';
import Rsync from 'rsync';
import * as db from '../db';

// Define interfaces for parsed output types
interface BaseOutput {
  type: string;
}

interface FileOutput extends BaseOutput {
  type: 'file';
  currentFile: string;
}

interface PreparingOutput extends BaseOutput {
  type: 'preparing';
  status: string;
}

interface FilesCountOutput extends BaseOutput {
  type: 'filesCount';
  totalFiles: number;
}

interface ScanningOutput extends BaseOutput {
  type: 'scanning';
  filesProcessed: number;
}

interface ProgressOutput extends BaseOutput {
  type: 'progress';
  percent: number;
  currentTransfer?: number;
  remaining?: number;
  total?: number;
}

interface SpeedOutput extends BaseOutput {
  type: 'speed';
  speed: string;
}

type ParsedOutput =
  | FileOutput
  | PreparingOutput
  | FilesCountOutput
  | ScanningOutput
  | ProgressOutput
  | SpeedOutput
  | null;

/**
 * Parses rsync output to extract useful information
 * @param output - The stdout from rsync
 * @returns Parsed information object or null if not relevant
 */
const parseRsyncOutput = (output: string): ParsedOutput => {
  const trimmedOutput = output.trim();

  // Check if this is a file transfer line with a path
  if (trimmedOutput.includes('.m4a') || trimmedOutput.includes('.mp3')) {
    return {
      type: 'file',
      currentFile: trimmedOutput,
    };
  }

  // Check if this is a file list building line
  if (trimmedOutput.includes('building file list')) {
    return {
      type: 'preparing',
      status: 'Building file list...',
    };
  }

  // Check if this shows number of files to process
  const filesMatch = trimmedOutput.match(/(\d+) files to consider/);
  if (filesMatch) {
    return {
      type: 'filesCount',
      totalFiles: parseInt(filesMatch[1], 10),
    };
  }

  // Check if this is a progress percentage line
  const progressMatch = trimmedOutput.match(/(\d+)%/);
  if (progressMatch) {
    // Also try to get transfer info if available
    const transferMatch = trimmedOutput.match(
      /\(xfer#(\d+), to-check=(\d+)\/(\d+)\)/,
    );
    if (transferMatch) {
      return {
        type: 'progress',
        percent: parseInt(progressMatch[1], 10),
        currentTransfer: parseInt(transferMatch[1], 10),
        remaining: parseInt(transferMatch[2], 10),
        total: parseInt(transferMatch[3], 10),
      };
    }

    return {
      type: 'progress',
      percent: parseInt(progressMatch[1], 10),
    };
  }

  // Check if this is a speed line
  const speedMatch = trimmedOutput.match(/(\d+\.\d+)(M|K|G)B\/s/);
  if (speedMatch) {
    return {
      type: 'speed',
      speed: `${speedMatch[1]} ${speedMatch[2]}B/s`,
    };
  }

  // Check if showing X files processed
  const filesProcessedMatch = trimmedOutput.match(/(\d+) files\.\.\./);
  if (filesProcessedMatch) {
    return {
      type: 'scanning',
      filesProcessed: parseInt(filesProcessedMatch[1], 10),
    };
  }

  return null;
};

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

    console.warn('backupLibrary called');

    // Set up rsync
    const rsync = new Rsync();

    // Track current state
    let currentFile = '';
    let filesProcessed = 0;
    let totalFiles = 0;
    let phase = 'preparing';
    let transferSpeed = '';

    rsync
      .set('ignore-existing') // Don't overwrite existing files
      .flags(['v', 'P', 'r', 'h']) // Verbose, Progress, Recursive, Human-readable
      .source(libraryPath + path.sep) // Ensure trailing slash to copy contents
      .destination(backupPath);

    // Execute the command
    rsync.execute(
      (error, _code, cmd) => {
        console.warn('rsync command:', cmd);

        if (error) {
          console.error('rsync error:', error);
          event.reply('backup-library-error', error.message || 'Unknown error');
          return;
        }

        // Backup successful
        event.reply('backup-library-success');
      },
      (stdout) => {
        const output = stdout.toString();

        console.warn('rsync stdout:', output);

        // Parse output
        const parsedOutput = parseRsyncOutput(output);

        if (parsedOutput) {
          switch (parsedOutput.type) {
            case 'preparing':
              phase = 'preparing';
              event.reply('backup-library-progress', {
                phase,
                status: 'Preparing backup...',
              });
              break;

            case 'filesCount':
              totalFiles = parsedOutput.totalFiles;
              event.reply('backup-library-progress', {
                phase: 'counting',
                totalFiles,
                status: `Found ${totalFiles} files to backup`,
              });
              break;

            case 'scanning':
              filesProcessed = parsedOutput.filesProcessed;
              event.reply('backup-library-progress', {
                phase: 'scanning',
                filesProcessed,
                status: `Scanning files: ${filesProcessed} processed`,
              });
              break;

            case 'file':
              currentFile = parsedOutput.currentFile;
              phase = 'transferring';
              event.reply('backup-library-progress', {
                phase,
                currentFile,
                status: `Copying: ${currentFile}`,
              });
              break;

            case 'progress':
              if (
                'total' in parsedOutput &&
                parsedOutput.total !== undefined &&
                'remaining' in parsedOutput &&
                parsedOutput.remaining !== undefined &&
                'currentTransfer' in parsedOutput &&
                parsedOutput.currentTransfer !== undefined
              ) {
                const progress = Math.round(
                  ((parsedOutput.total - parsedOutput.remaining) /
                    parsedOutput.total) *
                    100,
                );
                event.reply('backup-library-progress', {
                  phase: 'transferring',
                  progress,
                  currentFile,
                  currentTransfer: parsedOutput.currentTransfer,
                  remaining: parsedOutput.remaining,
                  total: parsedOutput.total,
                  transferSpeed,
                  status: `Copying: ${currentFile} (${parsedOutput.currentTransfer}/${parsedOutput.total})`,
                });
              }
              break;

            case 'speed':
              transferSpeed = parsedOutput.speed;
              break;

            default:
              // Unhandled output type
              break;
          }
        }
      },
      (stderr) => {
        console.warn('rsync stderr:', stderr.toString());
        // Send error information to renderer if needed
        event.reply('backup-library-progress', {
          phase: 'error',
          status: `Error: ${stderr.toString()}`,
        });
      },
    );
  } catch (error: unknown) {
    console.error('Error in backupLibrary:', error);
    event.reply(
      'backup-library-error',
      (error as Error).message || 'Unknown error occurred during backup',
    );
  }
};

export default backupLibrary;
