/* eslint global-require: off, no-console: off, promise/always-return: off */

/**
 * This module executes inside of electron's main process. You can start
 * electron renderer process from here and communicate with the other processes
 * through IPC.
 *
 * When running `npm run build` or `npm run build:main`, this file is compiled to
 * `./src/main.js` using webpack. This gives us some performance wins.
 */
import path from 'path';
import { app, BrowserWindow, shell, ipcMain, protocol } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import electronDebug from 'electron-debug';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import {
  initDatabase,
  closeDatabase,
  bulkImportTracksAsync,
  bulkImportPlaylistsAsync,
  updateSettingsFromMigration,
  getSettings,
} from './db';
import { ipcHandlers } from './ipc/handlers';
import { registerIpcHandler, registerIpcHandlers, sendIpcEvent } from './ipc/register';
import { setMainWindow as setLibraryMainWindow } from './library/scanner';
import {
  setMainWindow as setMiniPlayerMainWindow,
  setupMiniPlayerHandlers,
} from './miniPlayer';
import backupLibrary from './ipc/backupHandlers';
import { migrateV1ToV2, needsMigration } from './migration/v1ToV2';

/**
 * Configure file logging for production mode
 */
function configureLogging() {
  if (process.env.NODE_ENV === 'production') {
    // Set log level for file transport
    log.transports.file.level = 'info';

    // Set log file path - use separate directories for dev and prod
    // electron-log v5 renamed resolvePath to resolvePathFn.
    log.transports.file.resolvePathFn = () => {
      const basePath = app.getPath('userData');
      const userDataPath =
        process.env.NODE_ENV === 'development'
          ? path.join(basePath, '..', `${app.getName()}-dev`)
          : basePath;
      return path.join(userDataPath, 'logs/main.log');
    };

    // Increase max log file size (default is 1MB)
    log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB

    // Add timestamp to each log message
    log.transports.file.format =
      '[{y}-{m}-{d} {h}:{i}:{s}.{ms}] [{level}] {text}';

    // Override console methods to redirect to electron-log in production
    console.log = (...args) => log.info(...args);
    console.info = (...args) => log.info(...args);
    console.warn = (...args) => log.warn(...args);
    console.error = (...args) => log.error(...args);
    console.debug = (...args) => log.debug(...args);

    log.info('=== Application Started ===');
    log.info('Version:', app.getVersion());
    log.info('Platform:', process.platform);
    const basePath = app.getPath('userData');
    const nodeEnv: string = process.env.NODE_ENV || 'production';
    const actualUserDataPath =
      nodeEnv === 'development'
        ? path.join(basePath, '..', `${app.getName()}-dev`)
        : basePath;
    log.info('User Data Path:', actualUserDataPath);
    log.info('Environment:', process.env.NODE_ENV || 'production');
  }
}

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

let mainWindow: BrowserWindow | null = null;

if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support');
  sourceMapSupport.install();
}

const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

const isTest =
  process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';
const isTestHidden = isTest && process.env.TEST_VISIBLE !== 'true';

if (isDebug) {
  electronDebug();
}

const installExtensions = async () => {
  const installer = require('electron-devtools-installer');
  const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
  const extensions = ['REACT_DEVELOPER_TOOLS'];

  return installer
    .default(
      extensions.map((name) => installer[name]),
      forceDownload,
    )
    .catch(console.log);
};

/**
 * Setup IPC handlers for the main process
 */
