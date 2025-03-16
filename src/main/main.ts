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
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { initDatabase, closeDatabase } from './db';
import { ipcHandlers } from './ipc/handlers';
import { setMainWindow as setLibraryMainWindow } from './library/scanner';
import {
  setMainWindow as setPlaybackMainWindow,
  initPlayback,
  cleanupPlayback,
} from './playback';
import {
  setMainWindow as setMiniPlayerMainWindow,
  setupMiniPlayerHandlers,
} from './miniPlayer';

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

if (isDebug) {
  require('electron-debug')();
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
  // Register all IPC handlers
  Object.entries(ipcHandlers).forEach(([channel, handler]) => {
    ipcMain.handle(channel, (event, ...args) => handler(args[0]));
  });

  // Window control handlers
  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
    return null;
  });

  ipcMain.handle('window:maximize', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
    return null;
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
    return null;
  });

  ipcMain.handle('window:toggleFullscreen', () => {
    if (mainWindow) {
      mainWindow.setFullScreen(!mainWindow.isFullScreen());
    }
    return null;
  });

  ipcMain.handle('window:isMaximized', () => {
    if (mainWindow) {
      return mainWindow.isMaximized();
    }
    return false;
  });
};

/**
 * Cleanup resources before app exit
 */
const cleanupResources = () => {
  // Close database connection
  closeDatabase();

  // Cleanup playback resources
  cleanupPlayback();
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
    minWidth: 400,
    minHeight: 560,
    icon: getAssetPath('icon.png'),
    frame: false, // Use frameless window for all platforms
    backgroundColor: '#00000000', // Transparent background
    webPreferences: {
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.on('ready-to-show', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    if (process.env.START_MINIMIZED) {
      mainWindow.minimize();
    } else {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Add listeners for maximize and unmaximize events
  mainWindow.on('maximize', () => {
    if (mainWindow) {
      mainWindow.webContents.send('window:maximized', true);
    }
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow) {
      mainWindow.webContents.send('window:maximized', false);
    }
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

  // Setup IPC handlers before setting window references and initializing playback
  setupIpcHandlers();

  // Set main window reference for scanner and playback
  setLibraryMainWindow(mainWindow);
  setPlaybackMainWindow(mainWindow);
  setMiniPlayerMainWindow(mainWindow);

  // Setup MiniPlayer handlers
  setupMiniPlayerHandlers();

  // Initialize playback service
  initPlayback();

  // Remove this if your app does not use auto updates
  // eslint-disable-next-line
  new AppUpdater();
};

/**
 * Add event listeners...
 */

app.on('window-all-closed', () => {
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
