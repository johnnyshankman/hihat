/**
 * Side-effect-only setup that stubs `window.electron` before any test code
 * imports a module that touches it at load time (e.g. libraryStore registers
 * an ipcRenderer listener and fires initializeLibrary on first import).
 *
 * Tests that need the stub MUST import this file FIRST so the assignment
 * runs before the dependent module is required by ts-jest.
 */

if (typeof window !== 'undefined') {
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { on: jest.fn(), removeListener: jest.fn() },
    tracks: { getAll: jest.fn(async () => []) },
    playlists: {
      getAll: jest.fn(async () => []),
      getSortPreferences: jest.fn(async () => ({})),
    },
  };
}

// Silence the lifecycle warnings/errors that initializeLibrary emits while
// resolving with empty stub data — they're not the system under test.
jest.spyOn(console, 'warn').mockImplementation(() => {});
jest.spyOn(console, 'error').mockImplementation(() => {});
