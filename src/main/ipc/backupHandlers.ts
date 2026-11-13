/**
 * Backup Handlers
 *
 * Library backup via rsync. Lives in its own file (separate from
 * `handlers.ts`) because the IPC shape is fundamentally different:
 *   - registers via `ipcMain.on('menu-backup-library', …)`, not
 *     `ipcMain.handle`
 *   - streams progress to the renderer via `event.reply()` repeatedly
 *     over the lifetime of the rsync subprocess (planning → transferring
 *     → success/error), rather than returning a single typed response
 *
 * Two phases:
 *   1. Plan — walk source and destination to count files that need to
 *      transfer (matches --ignore-existing semantics). Knowing the
 *      denominator up front is what lets the renderer show smooth
 *      progress in phase 2.
 *   2. Transfer — run rsync with `--out-format='%i %n'` so each
 *      transferred entry is one stable, version-independent line on
 *      stdout. The `%i` itemize-changes string lets us tell files apart
 *      from directories that rsync creates along the way (rsync emits a
 *      line for each created directory too — counting those would blow
 *      past the file-count denominator we computed in phase 1). Emit
 *      progress events throttled to 250ms. This avoids parsing rsync's
 *      verbose-mode output, whose format differs across rsync 2.x,
 *      rsync 3.x, and OpenRsync (the macOS Sequoia default).
 *
 * Anything else that needs the same long-running, progress-streaming
 * shape belongs in its own similar file/module — not in `handlers.ts`.
 */

import path from 'path';
import { promises as fsp } from 'fs';
import type { IpcMainEvent } from 'electron';
import Rsync from 'rsync';
import * as db from '../db';
import {
  beginTask,
  endTask,
  isStopRequested,
  recordProgress,
  setTaskChildProcess,
} from '../library/libraryTask';

const PLANNING_EMIT_EVERY_N_FILES = 100;
const TRANSFER_EMIT_INTERVAL_MS = 250;

/**
 * Walk the source library tree, counting files that don't yet exist at
 * the destination. Mirrors rsync `--ignore-existing` semantics: presence
 * of the destination path means "skip", regardless of size or mtime.
 *
 * `onChecked` fires every {@link PLANNING_EMIT_EVERY_N_FILES} files so
 * the renderer can keep the indeterminate progress bar lively rather
 * than appearing frozen on large libraries.
 */
async function planBackup(
  libraryPath: string,
  backupPath: string,
  onChecked: (totalChecked: number) => void,
): Promise<{ totalFiles: number; totalChecked: number }> {
  const state = { totalFiles: 0, totalChecked: 0 };

  const walk = async (dir: string): Promise<void> => {
    let entries: import('fs').Dirent[];
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    await Promise.all(
      entries.map(async (entry) => {
        const sourcePath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(sourcePath);
          return;
        }
        if (!entry.isFile()) return;
        const rel = path.relative(libraryPath, sourcePath);
        const destPath = path.join(backupPath, rel);
        try {
          await fsp.access(destPath);
          // Exists at destination — rsync will skip it.
        } catch {
          state.totalFiles += 1;
        }
        state.totalChecked += 1;
        if (state.totalChecked % PLANNING_EMIT_EVERY_N_FILES === 0) {
          onChecked(state.totalChecked);
        }
      }),
    );
  };

  await walk(libraryPath);
  return state;
}

/**
 * Plan and run the rsync transfer. Resolves once the backup is complete;
 * rejects with a user-facing message otherwise.
 */
