# CLAUDE.md - AI Development Guide for hihat

## Project Overview

**hihat** is a minimalist offline music library player for macOS built with Electron 26, React 18, and TypeScript. It targets audiophiles who want a modern, dark-mode, ad-free iTunes replacement with gapless playback and large library support.

- **Repository**: `johnnyshankman/hihat`
- **License**: MIT
- **Dev branch**: `hihat2` (main development); **PR target**: `main`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop runtime | Electron 26 (frameless window, custom title bar) |
| Frontend | React 18, MUI 6, Tailwind CSS 3 |
| State management | Zustand 5 (3 stores: library, settingsAndPlayback, ui) |
| Audio engine | Gapless-5 (custom fork `@regosen/gapless-5`) |
| Database | sql.js (in-memory SQLite compiled to WASM, persists to disk on every write) |
| Build tooling | Webpack 5, TypeScript 5, Electron React Boilerplate |
| Testing | Jest (unit), Playwright (E2E with Electron) |
| Package manager | npm 10+ / Node 20+ |

## Project Structure

```
src/
  main/                     # Electron main process
    db/index.ts             # sql.js database wrapper (adapts to better-sqlite3 API)
    ipc/handlers.ts         # All IPC handler registrations
    ipc/backupHandlers.ts   # Library backup via rsync
    ipc/playbackHandlers.ts # Playback control IPC handlers
    library/scanner.ts      # Music file scanner and metadata extractor
    playback/index.ts       # Main-process playback service
    migration/v1ToV2.ts     # v1 -> v2 data migration
    main.ts                 # App entry, window creation, protocol registration
    menu.ts                 # macOS menu bar
    miniPlayer.ts           # Mini player window management
    preload.ts              # contextBridge exposing window.electron.*
    util.ts                 # Path resolution utilities
  renderer/                 # React renderer process
    components/             # React components (Library, Player, Settings, etc.)
    stores/                 # Zustand stores
      libraryStore.ts       # Track/playlist state, indexed lookups
      settingsAndPlaybackStore.ts  # Combined settings + playback state
      uiStore.ts            # Notifications, view state, artist browser
      types.ts              # Store type definitions
    utils/                  # Utility modules
      audioPlayer.ts        # Audio player utilities
      playbackTracker.ts    # Play count threshold tracking
      sortingFunctions.ts   # Table sorting logic
      tableConfig.tsx       # MRT column definitions
      trackSelectionUtils.ts # Next/prev track finding, shuffle, MediaSession
      formatters.ts         # Duration/date formatting
    styles/                 # Theme and CSS
  types/                    # Shared TypeScript types
    dbTypes.ts              # Track, Playlist, Settings interfaces
    ipc.ts                  # IPC channel names, request/response types
    smartPlaylists.ts       # Smart playlist definitions with stable IDs
e2e/                        # Playwright E2E tests
  fixtures/                 # SQL fixture files and test audio files
.erb/                       # Electron React Boilerplate configs (webpack, scripts)
```

## Key Architecture Patterns

### IPC Communication
- Renderer accesses main process exclusively through `window.electron.*` (exposed via `contextBridge` in `preload.ts`)
- All IPC channels are typed in `src/types/ipc.ts` with `IPCRequests` and `IPCResponses` interfaces
- Handlers registered in `src/main/ipc/handlers.ts`, dispatched in `main.ts` via `ipcMain.handle()`

### Database
- sql.js loads SQLite into WASM (no native bindings needed)
- Custom wrapper in `db/index.ts` adapts sql.js to a better-sqlite3-like API (`prepare().get()`, `.all()`, `.run()`)
- **Every write auto-persists to disk** (`fs.writeFileSync` after each mutation)
- Separate dev/prod database directories (`{app.getName()}-dev` vs `userData`)
- Tables: `tracks`, `playlists`, `settings`
- Migrations run on startup via `addColumnIfNotExists()`
- Smart playlists use stable `smartPlaylistId` for identification (prevents duplicates on rename)

