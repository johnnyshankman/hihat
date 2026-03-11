# Windows Compatibility Roadmap

## Current Status

The app is ~85% Windows-ready. Electron abstracts most platform differences, and the codebase already uses cross-platform patterns in the right places.

## Already Cross-Platform (no work needed)

- **Database** — sql.js is WASM-based, `app.getPath('userData')` and `path.join()` used throughout
- **Custom protocol** — `hihat-audio://` registration is platform-agnostic
- **Window controls** — minimize/maximize/close/fullscreen all work cross-platform
- **IPC & preload** — contextBridge is fully cross-platform
- **Menu** — `menu.ts` already has a `buildDefaultTemplate()` with `CmdOrCtrl+` accelerators for non-macOS
- **Package config** — `package.json` already defines `win` (NSIS installer) and `linux` build targets
- **Quit behavior** — `main.ts:434` already handles the "quit on all windows closed" difference
- **No native modules** — sql.js is WASM, Gapless-5 is pure JS, music-metadata is pure JS
- **No hardcoded Unix paths** — all paths use `path.join()` and Electron abstractions
- **Notarization** — `.erb/scripts/notarize.js` already gates on `darwin`

## Work Required

### Small (~few hours)

#### 1. Platform guard for `titleBarStyle` in miniPlayer

`src/main/miniPlayer.ts:179` sets `titleBarStyle: 'hidden'` which is macOS-specific. Wrap it in a platform check:

```ts
...(process.platform === 'darwin' ? { titleBarStyle: 'hidden' } : {}),
```

#### 2. Custom title bar UI tweaks

The frameless window (`frame: false`) works on all platforms, but the custom title bar in the renderer may need visual adjustments for Windows:
- No macOS traffic lights to account for
- Different drag region expectations
- Windows users expect minimize/maximize/close buttons on the top-right

### Medium (~1-2 days)

#### 3. Replace rsync backup with cross-platform alternative

`src/main/ipc/backupHandlers.ts` uses the `rsync` npm package which wraps the native `rsync` binary — not available on Windows without WSL2.

Options (pick one):
- **Option A**: Rewrite backup using Node.js `fs.cp()` (recursive copy, available in Node 20+). Simplest, no external dependencies.
- **Option B**: Bundle [cwRsync](https://www.itefix.net/cwrsync) for Windows builds. Preserves rsync behavior but adds packaging complexity.
- **Option C**: Require WSL2 on Windows. Least work but worst UX — not recommended.

Recommendation: **Option A** — use `fs.cp()` with `{ recursive: true }` and implement incremental copy logic (compare mtimes) to avoid re-copying unchanged files.

#### 4. CI/CD pipeline additions

Current workflows only target macOS. Changes needed:

**`.github/workflows/prcheck.yml`**:
- Add a `windows-latest` runner job to catch Windows-specific issues in PRs

**`.github/workflows/release.yml`**:
- Add a Windows build step that produces an NSIS `.exe` installer
- The `package.json` `"win"` config already targets `nsis`
- Add artifact upload for the Windows installer alongside the existing `.dmg`

**`.github/workflows/build.yml`**:
- Optionally add Windows to the build matrix

#### 5. Windows testing

- Run E2E tests on Windows (currently macOS-only in `e2e/`)
- Verify file paths, audio playback, and frameless window behavior
- Test the custom `hihat-audio://` protocol with Windows file paths (backslashes)
- Test drag-and-drop with Windows Explorer
- Test media key integration on Windows

## Key Files to Modify

| File | Change |
|------|--------|
| `src/main/miniPlayer.ts` | Platform guard for `titleBarStyle` |
| `src/main/ipc/backupHandlers.ts` | Replace rsync with cross-platform copy |
| `src/renderer/components/` (title bar) | Windows window control buttons |
| `.github/workflows/prcheck.yml` | Add Windows runner |
| `.github/workflows/release.yml` | Add Windows build + artifact |
| `package.json` | Verify/update `"win"` build config |

## Estimated Total Effort

~1-3 days of focused work:
- rsync backup alternative: ~0.5-1 day
- CI/CD pipeline additions: ~0.5 day
- Platform guards and UI polish: ~few hours
- Windows testing and bug fixes: ~0.5-1 day
