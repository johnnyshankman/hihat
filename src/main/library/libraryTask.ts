/**
 * Library task coordinator
 *
 * Rescans, imports and backups are long-running and touch the music
 * folder, so only one may run at a time. This module owns that lock and
 * the bookkeeping that keeps a task's outcome well defined when the app
 * quits, is force quit or crashes partway through:
 *
 *   - A marker file is written atomically when a task starts and removed
 *     when it finishes (successfully or with an error). If the marker is
 *     still there at the next launch, the previous run was interrupted;
 *     the renderer offers to run it again.
 *   - The latest progress is kept so a reloaded renderer can rehydrate
 *     its progress panel mid-task.
 *   - While a scan or import writes to the database, `tracks:getAll`
 *     serves the track list as it was when the task started, so any
 *     renderer (including one reloaded mid-task, with an empty cache)
 *     sees the library change once, when the task completes.
 *   - A cooperative stop flag lets a graceful quit end the task at its
 *     next checkpoint, and a registered child process (rsync) is killed.
 *
 * Every transition is pushed to the renderer as `library:taskStarted` /
 * `library:taskEnded`, so the UI follows the main process rather than
 * guessing from the IPC call that kicked a task off.
 */

import fs from 'fs';
import path from 'path';
import type { BrowserWindow } from 'electron';
import type { ChildProcess } from 'child_process';
import writeFileAtomic from '../db/atomicWrite';
import { getDatabaseDir } from '../db';
import { sendIpcEvent } from '../ipc/register';
import type { Track } from '../../types/dbTypes';
import type {
  ActiveLibraryTask,
  InterruptedLibraryTask,
  LibraryTaskEnded,
  LibraryTaskKind,
  LibraryTaskProgress,
} from '../../types/ipc';

const MARKER_FILE = 'library-task.json';

/** Thrown at a checkpoint once a stop has been requested. */
export class LibraryTaskStoppedError extends Error {
  constructor() {
    super('Library task stopped');
    this.name = 'LibraryTaskStoppedError';
  }
}

let mainWindow: BrowserWindow | null = null;
let active: ActiveLibraryTask | null = null;
let interrupted: InterruptedLibraryTask | null = null;
let stopRequested = false;
let childProcess: ChildProcess | null = null;
let settle: (() => void) | null = null;
let settled: Promise<void> = Promise.resolve();
let tracksSnapshot: Track[] | null = null;

function markerPath(): string {
  return path.join(getDatabaseDir(), MARKER_FILE);
}

function removeMarker(): void {
  try {
    if (fs.existsSync(markerPath())) fs.unlinkSync(markerPath());
  } catch (error) {
    console.error('Error removing library task marker:', error);
  }
}

export function setMainWindow(window: BrowserWindow): void {
  mainWindow = window;
}

/**
 * Read the marker left by a task that never finished. Call once at
 * launch, before any new task can overwrite it.
 */
export function loadInterruptedTask(): void {
  try {
    if (!fs.existsSync(markerPath())) return;
    const parsed = JSON.parse(fs.readFileSync(markerPath(), 'utf-8'));
    if (['scan', 'import', 'backup'].includes(parsed?.kind)) {
      interrupted = {
        kind: parsed.kind,
        startedAt: Number(parsed.startedAt) || 0,
        ...(typeof parsed.backupPath === 'string'
          ? { backupPath: parsed.backupPath }
          : {}),
      };
    } else {
      removeMarker();
    }
  } catch (error) {
    // An unreadable marker still means something was interrupted, but
    // we can't say what. Drop it rather than show a misleading card.
    console.error('Error reading library task marker:', error);
    removeMarker();
  }
}

export function getInterruptedTask(): InterruptedLibraryTask | null {
  return interrupted;
}

export function dismissInterruptedTask(): void {
  interrupted = null;
  if (!active) removeMarker();
}

export function getActiveTask(): ActiveLibraryTask | null {
  return active;
}

/**
 * Take the lock for `kind`. Returns false when another task holds it.
 * The caller must pair a successful begin with `endTask`.
 */
export function beginTask(
  kind: LibraryTaskKind,
  details: { backupPath?: string } = {},
): boolean {
  if (active) return false;
  active = { kind, startedAt: Date.now(), progress: null };
  stopRequested = false;
  interrupted = null;
  settled = new Promise((resolve) => {
    settle = resolve;
  });
  try {
    writeFileAtomic(
      markerPath(),
      JSON.stringify({ kind, startedAt: active.startedAt, ...details }),
    );
  } catch (error) {
    // The task still runs; we only lose interrupted-run detection.
    console.error('Error writing library task marker:', error);
  }
  sendIpcEvent(mainWindow, 'library:taskStarted', active);
  return true;
}

/**
 * Freeze the track list readers see until `releaseTracksSnapshot`.
 * Call before the task's first write.
 */
export function holdTracksSnapshot(tracks: Track[]): void {
  tracksSnapshot = tracks;
}

/**
 * Let readers see the live database again. Call right before announcing
 * completion, so the refresh that announcement triggers reads the
 * finished library.
 */
export function releaseTracksSnapshot(): void {
  tracksSnapshot = null;
}

/** The frozen track list while a scan or import runs, else null. */
export function getTracksSnapshot(): Track[] | null {
  return tracksSnapshot;
}

/** Record the latest progress so a reloaded renderer can rehydrate. */
export function recordProgress(progress: LibraryTaskProgress): void {
  if (active) active.progress = progress;
}

/**
 * Release the lock. A stopped task keeps its marker so the next launch
 * reports it as interrupted; any other outcome clears it.
 */
export function endTask(result: Omit<LibraryTaskEnded, 'kind'>): void {
  if (!active) return;
  const { kind } = active;
  if (result.outcome !== 'stopped') removeMarker();
  active = null;
  childProcess = null;
  tracksSnapshot = null;
  sendIpcEvent(mainWindow, 'library:taskEnded', { kind, ...result });
  settle?.();
  settle = null;
}

/**
 * Run `fn` under the lock. Resolves to null without running it when
 * another task is in progress.
 */
export async function runExclusive<T>(
  kind: LibraryTaskKind,
  fn: () => Promise<T>,
  describe: (
    value: T,
  ) => Omit<LibraryTaskEnded, 'kind' | 'outcome'> = () => ({}),
): Promise<T | null> {
  if (!beginTask(kind)) return null;
  try {
    const value = await fn();
    endTask({ outcome: 'success', ...describe(value) });
    return value;
  } catch (error) {
    if (error instanceof LibraryTaskStoppedError) {
      endTask({ outcome: 'stopped' });
    } else {
      endTask({
        outcome: 'error',
        message: (error as Error)?.message || 'Unknown error',
      });
    }
    throw error;
  }
}

/** Checkpoint for long loops: throws once a stop has been requested. */
export function throwIfStopRequested(): void {
  if (stopRequested) throw new LibraryTaskStoppedError();
}

export function isStopRequested(): boolean {
  return stopRequested;
}

/** Register the active task's child process so a stop can kill it. */
export function setTaskChildProcess(child: ChildProcess | null): void {
  childProcess = child;
}

/**
 * Ask the active task to stop and wait up to `timeoutMs` for it to reach
 * a checkpoint. Resolves either way; callers persist and exit after.
 */
export async function stopActiveTask(timeoutMs: number): Promise<void> {
  if (!active) return;
  stopRequested = true;
  if (childProcess && !childProcess.killed) {
    childProcess.kill('SIGTERM');
  }
  await Promise.race([
    settled,
    new Promise<void>((resolve) => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}