### State Management (Zustand 5)
- **libraryStore**: tracks array, playlists, indexed lookups (Map-based O(1)), library/playlist view state, artist filter
- **settingsAndPlaybackStore**: settings (theme, columns, libraryPath, volume), playback state (currentTrack, position, shuffle/repeat), Gapless-5 player instance
- **uiStore**: notifications, currentView, artistBrowserOpen

#### When to subscribe (`useXStore(selector)`) vs read at call time (`useXStore.getState()`)

When a component pulls anything out of a Zustand store — whether that's reading a state slice, displaying it, or **invoking an action** — the access pattern depends on **where the access happens**, not on whether you're reading data or calling a mutator. (Invoking an action is itself a read: you pull the function reference out of the store, then call it. The rule below treats both the same.) Get this wrong and you either pay for subscriptions you don't need, or you reintroduce stale-closure bugs inside effects.

**Use a top-level selector** — `const x = useXStore((s) => s.x);` near the top of the component — when the value is read **or the action is invoked** in any of:
- JSX render output
- Callbacks bound directly to JSX elements (`onClick`, `onChange`, `onClose`, `onConfirm`, drag handlers, etc.)
- `useMemo` / `useCallback` bodies whose result feeds JSX
- Anywhere else that should trigger a re-render when the slice changes

**Use `useXStore.getState().x` at call time** — inside the body of the function that needs it — when the value is read **or the action is invoked** **only** in any of:
- `useEffect` bodies and their cleanup functions
- Listeners attached to non-React sources (IPC handlers, `document.addEventListener`, MediaSession callbacks, etc.)
- Async handlers that fire long after mount and don't drive renders themselves

**Why it matters:**
1. Every top-level selector creates a Zustand subscription for the lifetime of the component — one closure, one listener slot, one shallow compare per store update. For state values you want this (re-render on change). For actions it's technically a no-op (Zustand action references are stable, so the selector returns the same value and never schedules a render), but you still pay the per-update cost and you add noise: an extra binding, an extra dep-array entry, one more thing for the next reader to track.
2. Inside a `useEffect` or async event handler, a top-level selector also captures its value into the effect's closure at render time. For state *values* that means stale reads — `getState()` reads the latest value at the moment the event fires, with no stale-closure trap.
3. For actions specifically, both patterns are functionally equivalent (the reference is stable), so the choice comes down to subscription cost and component clarity.

**If a value is read in both render-driving code and inside an effect, declare it once as a top-level selector and use the variable inside the effect.** Add it to the effect's dep array — Zustand action references are stable, so the effect still only runs once on mount for action-only deps, and ESLint stays happy. Splitting the same action between a top-level selector and a `getState()` call in the same component is a smell — pick one.

**Cross-store reads:** stores access other stores exclusively via `useXStore.getState()` (lazy `require()` if a circular import is involved — see `uiStore.setBrowserOpen`). React hooks aren't available inside store modules, so `getState()` is the only option there.

### Audio Playback
- Gapless-5 player initialized lazily in `initPlayer()`
- Two-track queue pattern: current track + pre-loaded next track for gapless transitions
- Custom `hihat-audio://` protocol registered in main process for file access
- Play count tracked via `playbackTracker.ts` with duration-based threshold (not simple play/complete)
- MediaSession API integration for OS media controls (silent audio element trick)
- Repeat modes: `off`, `track` (Gapless5 `singleMode`), `all`
- Shuffle with navigable history (up to 100 tracks)

### Smart Playlists
- Defined in `src/types/smartPlaylists.ts` with stable IDs
- 3 built-in: Recently Added, Recently Played, Most Played (limit 50 each)
- Track lists computed dynamically via SQL queries, not stored

## Code Style & Lint Rules

- **No `console.log`** - only `console.error` and `console.warn` allowed (ESLint: `no-console`)
- **JSX props sorted alphabetically** (ESLint: `react/jsx-sort-props`)
- **Single quotes** (Prettier)
- **TypeScript strict mode** enabled
- Unused vars must be prefixed with `_` (e.g., `_event`)
- ESLint extends `erb` config with `@typescript-eslint` plugin

## Commands

