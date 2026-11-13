import { create } from 'zustand';
import type {
  ActiveLibraryTask,
  InterruptedLibraryTask,
  LibraryTaskEnded,
  LibraryTaskKind,
  LibraryTaskProgress,
} from '../../types/ipc';

// How long a finished task's "done" state stays in the panel.
const DONE_VISIBLE_MS = 2500;

export interface LibraryTaskView {
  kind: LibraryTaskKind;
  phase: 'running' | 'done' | 'error';
  startedAt: number;
  processed: number;
  /** 0 while the total isn't known yet (backup planning). */
  total: number;
  currentFile?: string;
  status?: string;
  /** When `processed` first moved; anchors the time-remaining estimate. */
  progressStartedAt: number;
  /** Summary when done, or the error message. */
  message?: string;
}

interface LibraryTaskStore {
  task: LibraryTaskView | null;
  interrupted: InterruptedLibraryTask | null;
  minimized: boolean;
  taskStarted: (task: ActiveLibraryTask) => void;
  progress: (progress: LibraryTaskProgress) => void;
  taskEnded: (result: LibraryTaskEnded, message?: string) => void;
  dismiss: () => void;
  setInterrupted: (task: InterruptedLibraryTask | null) => void;
  setMinimized: (minimized: boolean) => void;
}

/**
 * Runtime view of the long-running library task (rescan, import or
 * backup) that the main process is running. The main process owns the
 * task; this store only mirrors its events so the progress panel,
 * Settings and the welcome screen can render it from anywhere,
 * independent of whether the Settings drawer is open.
 */
const useLibraryTaskStore = create<LibraryTaskStore>((set, get) => ({
  task: null,
  interrupted: null,
  minimized: false,

  taskStarted: (task) => {
    const current = get().task;
    // Rehydration and the push event can both report the same task.
    if (current?.phase === 'running' && current.startedAt === task.startedAt) {
      if (task.progress) get().progress(task.progress);
      return;
    }
    set({
      task: {
        kind: task.kind,
        phase: 'running',
        startedAt: task.startedAt,
        processed: task.progress?.processed ?? 0,
        total: task.progress?.total ?? 0,
        currentFile: task.progress?.currentFile,
        status: task.progress?.status,
        progressStartedAt: 0,
      },
      interrupted: null,
    });
  },

  progress: (progress) => {
    const { task } = get();
    if (!task || task.phase !== 'running') return;
    set({
      task: {
        ...task,
        processed: progress.processed,
        total: progress.total,
        currentFile: progress.currentFile ?? task.currentFile,
        status: progress.status ?? task.status,
        progressStartedAt:
          task.progressStartedAt === 0 && progress.processed > 0
            ? Date.now()
            : task.progressStartedAt,
      },
    });
  },

  taskEnded: (result, message) => {
    const { task } = get();
    if (!task || task.kind !== result.kind) return;
    if (result.outcome === 'stopped') {
      set({ task: null });
      return;
    }
    if (result.outcome === 'error') {
      set({
        task: { ...task, phase: 'error', message: result.message ?? message },
        minimized: false,
      });
      return;
    }
    set({
      task: {
        ...task,
        phase: 'done',
        processed: Math.max(task.processed, task.total),
        message,
      },
    });
    const { startedAt } = task;
    setTimeout(() => {
      const latest = get().task;
      if (latest?.phase === 'done' && latest.startedAt === startedAt) {
        set({ task: null });
      }
    }, DONE_VISIBLE_MS);
  },

  dismiss: () => set({ task: null }),

  setInterrupted: (interrupted) => set({ interrupted }),

  setMinimized: (minimized) => set({ minimized }),
}));

/** True while a task is running (not in its brief done/error state). */
export function selectTaskRunning(state: { task: LibraryTaskView | null }) {
  return state.task?.phase === 'running';
}

/**
 * True while a scan or import is writing to the library. Track list
 * refreshes are held back for the duration so the visible library
 * changes once, when the task finishes.
 */
export function isLibraryWriteRunning(): boolean {
  const { task } = useLibraryTaskStore.getState();
  return task?.phase === 'running' && task.kind !== 'backup';
}

// E2E diagnostic hook, same gate as HIHAT_E2E_UI_STORE in uiStore.
if (typeof window !== 'undefined' && window.electron?.isTestMode) {
  (window as unknown as Record<string, unknown>).HIHAT_E2E_LIBRARY_TASK_STORE =
    useLibraryTaskStore;
}

export default useLibraryTaskStore;