const setupIpcHandlers = () => {
  // Bulk-register the typed handler map (tracks, playlists, settings,
  // library, dialog, app, ui, fileSystem). Each entry is checked by
  // `IPCHandler<C>` so request/response shapes match the IPC contract.
  registerIpcHandlers(ipcHandlers);

  // Window control handlers — closures over `mainWindow` since they need
  // the live reference, not a one-shot import.
  registerIpcHandler('window:minimize', async () => {
    if (mainWindow) mainWindow.minimize();
  });
  registerIpcHandler('window:maximize', async () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      else mainWindow.maximize();
    }
  });
  registerIpcHandler('window:close', async () => {
    if (mainWindow) mainWindow.close();
  });
  registerIpcHandler('window:toggleFullscreen', async () => {
    if (mainWindow) mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });
  registerIpcHandler('window:isMaximized', async () =>
    mainWindow ? mainWindow.isMaximized() : false,
  );

  // Library backup is fire-and-forget with progress events; uses ipcMain.on
  // (not invoke) so backupLibrary can call event.reply for incremental
  // updates. Stays as raw `.on` registration.
  ipcMain.on('menu-backup-library', (event, backupPath) => {
    backupLibrary(backupPath, event);
  });
};

/**
 * Cleanup resources before app exit
 */
