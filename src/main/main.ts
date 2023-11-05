/* eslint global-require: off, no-console: off, promise/always-return: off */

import path from 'path';
import { app, BrowserWindow, shell, ipcMain, dialog, protocol } from 'electron';
import { autoUpdater } from 'electron-updater';
import log from 'electron-log';
import fs from 'fs';
import * as mm from 'music-metadata';
import MenuBuilder from './menu';
import { resolveHtmlPath } from './util';
import { StoreStructure, SongSkeletonStructure } from '../common/common';

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

/**
 * @dev for requesting album art data from music metadata
 *      which is much too large to send over the IPC for every song
 *      during initialization, so we lazy load it when the user
 *     clicks on a song.
 */
ipcMain.on('get-album-art', async (event, arg) => {
  const filePath = arg.path;
  const metadata = await mm.parseFile(filePath);
  event.reply('get-album-art', metadata.common.picture?.[0] || '');
});

const findAllFilesRecursively = (dir: string) => {
  const result = [];

  const files = [dir];
  do {
    const filepath = files.pop();

    if (!filepath) {
      break;
    }

    const stat = fs.lstatSync(filepath);
    if (stat.isDirectory()) {
      fs.readdirSync(filepath).forEach((f) =>
        files.push(path.join(filepath, f)),
      );
    } else if (stat.isFile()) {
      result.push(path.relative(dir, filepath));
    }
  } while (files.length !== 0);

  return result;
};

/**
 * @dev for requesting the directory of music the user wants to import
 *      and then importing it into the app as well as cache'ing it
 *     in the user's app data directory.
 */
ipcMain.on('select-dirs', async (event): Promise<any> => {
  if (!mainWindow) {
    return;
  }
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });

  const files = findAllFilesRecursively(result.filePaths[0]);

  // create an empty mapping of files to tags we want to cache and import
  let filesToTags: { [key: string]: SongSkeletonStructure } = {};

  for (let i = 0; i < files.length; i += 1) {
    let metadata;

    try {
      // eslint-disable-next-line no-await-in-loop
      metadata = await mm.parseFile(`${result.filePaths[0]}/${files[i]}`);
    } catch (e) {
      console.log(e);
    }

    if (metadata)
      filesToTags[`${result.filePaths[0]}/${files[i]}`] = {
        common: {
          ...metadata.common,
          picture: [],
          lyrics: [],
        },
        format: {
          ...metadata.format,
          duration: metadata.format.duration,
        },
      } as SongSkeletonStructure;

    event.reply('song-imported', {
      songsImported: i,
      totalSongs: files.length,
    });
  }

  // sort filesToTags by artist, album, and track number
  const orderedFilesToTags: { [key: string]: SongSkeletonStructure } = {};
  Object.keys(filesToTags)
    .sort((a, b) => {
      const artistA = filesToTags[a].common?.artist;
      const artistB = filesToTags[b].common?.artist;
      const albumA = filesToTags[a].common?.album;
      const albumB = filesToTags[b].common?.album;
      const trackA = filesToTags[a].common?.track?.no;
      const trackB = filesToTags[b].common?.track?.no;
      // handle null cases
      if (!artistA) return -1;
      if (!artistB) return 1;
      if (!albumA) return -1;
      if (!albumB) return 1;
      if (!trackA) return -1;
      if (!trackB) return 1;

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
  const initialStore = {
    library: orderedFilesToTags,
    playlists: [],
  } as StoreStructure;

  event.reply('select-dirs', initialStore);

  // write the json file to the user data directory as userConfig.json
  // for caching purposes, we use this during future startups of the app.
  const dataPath = app.getPath('userData');
  const filePath = path.join(dataPath, 'userConfig.json');
  fs.writeFileSync(filePath, JSON.stringify(initialStore));
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

  /**
   * @dev create a custom protocol to handle requests for media files
   *      from the renderer process. This is necessary because the
   *     renderer process cannot access the file system directly.
   */
  protocol.registerFileProtocol('my-magic-protocol', (request, callback) => {
    const url = request.url.replace('my-magic-protocol://getMediaFile/', '');
    try {
      return callback(url);
    } catch (error) {
      console.error(error);
      return callback(404);
    }
  });

  const RESOURCES_PATH = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  const getAssetPath = (...paths: string[]): string => {
    return path.join(RESOURCES_PATH, ...paths);
  };

  mainWindow = new BrowserWindow({
    show: false,
    width: 1024,
    height: 1024,
    icon: getAssetPath('icons/1024x1024.png'),
    frame: false,
    titleBarStyle: 'hidden',
    webPreferences: {
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

    /**
     * @dev read the userConfig.json file from the user data directory
     *     and send the contents to the renderer process to initialize
     *    the app.
     */
    const dataPath = app.getPath('userData');
    const filePath = path.join(dataPath, 'userConfig.json');
    const contents = parseData(filePath);
    mainWindow.webContents.send('initialize', contents as StoreStructure);
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
