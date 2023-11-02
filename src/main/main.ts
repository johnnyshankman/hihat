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
import { app, BrowserWindow, shell, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import fs from 'fs';
import * as mm from 'music-metadata';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';

class AppUpdater {
  constructor() {
    log.transports.file.level = 'info';
    autoUpdater.logger = log;
    autoUpdater.checkForUpdatesAndNotify();
  }
}

function parseData(fp: string) {
  const defaultData = {};
  try {
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  } catch (error) {
    return defaultData;
  }
}

let mainWindow: BrowserWindow | null = null;

ipcMain.on('ipc-example', async (event, arg) => {
  const msgTemplate = (pingPong: string) => `IPC test: ${pingPong}`;
  console.log(msgTemplate(arg));
  event.reply('ipc-example', msgTemplate('pong'));
});

// ipcMain.on('save-data', async (event, arg) => {
//   const dataPath = app.getPath('userData');
//   const filePath = path.join(dataPath, 'config.json');
//   fs.writeFileSync(filePath, JSON.stringify(arg));
// });

ipcMain.on('select-dirs', async (event): Promise<any> => {
  if (!mainWindow) {
    return;
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  // passsing directoryPath and callback function
  fs.readdir(result.filePaths[0], async (err, files) => {
    // create an empty mapping of files to tags
    let filesToTags: { [key: string]: mm.IAudioMetadata } = {};
    // for (let i = 0; i < 100; i += 1) {
    for (let i = 0; i < files.length; i += 1) {
      let metadata;
      try {
        // eslint-disable-next-line no-await-in-loop
        metadata = await mm.parseFile(`${result.filePaths[0]}/${files[i]}`);
      } catch (e) {
        console.log(e);
      }

      if (metadata)
        filesToTags[`${result.filePaths[0]}/${files[i]}`] = metadata;

      event.reply('song-imported', {
        songsImported: i,
        totalSongs: files.length,
      });
    }

    // reorder filesToTags keys by artist and then album and then track number within that album
    const orderedFilesToTags: { [key: string]: mm.IAudioMetadata } = {};
    Object.keys(filesToTags)
      .sort((a, b) => {
        const artistA = filesToTags[a].common.artist;
        const artistB = filesToTags[b].common.artist;
        const albumA = filesToTags[a].common.album;
        const albumB = filesToTags[b].common.album;
        const trackA = filesToTags[a].common.track.no;
        const trackB = filesToTags[b].common.track.no;
        // handle null cases
        if (!artistA) return -1;
        if (!artistB) return 1;
        if (!albumA) return -1;
        if (!albumB) return 1;
        if (!trackA) return -1;
        if (!trackB) return 1;

        // reorder filesToTags keys by artist and then album and then track number within that album
        if (artistA < artistB) return -1;
        if (artistA > artistB) return 1;
        if (albumA < albumB) return -1;
        if (albumA > albumB) return 1;
        if (trackA < trackB) return -1;
        if (trackA > trackB) return 1;
        return 0;
      })
      .forEach((key) => {
        orderedFilesToTags[key] = filesToTags[key];
      });

    filesToTags = {};

    // event.returnValue = result.filePaths;
    // lets make this reply with the nice object
    event.reply('select-dirs', orderedFilesToTags);
  });
});

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

const createWindow = async () => {
  if (isDebug) {
    await installExtensions();
  }

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 728,
    icon: getAssetPath('icons/1024x1024.png'),
    webPreferences: {
      webSecurity: false,
      preload: app.isPackaged
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, '../../.erb/dll/preload.js'),
    },
  });

  mainWindow.loadURL(resolveHtmlPath('index.html'));

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }

    const dataPath = app.getPath('userData');
    const filePath = path.join(dataPath, 'config.json');
    const contents = parseData(filePath);
    mainWindow.webContents.send('initialize', contents);
  });

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

  const menuBuilder = new MenuBuilder(mainWindow);
  menuBuilder.buildMenu();

  // Open urls in the user's browser
  mainWindow.webContents.setWindowOpenHandler((edata) => {
    shell.openExternal(edata.url);
    return { action: 'deny' };
  });

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