const cleanupResources = () => {
  // Log application shutdown in production
  if (process.env.NODE_ENV === 'production') {
    log.info('=== Application Shutting Down ===');
  }

  // Close database connection
  closeDatabase();
};

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  /**
   * Register a custom protocol to handle audio file requests from the renderer process
   * This allows the renderer to access audio files through a custom URL scheme
   */
  protocol.registerFileProtocol('hihat-audio', (request, callback) => {
    const url = request.url.replace('hihat-audio://getfile/', '');
    const decodedUrl = decodeURIComponent(url);
    try {
      return callback(decodedUrl);
    } catch (error) {
      console.error('Error handling audio file request:', error);
      return callback({ error: 404 });
    }
  });

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  // Create window options
  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    minWidth: 640,
    minHeight: 400,
    icon: getAssetPath('icon.png'),
    frame: false, // Use frameless window for all platforms
    backgroundColor: '#00000000', // Transparent background
    webPreferences: {
      // In all modes (dev, prod, test) the main bundle and preload bundle
      // sit in the same directory: .erb/dll/ in dev, dist/main/ in prod.
      preload: path.join(__dirname, 'preload.js'),
      // Test mode configuration
      sandbox: !isTest,
      nodeIntegration: false, // Keep false for security
      contextIsolation: true, // Keep true for security
      webSecurity: true, // Keep true for security
      backgroundThrottling: !isTest, // Disable throttling in test mode so hidden window renders normally
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  // ── Deferred window show ──────────────────────────────────────────
  // The window is created with `show: false` (see BrowserWindow options
  // above) to prevent a flash of incorrectly-themed content. Two
  // conditions must be met before the window is shown:
  //
  //   1. ready-to-show  — Electron has painted the first frame
  //   2. app:settingsLoaded — the renderer has loaded the user's theme
  //      preference from the database (sent from loadSettings() in
  //      settingsAndPlaybackStore.ts)
  //
  // Without this, the renderer's initial Zustand state (theme: 'dark')
  // is painted before the async IPC round-trip to fetch the real
  // preference completes, causing a visible theme flash for light-mode
  // users. By holding the window hidden until both events fire, the
  // first frame the user sees always has the correct theme applied.
  // ────────────────────────────────────────────────────────────────────
  let windowReadyToShow = false;
  let rendererSettingsLoaded = false;

  const showWindowIfReady = () => {
    if (!mainWindow || !windowReadyToShow || !rendererSettingsLoaded) return;
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else if (!isTestHidden) {
      mainWindow.show();
    }
  };

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    windowReadyToShow = true;
    showWindowIfReady();
  });

  ipcMain.once('app:settingsLoaded', () => {
    rendererSettingsLoaded = true;
    showWindowIfReady();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Add listeners for maximize and unmaximize events
  mainWindow.on('maximize', () => {
    sendIpcEvent(mainWindow, 'window:maximized', true);
  });

  mainWindow.on('unmaximize', () => {
    sendIpcEvent(mainWindow, 'window:maximized', false);
  });

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

  // Initialize database
  initDatabase();

  // Check and run v1 to v2 migration if needed
  if (needsMigration()) {
    // Run migration in background after window is ready
    (async () => {
      try {
        // Wait for window to be ready and renderer to load
        while (!windowReadyToShow) {
          // eslint-disable-next-line no-await-in-loop
          await new Promise((resolve) => {
            setTimeout(resolve, 100);
          });
        }

        // Wait a bit more for the renderer to fully initialize
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });

        // Safety check: Only migrate if user doesn't already have a library configured
        const currentSettings = getSettings();

        if (currentSettings.libraryPath && currentSettings.libraryPath !== '') {
          console.warn(
            '⚠️  Skipping hihat v1 migration: User already has a library configured in hihat2',
          );
          console.warn(
            `   Current library path: ${currentSettings.libraryPath}`,
          );
          console.warn(
            '   To prevent data loss, the v1 userConfig.json will not be imported.',
          );
          console.warn(
            '   If you want to migrate your v1 data, please reset your hihat2 library first.',
          );
        } else {
          console.warn(
            '🔄 Detected hihat v1 data, starting migration to hihat2...',
          );

          // Send migration start event to renderer
          sendIpcEvent(mainWindow, 'migration:start');

          // Run migration with progress callbacks
          const migrationData = await migrateV1ToV2((progress) => {
            // Send progress updates to renderer
            sendIpcEvent(mainWindow, 'migration:progress', progress);
          });

          if (migrationData) {
            console.warn(
              `✅ Migration data ready: ${migrationData.tracks.length} tracks, ${migrationData.playlists.length} playlists`,
            );

            // Import tracks using async version to avoid blocking main thread
            const tracksImported = await bulkImportTracksAsync(
              migrationData.tracks,
              (current, total) => {
                sendIpcEvent(mainWindow, 'migration:progress', {
                  phase: 'importing' as const,
                  message: `Importing tracks: ${current}/${total}...`,
                });
              },
            );
            console.warn(`✅ Imported ${tracksImported} tracks from hihat v1`);

            // Import playlists using async version
            const playlistsImported = await bulkImportPlaylistsAsync(
              migrationData.playlists,
            );
            console.warn(
              `✅ Imported ${playlistsImported} playlists from hihat v1`,
            );

            // Update settings
            updateSettingsFromMigration(
              migrationData.libraryPath,
              migrationData.lastPlayedSongId,
            );
            console.warn('✅ Settings updated from hihat v1');

            console.warn('🎉 Migration from hihat v1 to hihat2 complete!');

            // Send migration complete event to renderer
            sendIpcEvent(mainWindow, 'migration:complete', {
              tracksCount: tracksImported,
              playlistsCount: playlistsImported,
            });

            // Note: Window reload is now handled by the MigrationDialog component
            // when the user clicks the "Continue" button
          } else {
            console.warn('⚠️  Migration failed or no data to migrate');
          }
        }
      } catch (error) {
        console.error('❌ Error during migration:', error);
        // Continue app startup even if migration fails
      }
    })();
  } else {
    console.warn('✓ No hihat v1 migration needed');
  }

  // Setup IPC handlers before setting window references and initializing playback
  setupIpcHandlers();

  // Set main window reference for scanner and mini player
  setLibraryMainWindow(mainWindow);
  setMiniPlayerMainWindow(mainWindow);

  // Setup MiniPlayer handlers
  setupMiniPlayerHandlers();

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line no-new
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
  // Log when all windows are closed in production
  if (process.env.NODE_ENV === 'production') {
    log.info('All windows closed');
  }

  // Respect the OSX convention of having the application in memory even
  // after all windows have been closed
  if (process.platform !== 'darwin') {
    cleanupResources();
    app.quit();
  }
});

app
  .whenReady()
  .then(() => {
    // Configure logging before anything else
    configureLogging();

    createWindow();
    app.on('activate', () => {
      // On macOS it's common to re-create a window in the app when the
      // dock icon is clicked and there are no other windows open.
      if (mainWindow === null) createWindow();
    });
  })
  .catch(console.log);

app.on('will-quit', () => {
  cleanupResources();
});