const runBackup = async (
  backupPath: string,
  event: IpcMainEvent,
): Promise<void> => {
  const settings = await db.getSettings();
  const { libraryPath } = settings;

  if (!libraryPath) {
    throw new Error('Library path is not set');
  }

  if (
    backupPath === libraryPath ||
    backupPath.startsWith(libraryPath + path.sep)
  ) {
    throw new Error('Cannot backup to the same folder or its subfolder');
  }

  const reportPlanning = (status: string, totalFiles?: number) => {
    recordProgress({ processed: 0, total: 0, status });
    event.reply('backup-library-progress', {
      phase: 'planning',
      status,
      ...(totalFiles === undefined ? {} : { totalFiles }),
    });
  };

  // Phase 1: Plan
  reportPlanning('Checking files...');

  const { totalFiles } = await planBackup(
    libraryPath,
    backupPath,
    (checked) => {
      reportPlanning(`Checking ${checked.toLocaleString()} files...`);
    },
  );

  reportPlanning(
    totalFiles === 0
      ? 'Already up to date'
      : `Found ${totalFiles.toLocaleString()} new file${
          totalFiles === 1 ? '' : 's'
        } to back up`,
    totalFiles,
  );

  if (totalFiles === 0) return;

  await new Promise<void>((resolve, reject) => {
    // Phase 2: Transfer
    let filesCopied = 0;
    let lastEmit = 0;
    let stdoutBuf = '';

    const emitProgress = (currentFile: string, force: boolean) => {
      const now = Date.now();
      if (!force && now - lastEmit < TRANSFER_EMIT_INTERVAL_MS) return;
      lastEmit = now;
      const progress = Math.min(
        100,
        Math.round((filesCopied / totalFiles) * 100),
      );
      recordProgress({
        processed: filesCopied,
        total: totalFiles,
        currentFile,
      });
      event.reply('backup-library-progress', {
        phase: 'transferring',
        progress,
        currentFile,
        currentTransfer: filesCopied,
        total: totalFiles,
        remaining: Math.max(0, totalFiles - filesCopied),
        status: `Copying: ${path.basename(currentFile)}`,
      });
    };

    const handleLine = (rawLine: string) => {
      const line = rawLine.trim();
      // rsync emits one line per transferred *entry* — files AND
      // directory creations. Format with --out-format='%i %n' is:
      // 11 itemize chars + ' ' + path. Position 1 of %i is the entry
      // type: 'f' (regular file), 'd' (directory), 'L' (symlink), etc.
      // Only count regular files so the numerator can't overshoot the
      // file-count denominator from planBackup. Lines too short or with
      // a non-file type byte are skipped silently.
      if (line.length < 13 || line.charAt(1) !== 'f') return;
      const fileName = line.substring(12);
      filesCopied += 1;
      const isFirst = filesCopied === 1;
      const isLast = filesCopied >= totalFiles;
      emitProgress(fileName, isFirst || isLast);
    };

    const rsync = new Rsync();
    rsync
      .set('ignore-existing')
      .set('out-format', '%i %n')
      .flags(['r'])
      .source(libraryPath + path.sep)
      .destination(backupPath);

    const child = rsync.execute(
      (error, _code, cmd) => {
        console.warn('rsync command:', cmd);

        if (error) {
          console.error('rsync error:', error);
          reject(error);
          return;
        }

        // Flush any buffered partial line that didn't get a trailing newline.
        if (stdoutBuf.trim()) handleLine(stdoutBuf);

        // Final 100% — guarantees the bar lands at full even if the file
        // count drifted (e.g. rsync copied directory entries we didn't
        // count in planBackup).
        event.reply('backup-library-progress', {
          phase: 'transferring',
          progress: 100,
          currentFile: '',
          currentTransfer: totalFiles,
          total: totalFiles,
          remaining: 0,
          status: 'Finishing up…',
        });

        resolve();
      },
      (stdout) => {
        stdoutBuf += stdout.toString();
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop() ?? '';
        lines.forEach(handleLine);
      },
      (stderr) => {
        // rsync writes warnings (e.g. "skipping non-regular file") to
        // stderr without exiting non-zero. Log them but don't surface as
        // a backup error or progress-phase change — only the exit-code
        // callback above triggers the error path.
        console.warn('rsync stderr:', stderr.toString());
      },
    );
    // Lets a graceful quit kill rsync. rsync writes each file to a hidden
    // temp name and renames it when done, so a killed run never leaves a
    // partial file under a real name in the backup.
    setTaskChildProcess(child);
  });
};

/**
 * Backup the user's library to the specified directory using rsync.
 * Runs as the single active library task; refuses to start when another
 * task holds the lock.
 *
 * @param backupPath - Path to backup the library to
 * @param event - IPC event to reply with progress or completion
 */
const backupLibrary = async (backupPath: string, event: IpcMainEvent) => {
  if (!beginTask('backup', { backupPath })) {
    event.reply(
      'backup-library-error',
      'Another library task is running. Try again when it finishes.',
    );
    return;
  }
  try {
    await runBackup(backupPath, event);
    endTask({ outcome: 'success' });
    event.reply('backup-library-success');
  } catch (error: unknown) {
    if (isStopRequested()) {
      // Quit asked rsync to stop; the marker stays so the next launch
      // offers to finish the backup.
      endTask({ outcome: 'stopped' });
      return;
    }
    console.error('Error in backupLibrary:', error);
    const message =
      (error as Error).message || 'Unknown error occurred during backup';
    endTask({ outcome: 'error', message });
    event.reply('backup-library-error', message);
  }
};

export default backupLibrary;