```bash
npm run start          # Dev mode with hot reload
npm run build          # Production build (main + renderer)
npm run lint           # ESLint check
npm run lint:fix       # ESLint auto-fix
npm run typecheck      # TypeScript type checking (tsc --noEmit)
npm run test           # Jest unit tests
npm run test:e2e       # Playwright E2E tests
npm run package        # Build + package Electron app
```

## Version Bumps

A global version bump touches **exactly four files**, no more and no less:

- `package.json` (root)
- `package-lock.json` (root)
- `release/app/package.json`
- `release/app/package-lock.json`

The root pair is what tooling, dev scripts, and CI read. The `release/app/` pair is what `electron-builder` reads when producing the packaged app — if you forget to bump it, `npm run package` will happily produce artifacts named with the **old** version.

Easiest path:

```bash
npm version <patch|minor|major> --no-git-tag-version           # bumps root pair
(cd release/app && npm version <same> --no-git-tag-version)    # bumps inner pair
npm install                                                    # sanity-check both lockfiles
```

The final `npm install` is just a sanity check that both `package.json` / `package-lock.json` pairs are well-formed; it should be a no-op aside from re-validating the lockfile.

## CI/CD

- **PR Check** (`.github/workflows/prcheck.yml`): runs on `pull_request` to `main`, macOS runner
  - `npm ci` -> `typecheck` -> `lint` -> `build` -> `playwright test`
- **Build** (`.github/workflows/build.yml`): runs on push to `main`, ubuntu runner
  - `npm ci` -> `lint` -> `build`
- **Release** workflows for GitHub releases with DMG artifacts

## E2E Testing

- Playwright tests in `e2e/` directory
- `ElectronHelper` class manages dev server + Electron app lifecycle
- SQL fixture databases (`e2e/fixtures/*.sql`) with template path substitution
- Test audio files in `e2e/fixtures/test-songs-large/`
- Uses `TEST_MODE=true` and `TEST_DB_PATH` env vars to isolate test database

### ALWAYS rebuild before running e2e tests

**You must run `npm run build` before `npm run test:e2e` whenever source has changed.** The e2e harness launches Electron against the compiled output in `dist/` and does **not** hot-reload. Running `test:e2e` against a stale build will silently test the previous version of the code — green results do not mean anything until a fresh build has been produced. This is a hard prerequisite, not a recommendation: a passing run against a stale build is indistinguishable from a passing run against the current source, and you will ship bugs.

### Visual verification of frontend work

**To visually verify frontend changes, use the Playwright e2e system** — write or extend a spec that navigates to the relevant view, takes a screenshot via `TestHelpers.takeScreenshot`, and then read the screenshot back to inspect it. Do **not** claim a UI change is verified from `npm run start` output, from reading the source, or from manually "checking in dev" — those don't produce reviewable artifacts and don't exercise the production build path.

This pairs directly with the rebuild rule above: because e2e runs against the compiled bundle, screenshot verification must be preceded by `npm run build`. The full loop is: edit → `npm run build` → run (or write) a spec that drives the UI and calls `TestHelpers.takeScreenshot` → Read the screenshot file → iterate.

## Important Conventions

1. **Never use `console.log`** - use `console.error` for errors, `console.warn` for informational logging
2. **Sort JSX props alphabetically** - enforced by ESLint
3. **IPC namespace pattern**: `window.electron.{domain}.{method}()` (e.g., `window.electron.tracks.getAll()`)
4. **Settings persistence**: always update both Zustand state AND database when changing settings
5. **Frameless window**: custom title bar component, `frame: false` in BrowserWindow config
6. **Audio protocol**: files served via `hihat-audio://getfile/{encodedPath}`
7. **Database writes are synchronous and blocking** - every `exec()` and `run()` call writes to disk immediately

## Context Summary

This is a production desktop music player app. Changes should prioritize:
- Stability and correctness over cleverness
- Offline-first behavior (no network dependencies)
- macOS-native feel (frameless window, media key integration)
- Performance with large libraries (indexed lookups, virtualized lists)
- Gapless audio playback integrity
